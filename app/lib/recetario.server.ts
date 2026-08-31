import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resultado } from "./cocina.server";

/* Acceso a las recetas, sus líneas, sus pasos y los enlaces entre ambos.
 *
 * Como en `cocina.server.ts`, ninguna consulta filtra por `perfil_id`: de eso
 * responde la RLS, y filtrar aquí además daría la falsa impresión de que la
 * garantía vive en este fichero.
 *
 * Los errores que pueden chocar contra una restricción se traducen a español
 * en vez de dejar escapar el de Postgres. Los códigos llegan tal cual desde
 * PostgREST. */

const BIEN: Resultado = { error: null };

export type LineaReceta = {
  id: string;
  orden: number;
  cantidad: string | null;
  nota: string | null;
  ingredienteId: string;
  ingrediente: string;
};

export type PasoReceta = {
  id: string;
  orden: number;
  texto: string;
  /** Ids de las LÍNEAS que este paso usa, no de los ingredientes. */
  lineas: string[];
};

export type Receta = {
  id: string;
  titulo: string | null;
  comensales: number | null;
  finalizadaEn: string | null;
  lineas: LineaReceta[];
  pasos: PasoReceta[];
};

export type RecetaResumen = {
  id: string;
  titulo: string | null;
  finalizadaEn: string | null;
  /** Para poder distinguir un borrador vacío de uno empezado. */
  vacia: boolean;
};

/* Una receta entera en UNA sola consulta, no repartida en varias.
 *
 * No es una optimización: es lo que permitirá que la fase 4 cachee la receta
 * como un documento para seguirla sin red. Repartirla en tres consultas
 * obligaría a reconstruirla desde el service worker, que es donde eso deja de
 * ser barato. Está anotado en la D2 del diseño. */
const RECETA_COMPLETA = `
  id, titulo, comensales, finalizada_en,
  recipe_ingredients ( id, orden, cantidad, nota, ingrediente_id,
                       ingredients ( nombre ) ),
  steps ( id, orden, texto, step_ingredients ( linea_id ) )
`;

/* PostgREST devuelve un `embed` como objeto cuando puede demostrar que la
   relación es a-uno, y como lista cuando no. Con claves ajenas compuestas la
   deducción no es de fiar —ya pasó en `cocina.server.ts` con la despensa—, así
   que se admiten las dos formas en lugar de depender de cuál llegue. */
function unaFila<T>(valor: unknown): T | null {
  if (valor === null || valor === undefined) return null;
  return (Array.isArray(valor) ? (valor[0] ?? null) : valor) as T | null;
}

function comoLista<T>(valor: unknown): T[] {
  if (valor === null || valor === undefined) return [];
  return (Array.isArray(valor) ? valor : [valor]) as T[];
}

function porOrden(a: { orden: number }, b: { orden: number }) {
  return a.orden - b.orden;
}

