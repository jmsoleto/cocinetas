import type { SupabaseClient } from "@supabase/supabase-js";

/* Acceso a los ingredientes y la despensa.
 *
 * Ninguna consulta filtra por `perfil_id`. No es un olvido: de eso responde la
 * RLS, y filtrar aquí además daría la falsa impresión de que la garantía vive
 * en este fichero. Si mañana una de estas consultas se equivoca, la base de
 * datos sigue sin entregar la fila de otra persona.
 *
 * Las escrituras que pueden chocar contra una restricción devuelven un mensaje
 * en español en vez de dejar escapar el error de Postgres. Los códigos son los
 * que llegan tal cual desde PostgREST. */

/** Un ingrediente del catálogo propio, con si está o no en la despensa. */
export type Ingrediente = {
  id: string;
  nombre: string;
  seAsume: boolean;
  enDespensa: boolean;
};

/* PostgREST devuelve el `embed` como objeto cuando puede demostrar que la
   relación es a-uno, y como lista cuando no. Aquí la clave ajena es compuesta
   —(ingrediente_id, perfil_id)— y la deducción no es de fiar en los dos
   sentidos: el tipo generado dice lista y la respuesta real trae objeto. Como
   lo único que se pregunta es «¿hay entrada de despensa?», se admiten las dos
   formas y se deja de depender de cuál llegue. */
function estaEnDespensa(entrada: unknown): boolean {
  if (entrada === null || entrada === undefined) return false;
  return Array.isArray(entrada) ? entrada.length > 0 : true;
}

/* El orden es el de `normalizado` y no el de `nombre`: es estable —no depende
   de la intercalación ni de si alguien escribió con mayúscula— y de paso deja
   juntas las variantes que quizá haya que fusionar. */
const ORDEN = "normalizado";

const SELECCION = "id, nombre, se_asume, pantry(ingrediente_id)";

/**
 * Todo el catálogo propio en una sola consulta, del que salen tanto la
 * despensa como las sugerencias del formulario.
 */
export async function leerCatalogo(supabase: SupabaseClient): Promise<Ingrediente[]> {
  const { data, error } = await supabase
    .from("ingredients")
    .select(SELECCION)
    .order(ORDEN);

  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);

  return (data ?? []).map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    seAsume: fila.se_asume,
    enDespensa: estaEnDespensa(fila.pantry),
  }));
}

/** Lo que hay en la despensa, y lo que se puede sugerir para añadir. */
export function repartirCocina(catalogo: Ingrediente[]) {
  return {
    despensa: catalogo.filter((i) => i.enDespensa),
    /* Lo que se da por supuesto no se sugiere nunca: nadie debería tener que
       declarar que tiene sal. Y lo que ya está dentro tampoco. */
    sugerencias: catalogo.filter((i) => !i.enDespensa && !i.seAsume),
  };
}

/** Resultado de una escritura: o salió bien, o hay algo que contarle a alguien. */
export type Resultado = { error: string | null };

const BIEN: Resultado = { error: null };

export async function anadirADespensa(
  supabase: SupabaseClient,
  texto: string,
): Promise<Resultado> {
  if (texto.trim() === "") return { error: "Escribe un ingrediente." };

  const { error } = await supabase.rpc("anadir_a_despensa", { texto });
  if (!error) return BIEN;

  /* El aviso de «eso ya se da por supuesto» lo redacta la propia función, que
     es donde vive la lista. Repetirlo aquí sería tener la regla en dos sitios. */
  if (error.code === "P0001") return { error: error.message };
  if (error.code === "23514") return { error: "Escribe un ingrediente." };
  return { error: `No se pudo añadir: ${error.message}` };
}

export async function quitarDeDespensa(
  supabase: SupabaseClient,
  ingredienteId: string,
): Promise<Resultado> {
  const { error } = await supabase
    .from("pantry")
    .delete()
    .eq("ingrediente_id", ingredienteId);

  return error ? { error: `No se pudo quitar: ${error.message}` } : BIEN;
}

export async function renombrarIngrediente(
  supabase: SupabaseClient,
  id: string,
  nombre: string,
): Promise<Resultado> {
  if (nombre.trim() === "") return { error: "El nombre no puede estar vacío." };

  const { error } = await supabase
    .from("ingredients")
    .update({ nombre: nombre.trim() })
    .eq("id", id);

  if (!error) return BIEN;

  /* 23505 es el índice único (perfil_id, normalizado): ya hay otro ingrediente
     que, una vez normalizado, se llama igual. No es un fallo, es el momento de
     ofrecer la fusión. */
  if (error.code === "23505") {
    return {
      error: `Ya tienes otro ingrediente que se llama así. Fusiónalos si son el mismo.`,
    };
  }
  return { error: `No se pudo renombrar: ${error.message}` };
}

export async function cambiarSeAsume(
  supabase: SupabaseClient,
  id: string,
  seAsume: boolean,
): Promise<Resultado> {
  const { error } = await supabase
    .from("ingredients")
    .update({ se_asume: seAsume })
    .eq("id", id);

  if (error) return { error: `No se pudo cambiar: ${error.message}` };

  /* Pasar a darse por supuesto implica salir de la despensa: los que se dan por
     supuestos no se muestran ahí, y dejar la fila detrás sería un dato que no
     se ve pero cuenta. */
  if (seAsume) return quitarDeDespensa(supabase, id);
  return BIEN;
}

export async function fusionarIngredientes(
  supabase: SupabaseClient,
  origen: string,
  destino: string,
): Promise<Resultado> {
  const { error } = await supabase.rpc("fusionar_ingredientes", {
    id_origen: origen,
    id_destino: destino,
  });

  if (!error) return BIEN;
  if (error.code === "22023") return { error: "Elige dos ingredientes distintos." };
  return { error: `No se pudo fusionar: ${error.message}` };
}

export async function eliminarIngrediente(
  supabase: SupabaseClient,
  id: string,
): Promise<Resultado> {
  const { error } = await supabase.from("ingredients").delete().eq("id", id);

  if (!error) return BIEN;

  /* Las claves ajenas que apuntan aquí son `no action` a propósito: borrar algo
     que sigue en uso tiene que fallar, no llevarse por delante la entrada de la
     despensa ni la línea de una receta.
     
     Desde la fase 2 hay DOS motivos posibles, así que hay que averiguar cuál
     es: decir «está en uso» sin decir dónde deja a la persona buscando a
     ciegas. Se pregunta solo cuando ya ha fallado, que es cuando importa. */
  if (error.code === "23503") return { error: await porQueEstaEnUso(supabase, id) };
  return { error: `No se pudo eliminar: ${error.message}` };
}

/** Por qué no se puede borrar un ingrediente: la despensa, una receta, o ambas. */
async function porQueEstaEnUso(supabase: SupabaseClient, id: string): Promise<string> {
  const [despensa, recetas] = await Promise.all([
    supabase.from("pantry").select("ingrediente_id").eq("ingrediente_id", id).limit(1),
    supabase
      .from("recipe_ingredients")
      .select("recipes ( titulo )")
      .eq("ingrediente_id", id)
      .limit(2),
  ]);

  const enDespensa = (despensa.data ?? []).length > 0;
  const lineas = recetas.data ?? [];

  if (enDespensa && lineas.length === 0) {
    return "Ese ingrediente está en tu despensa. Quítalo de ahí antes de borrarlo.";
  }

  if (lineas.length > 0) {
    /* Con el nombre de la receta cuando es una sola: es lo que convierte el
       aviso en algo accionable en vez de en un «búscalo tú». */
    const embed = lineas[0]?.recipes as unknown;
    const primera = (Array.isArray(embed) ? embed[0] : embed) as
      { titulo: string | null } | null | undefined;
    const titulo = primera?.titulo?.trim();

    const donde =
      lineas.length === 1 && titulo
        ? `lo usa la receta «${titulo}»`
        : "lo usan algunas de tus recetas";

    return enDespensa
      ? `Ese ingrediente está en tu despensa y además ${donde}.`
      : `No se puede borrar: ${donde}.`;
  }

  return "Ese ingrediente está en uso.";
}