/** Una receta con todo lo que cuelga de ella, o `null` si no es tuya. */
export async function leerReceta(
  supabase: SupabaseClient,
  id: string,
): Promise<Receta | null> {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECETA_COMPLETA)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer la receta: ${error.message}`);
  if (!data) return null;

  const lineas: LineaReceta[] = comoLista<Record<string, unknown>>(
    data.recipe_ingredients,
  )
    .map((fila) => ({
      id: fila.id as string,
      orden: fila.orden as number,
      cantidad: (fila.cantidad as string | null) ?? null,
      nota: (fila.nota as string | null) ?? null,
      ingredienteId: fila.ingrediente_id as string,
      ingrediente:
        unaFila<{ nombre: string }>(fila.ingredients)?.nombre ?? "(sin nombre)",
    }))
    .sort(porOrden);

  const pasos: PasoReceta[] = comoLista<Record<string, unknown>>(data.steps)
    .map((fila) => ({
      id: fila.id as string,
      orden: fila.orden as number,
      texto: (fila.texto as string) ?? "",
      lineas: comoLista<{ linea_id: string }>(fila.step_ingredients).map(
        (e) => e.linea_id,
      ),
    }))
    .sort(porOrden);

  return {
    id: data.id,
    titulo: data.titulo ?? null,
    comensales: data.comensales ?? null,
    finalizadaEn: data.finalizada_en ?? null,
    lineas,
    pasos,
  };
}

/**
 * La lista, con los borradores aparte.
 *
 * Las terminadas van por fecha de finalización descendente y los borradores por
 * última edición: en los dos casos lo último que tocaste primero, que es lo que
 * se busca al abrir la pantalla.
 */
export async function leerRecetario(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, titulo, finalizada_en, actualizado_en, recipe_ingredients(id), steps(id)",
    )
    .order("actualizado_en", { ascending: false });

  if (error) throw new Error(`No se pudo leer el recetario: ${error.message}`);

  const todas: RecetaResumen[] = (data ?? []).map((fila) => ({
    id: fila.id,
    titulo: fila.titulo ?? null,
    finalizadaEn: fila.finalizada_en ?? null,
    vacia:
      !fila.titulo?.trim() &&
      comoLista(fila.recipe_ingredients).length === 0 &&
      comoLista(fila.steps).length === 0,
  }));

  return {
    terminadas: todas.filter((r) => r.finalizadaEn !== null),
    borradores: todas.filter((r) => r.finalizadaEn === null),
  };
}

/* ── Escrituras ─────────────────────────────────────────────────────────── */

/** Crea el borrador vacío y devuelve su id: el editor necesita dónde escribir. */
export async function crearBorrador(
  supabase: SupabaseClient,
  perfilId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("recipes")
    .insert({ perfil_id: perfilId })
    .select("id")
    .single();

  if (error) return { id: null, error: `No se pudo crear la receta: ${error.message}` };
  return { id: data.id, error: null };
}

export async function guardarCabecera(
  supabase: SupabaseClient,
  id: string,
  campos: { titulo?: string; comensales?: string },
): Promise<Resultado> {
  const cambios: Record<string, unknown> = {};

  if (campos.titulo !== undefined) {
    /* Vacío se guarda como nulo y no como cadena vacía: «sin título» es la
       ausencia del dato, y el check de la base de datos habla de nulos. */
    cambios.titulo = campos.titulo.trim() === "" ? null : campos.titulo.trim();
  }

  if (campos.comensales !== undefined) {
    const n = Number.parseInt(campos.comensales, 10);
    if (campos.comensales.trim() === "") cambios.comensales = null;
    else if (!Number.isFinite(n) || n <= 0)
      return { error: "Los comensales tienen que ser un número mayor que cero." };
    else cambios.comensales = n;
  }

  if (Object.keys(cambios).length === 0) return BIEN;

  const { error } = await supabase.from("recipes").update(cambios).eq("id", id);
  return error ? { error: `No se pudo guardar: ${error.message}` } : BIEN;
}

/** Resuelve el texto contra el catálogo y cuelga la línea al final. */
export async function anadirLinea(
  supabase: SupabaseClient,
  perfilId: string,
  recetaId: string,
  texto: string,
): Promise<Resultado> {
  if (texto.trim() === "") return { error: "Escribe un ingrediente." };

  /* La misma puerta que usa la despensa: una palabra nueva entra en el
     catálogo sin que el editor tenga que preguntarlo. */
  const { data: ingredienteId, error: errorResolver } = await supabase.rpc(
    "resolver_ingrediente",
    { texto },
  );
  if (errorResolver) {
    if (errorResolver.code === "23514") return { error: "Escribe un ingrediente." };
    return { error: `No se pudo añadir: ${errorResolver.message}` };
  }

  const { error } = await supabase.from("recipe_ingredients").insert({
    perfil_id: perfilId,
    receta_id: recetaId,
    ingrediente_id: ingredienteId,
    orden: await siguienteOrden(supabase, "recipe_ingredients", recetaId),
  });

  return error ? { error: `No se pudo añadir: ${error.message}` } : BIEN;
}

export async function guardarLinea(
  supabase: SupabaseClient,
  id: string,
  campos: { cantidad?: string; nota?: string },
): Promise<Resultado> {
  const cambios: Record<string, unknown> = {};
  if (campos.cantidad !== undefined)
    cambios.cantidad = campos.cantidad.trim() === "" ? null : campos.cantidad.trim();
  if (campos.nota !== undefined)
    cambios.nota = campos.nota.trim() === "" ? null : campos.nota.trim();

  if (Object.keys(cambios).length === 0) return BIEN;

  const { error } = await supabase
    .from("recipe_ingredients")
    .update(cambios)
    .eq("id", id);
  return error ? { error: `No se pudo guardar: ${error.message}` } : BIEN;
}

/**
 * Borra una línea, y si algún paso la usa se niega diciendo CUÁLES.
 *
 * El 23503 de Postgres no dice qué pasos son, así que hay que preguntarlo. Se
 * pregunta solo cuando ha fallado: en el camino normal no cuesta nada, y decir
 * «está en uso» sin decir dónde convierte una barandilla en un muro.
 */
export async function borrarLinea(
  supabase: SupabaseClient,
  id: string,
): Promise<Resultado> {
  const { error } = await supabase.from("recipe_ingredients").delete().eq("id", id);
  if (!error) return BIEN;

  if (error.code === "23503") {
    const { data } = await supabase
      .from("step_ingredients")
      .select("steps ( orden )")
      .eq("linea_id", id);

    const ordenes = (data ?? [])
      .map((fila) => unaFila<{ orden: number }>(fila.steps)?.orden)
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b);

    if (ordenes.length === 1) {
      return { error: `No se puede borrar: la usa el paso ${ordenes[0]}.` };
    }
    if (ordenes.length > 1) {
      const lista = `${ordenes.slice(0, -1).join(", ")} y ${ordenes.at(-1)}`;
      return { error: `No se puede borrar: la usan los pasos ${lista}.` };
    }
    return { error: "No se puede borrar: algún paso la está usando." };
  }

  return { error: `No se pudo borrar: ${error.message}` };
}

export async function anadirPaso(
  supabase: SupabaseClient,
  perfilId: string,
  recetaId: string,
): Promise<Resultado> {
  const { error } = await supabase.from("steps").insert({
    perfil_id: perfilId,
    receta_id: recetaId,
    orden: await siguienteOrden(supabase, "steps", recetaId),
    texto: "",
  });
  return error ? { error: `No se pudo añadir el paso: ${error.message}` } : BIEN;
}

export async function guardarPaso(
  supabase: SupabaseClient,
  id: string,
  texto: string,
): Promise<Resultado> {
  /* Sin recortar ni rechazar el vacío: un paso a medio escribir es contenido
     legítimo de un borrador, y recortarlo movería el cursor de quien escribe. */
  const { error } = await supabase.from("steps").update({ texto }).eq("id", id);
  return error ? { error: `No se pudo guardar: ${error.message}` } : BIEN;
}

/** Borrar un paso se lleva sus enlaces por cascada, y deja las líneas. */
export async function borrarPaso(
  supabase: SupabaseClient,
  id: string,
): Promise<Resultado> {
  const { error } = await supabase.from("steps").delete().eq("id", id);
  return error ? { error: `No se pudo borrar el paso: ${error.message}` } : BIEN;
}

export async function marcarLineaEnPaso(
  supabase: SupabaseClient,
  perfilId: string,
  recetaId: string,
  pasoId: string,
  lineaId: string,
  usada: boolean,
): Promise<Resultado> {
  if (usada) {
    const { error } = await supabase.from("step_ingredients").upsert(
      {
        perfil_id: perfilId,
        receta_id: recetaId,
        paso_id: pasoId,
        linea_id: lineaId,
      },
      { onConflict: "paso_id,linea_id", ignoreDuplicates: true },
    );
    return error ? { error: `No se pudo marcar: ${error.message}` } : BIEN;
  }

  const { error } = await supabase
    .from("step_ingredients")
    .delete()
    .eq("paso_id", pasoId)
    .eq("linea_id", lineaId);
  return error ? { error: `No se pudo desmarcar: ${error.message}` } : BIEN;
}

/** Manda el orden ENTERO. Nunca un intercambio: ver D5 del diseño. */
export async function reordenar(
  supabase: SupabaseClient,
  que: "pasos" | "lineas",
  recetaId: string,
  ids: string[],
): Promise<Resultado> {
  const { error } = await supabase.rpc(
    que === "pasos" ? "reordenar_pasos" : "reordenar_lineas",
    { p_receta_id: recetaId, p_ids: ids },
  );

  if (!error) return BIEN;
  /* 22023 es «el orden no trae exactamente lo que hay». Le pasa a una pestaña
     que llevaba abierta desde antes de que se añadiera un paso. */
  if (error.code === "22023")
    return { error: "La receta ha cambiado. Recarga y vuelve a ordenarla." };
  return { error: `No se pudo reordenar: ${error.message}` };
}

/** Comprueba y sella. Los mensajes de qué falta los redacta la función SQL. */
export async function finalizarReceta(
  supabase: SupabaseClient,
  id: string,
): Promise<Resultado> {
  const { error } = await supabase.rpc("finalizar_receta", { p_id: id });
  if (!error) return BIEN;

  /* P0001 es una carencia concreta —falta el título, las líneas o los pasos— y
     el texto ya viene en español desde donde vive la regla. Repetirlo aquí
     sería tener la misma condición escrita en dos sitios. */
  if (error.code === "P0001") return { error: error.message };
  if (error.code === "P0002") return { error: "Esa receta no existe o no es tuya." };
  return { error: `No se pudo terminar: ${error.message}` };
}

/** Devolver a borrador: la puerta de entrada al editor (D8 del diseño). */
export async function devolverABorrador(
  supabase: SupabaseClient,
  id: string,
): Promise<Resultado> {
  const { error } = await supabase
    .from("recipes")
    .update({ finalizada_en: null })
    .eq("id", id);
  return error ? { error: `No se pudo devolver a borrador: ${error.message}` } : BIEN;
}

export async function descartarReceta(
  supabase: SupabaseClient,
  id: string,
): Promise<Resultado> {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  return error ? { error: `No se pudo descartar: ${error.message}` } : BIEN;
}

/* La posición siguiente en la receta. No hay carrera que temer: dos añadidos
   simultáneos darían el mismo número, y como no hay `unique (receta_id, orden)`
   eso no rompe nada — quedarían empatados hasta el siguiente reordenado, que
   los renumera. Es la contrapartida buscada de no poner la restricción. */
async function siguienteOrden(
  supabase: SupabaseClient,
  tabla: "steps" | "recipe_ingredients",
  recetaId: string,
): Promise<number> {
  const { data } = await supabase
    .from(tabla)
    .select("orden")
    .eq("receta_id", recetaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.orden ?? 0) + 1;
}

/**
 * Retira los borradores que no contienen nada.
 *
 * Se ejecuta al crear una receta nueva, y no al listar: un `loader` es un GET y
 * un GET no debe borrar nada —lo dispararía cualquier prefetch del navegador—.
 * Crear es el momento natural además de por eso: es cuando se produce la
 * basura, así que barrer justo antes la mantiene acotada sola.
 *
 * Un borrador sin título, sin líneas y sin pasos no contiene información, así
 * que no hay nada que preguntar. Uno devuelto desde «terminada» tiene las tres
 * cosas y queda fuera por construcción.
 */
export async function barrerBorradoresVacios(supabase: SupabaseClient): Promise<void> {
  const { borradores } = await leerRecetario(supabase);
  const vacios = borradores.filter((r) => r.vacia).map((r) => r.id);
  if (vacios.length === 0) return;

  /* Sin comprobar el error a propósito: esto es limpieza de fondo. Que falle no
     puede impedir crear una receta, que es lo que la persona ha pedido. */
  await supabase.from("recipes").delete().in("id", vacios);
}
