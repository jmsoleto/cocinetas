import { useEffect, useRef } from "react";
import {
  Link,
  data,
  redirect,
  useFetcher,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import type { Route } from "./+types/receta.editar";
import { exigirUsuario } from "../lib/session.server";
import { leerCatalogo } from "../lib/cocina.server";
import {
  anadirLinea,
  anadirPaso,
  borrarLinea,
  borrarPaso,
  devolverABorrador,
  finalizarReceta,
  guardarCabecera,
  guardarLinea,
  guardarPaso,
  leerReceta,
  marcarLineaEnPaso,
  reordenar,
  type LineaReceta,
  type PasoReceta,
} from "../lib/recetario.server";
import {
  IndicadorGuardado,
  ProveedorGuardado,
  useGuardadoAlVuelo,
} from "../componentes/guardado";
import { useOrdenable } from "../componentes/ordenable";
import { RUTA_RECETAS, rutaReceta } from "../rutas";
import estilos from "./receta.editar.module.css";

export function meta({ loaderData }: Route.MetaArgs) {
  const titulo = loaderData?.receta?.titulo?.trim();
  return [{ title: `${titulo || "Borrador"} · Cocinetas` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = await exigirUsuario(request);
  const receta = await leerReceta(supabase, params.id);

  if (!receta) throw data("Esta receta no existe.", { status: 404, headers });

  /* Una receta terminada no se edita: para tocarla hay que devolverla a
     borrador, y eso se hace desde el detalle. Entrar a mano en esta URL no
     abre el editor, lleva allí. Es la D8 del diseño. */
  if (receta.finalizadaEn) throw redirect(rutaReceta(receta.id), { headers });

  const catalogo = await leerCatalogo(supabase);
  return data(
    { receta, sugerencias: catalogo.map((i) => ({ id: i.id, nombre: i.nombre })) },
    { headers },
  );
}

/* Guardar un CAMPO DE TEXTO no obliga a releer la receta entera después de cada
   tecleo, porque esos campos tienen su propio estado en `useGuardadoAlVuelo`:
   lo que se ve en pantalla ya es lo último que se escribió, y el `loader`
   devolvería exactamente eso.
   
   La regla es esa, y no «lo que no cambia la forma de la receta». Marcar una
   línea en un paso tampoco cambia la forma, pero la casilla NO tiene estado
   propio: se dibuja desde `loaderData`. Excluirla hacía que al terminar el
   envío cayera al valor viejo y se desmarcara sola, aunque la escritura hubiera
   ido bien — y reaparecía marcada en cuanto cualquier otra cosa revalidaba.
   
   Si algún día aparece otra intención aquí, la pregunta que hay que hacerse no
   es si cambia la forma, sino si lo que se ve sobrevive por sí solo a que el
   `loader` no vuelva a correr. */
export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const intencion = formData?.get("intencion");
  if (
    intencion === "cabecera" ||
    intencion === "linea-guardar" ||
    intencion === "paso-guardar"
  ) {
    return false;
  }
  return defaultShouldRevalidate;
}

export async function action({ request, params }: Route.ActionArgs) {
  const { usuario, supabase, headers } = await exigirUsuario(request);
  const datos = await request.formData();
  const intencion = String(datos.get("intencion") ?? "");
  const texto = (campo: string) => String(datos.get(campo) ?? "");

  /* Terminar va antes del resto y aparte: es la única intención que NAVEGA, a
     propósito —la receta deja de ser editable, así que quedarse en el editor
     sería enseñar una pantalla que ya no aplica—. Tratarla dentro del switch la
     haría caer además en el `default`. */
  if (intencion === "finalizar") {
    const r = await finalizarReceta(supabase, params.id);
    if (r.error) return data({ error: r.error }, { headers });
    throw redirect(rutaReceta(params.id), { headers });
  }

  const resultado = await (async () => {
    switch (intencion) {
      case "cabecera":
        return guardarCabecera(supabase, params.id, {
          ...(datos.has("titulo") ? { titulo: texto("titulo") } : {}),
          ...(datos.has("comensales") ? { comensales: texto("comensales") } : {}),
        });
      case "linea-anadir":
        return anadirLinea(supabase, usuario.id, params.id, texto("nombre"));
      case "linea-guardar":
        return guardarLinea(supabase, texto("linea"), {
          ...(datos.has("cantidad") ? { cantidad: texto("cantidad") } : {}),
          ...(datos.has("nota") ? { nota: texto("nota") } : {}),
        });
      case "linea-borrar":
        return borrarLinea(supabase, texto("linea"));
      case "paso-anadir":
        return anadirPaso(supabase, usuario.id, params.id);
      case "paso-guardar":
        return guardarPaso(supabase, texto("paso"), texto("texto"));
      case "paso-borrar":
        return borrarPaso(supabase, texto("paso"));
      case "enlace":
        return marcarLineaEnPaso(
          supabase,
          usuario.id,
          params.id,
          texto("paso"),
          texto("linea"),
          texto("usada") === "si",
        );
      case "reordenar":
        return reordenar(
          supabase,
          texto("que") === "lineas" ? "lineas" : "pasos",
          params.id,
          datos.getAll("id").map(String),
        );
      case "borrador":
        return devolverABorrador(supabase, params.id);
      default:
        return { error: `Intención desconocida: ${intencion}` };
    }
  })();

  /* Nunca se redirige desde aquí: estas respuestas las reciben `fetcher`s, y
     un `fetcher` que recibe una redirección navega la página entera — que es
     justo lo que el guardado al vuelo existe para no hacer. */
  return data({ error: resultado.error }, { headers });
}

export default function EditarReceta({ loaderData }: Route.ComponentProps) {
  const { receta, sugerencias } = loaderData;

  return (
    <ProveedorGuardado>
      <main className="app-main">
        <div className={estilos.pantalla}>
          <header className={estilos.cabecera}>
            <Link to={RUTA_RECETAS} className={estilos.volver}>
              ← Recetas
            </Link>
            <span className={estilos.indicador}>
              <IndicadorGuardado />
            </span>
          </header>

          <Cabecera receta={receta} />
          <Lineas receta={receta} sugerencias={sugerencias} />
          <Pasos receta={receta} />
          <Terminar />
        </div>
      </main>
    </ProveedorGuardado>
  );
}

/* ── Título y comensales ─────────────────────────────────────────────────── */

function Cabecera({
  receta,
}: {
  receta: { id: string; titulo: string | null; comensales: number | null };
}) {
  const titulo = useGuardadoAlVuelo({
    clave: `titulo:${receta.id}`,
    valorInicial: receta.titulo ?? "",
    datos: (valor) => ({ intencion: "cabecera", titulo: valor }),
  });

  const comensales = useGuardadoAlVuelo({
    clave: `comensales:${receta.id}`,
    valorInicial: receta.comensales?.toString() ?? "",
    datos: (valor) => ({ intencion: "cabecera", comensales: valor }),
  });

  return (
    <div className={estilos.bloque}>
      <div className="field">
        <label htmlFor="titulo">Título</label>
        <input
          id="titulo"
          className="input"
          value={titulo.valor}
          onChange={(e) => titulo.alCambiar(e.target.value)}
          onBlur={titulo.alSalir}
          placeholder="Arroz con lo que hubiera"
        />
        {titulo.error ? <p className={estilos.error}>{titulo.error}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="comensales">Comensales</label>
        <input
          id="comensales"
          className="input"
          inputMode="numeric"
          value={comensales.valor}
          onChange={(e) => comensales.alCambiar(e.target.value)}
          onBlur={comensales.alSalir}
          placeholder="Opcional"
        />
        {comensales.error ? <p className={estilos.error}>{comensales.error}</p> : null}
      </div>
    </div>
  );
}

/* ── Ingredientes ────────────────────────────────────────────────────────── */

function Lineas({
  receta,
  sugerencias,
}: {
  receta: { id: string; lineas: LineaReceta[] };
  sugerencias: { id: string; nombre: string }[];
}) {
  const anadir = useFetcher<{ error?: string | null }>();
  const orden = useFetcher();

  const ids = receta.lineas.map((l) => l.id);
  const {
    orden: ordenLocal,
    levantado,
    contenedorRef,
    asaProps,
    mensaje,
  } = useOrdenable(ids, (nuevos) =>
    orden.submit(
      [
        ["intencion", "reordenar"],
        ["que", "lineas"],
        ...nuevos.map((id) => ["id", id] as [string, string]),
      ],
      { method: "post" },
    ),
  );

  /* Tras añadir con éxito, el campo se vacía y recupera el foco.

     Sin esto el texto anterior se queda dentro —el envío no navega, así que
     nadie lo limpia— y hay que borrarlo a mano antes de escribir el siguiente
     ingrediente: tres gestos por línea en la parte más repetitiva del editor.
     Devolver el foco es la otra mitad, porque los ingredientes se teclean de
     seguido.

     NO se vacía cuando la acción devuelve error, y es deliberado: ahí lo
     escrito es justo lo que hay que corregir, y borrarlo obligaría a
     reescribirlo entero. */
  const formularioAnadir = useRef<HTMLFormElement>(null);
  const campoAnadir = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (anadir.state !== "idle" || !anadir.data || anadir.data.error) return;
    formularioAnadir.current?.reset();
    campoAnadir.current?.focus();
  }, [anadir.state, anadir.data]);

  const porId = new Map(receta.lineas.map((l) => [l.id, l]));

  return (
    <section className={estilos.bloque}>
      <h2 className={estilos.subtitulo}>Ingredientes</h2>

      <ul className={estilos.lista} ref={contenedorRef as React.Ref<HTMLUListElement>}>
        {ordenLocal.map((id) => {
          const linea = porId.get(id);
          if (!linea) return null;
          return (
            <li
              key={id}
              data-ordenable-id={id}
              className={levantado === id ? estilos.filaLevantada : estilos.fila}
            >
              <button type="button" className={estilos.asa} {...asaProps(id)}>
                ≡
              </button>
              <Linea linea={linea} />
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className={estilos.oculto}>
        {mensaje}
      </p>

      <anadir.Form method="post" className={estilos.anadir} ref={formularioAnadir}>
        <input type="hidden" name="intencion" value="linea-anadir" />
        {/* <datalist> y no un desplegable en JavaScript: lo resuelve el
            navegador y en el móvil usa el selector nativo. */}
        <input
          ref={campoAnadir}
          name="nombre"
          className="input"
          list="catalogo"
          autoComplete="off"
          placeholder="Cebolla, arroz, pimentón…"
          required
        />
        <datalist id="catalogo">
          {sugerencias.map((i) => (
            <option key={i.id} value={i.nombre} />
          ))}
        </datalist>
        <button type="submit" className="btn btn-secondary">
          Añadir
        </button>
      </anadir.Form>
      {anadir.data?.error ? <p className={estilos.error}>{anadir.data.error}</p> : null}
      {orden.data?.error ? <p className={estilos.error}>{orden.data.error}</p> : null}
    </section>
  );
}

function Linea({ linea }: { linea: LineaReceta }) {
  const borrar = useFetcher<{ error?: string | null }>();

  const cantidad = useGuardadoAlVuelo({
    clave: `cantidad:${linea.id}`,
    valorInicial: linea.cantidad ?? "",
    datos: (valor) => ({
      intencion: "linea-guardar",
      linea: linea.id,
      cantidad: valor,
    }),
  });

  const nota = useGuardadoAlVuelo({
    clave: `nota:${linea.id}`,
    valorInicial: linea.nota ?? "",
    datos: (valor) => ({ intencion: "linea-guardar", linea: linea.id, nota: valor }),
  });

  return (
    <div className={estilos.cuerpoFila}>
      <div className={estilos.lineaCabecera}>
        <span className={estilos.ingrediente}>{linea.ingrediente}</span>
        <borrar.Form method="post">
          <input type="hidden" name="intencion" value="linea-borrar" />
          <input type="hidden" name="linea" value={linea.id} />
          <button
            type="submit"
            className="btn btn-ghost"
            aria-label={`Borrar ${linea.ingrediente}`}
          >
            ×
          </button>
        </borrar.Form>
      </div>

      <div className={estilos.lineaCampos}>
        <input
          className="input"
          value={cantidad.valor}
          onChange={(e) => cantidad.alCambiar(e.target.value)}
          onBlur={cantidad.alSalir}
          placeholder="2 dientes"
          aria-label={`Cantidad de ${linea.ingrediente}`}
        />
        <input
          className="input"
          value={nota.valor}
          onChange={(e) => nota.alCambiar(e.target.value)}
          onBlur={nota.alSalir}
          placeholder="picada"
          aria-label={`Nota de ${linea.ingrediente}`}
        />
      </div>

      {/* El error se queda pegado a SU fila y no se desvanece: con guardado al
          vuelo, un aviso que pasa por arriba es un aviso que nadie ve. */}
      {borrar.data?.error ? <p className={estilos.error}>{borrar.data.error}</p> : null}
      {cantidad.error ? <p className={estilos.error}>{cantidad.error}</p> : null}
      {nota.error ? <p className={estilos.error}>{nota.error}</p> : null}
    </div>
  );
}

/* ── Pasos ───────────────────────────────────────────────────────────────── */

function Pasos({
  receta,
}: {
  receta: { id: string; lineas: LineaReceta[]; pasos: PasoReceta[] };
}) {
  const anadir = useFetcher<{ error?: string | null }>();
  const orden = useFetcher();

  const ids = receta.pasos.map((p) => p.id);
  const {
    orden: ordenLocal,
    levantado,
    contenedorRef,
    asaProps,
    mensaje,
  } = useOrdenable(ids, (nuevos) =>
    orden.submit(
      [
        ["intencion", "reordenar"],
        ["que", "pasos"],
        ...nuevos.map((id) => ["id", id] as [string, string]),
      ],
      { method: "post" },
    ),
  );

  const porId = new Map(receta.pasos.map((p) => [p.id, p]));

  return (
    <section className={estilos.bloque}>
      <h2 className={estilos.subtitulo}>Pasos</h2>

      <ol className={estilos.lista} ref={contenedorRef as React.Ref<HTMLOListElement>}>
        {ordenLocal.map((id, i) => {
          const paso = porId.get(id);
          if (!paso) return null;
          return (
            <li
              key={id}
              data-ordenable-id={id}
              className={levantado === id ? estilos.filaLevantada : estilos.fila}
            >
              <button type="button" className={estilos.asa} {...asaProps(id)}>
                {i + 1}
              </button>
              <Paso paso={paso} lineas={receta.lineas} />
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className={estilos.oculto}>
        {mensaje}
      </p>

      <anadir.Form method="post">
        <input type="hidden" name="intencion" value="paso-anadir" />
        <button type="submit" className="btn btn-secondary btn-block">
          Añadir paso
        </button>
      </anadir.Form>
      {anadir.data?.error ? <p className={estilos.error}>{anadir.data.error}</p> : null}
      {orden.data?.error ? <p className={estilos.error}>{orden.data.error}</p> : null}
    </section>
  );
}

function Paso({ paso, lineas }: { paso: PasoReceta; lineas: LineaReceta[] }) {
  const borrar = useFetcher<{ error?: string | null }>();

  const texto = useGuardadoAlVuelo({
    clave: `paso:${paso.id}`,
    valorInicial: paso.texto,
    datos: (valor) => ({ intencion: "paso-guardar", paso: paso.id, texto: valor }),
  });

  return (
    <div className={estilos.cuerpoFila}>
      <textarea
        className="input"
        rows={3}
        value={texto.valor}
        onChange={(e) => texto.alCambiar(e.target.value)}
        onBlur={texto.alSalir}
        placeholder="Sofríe la cebolla hasta que transparente"
        aria-label="Texto del paso"
      />

      {/* Qué líneas usa este paso. Un paso sin ninguna marcada es normal
          —«precalienta el horno»— y no impide terminar la receta. */}
      {lineas.length > 0 ? (
        <fieldset className={estilos.enlaces}>
          <legend className={estilos.leyenda}>Usa</legend>
          {lineas.map((linea) => (
            <Enlace key={linea.id} paso={paso} linea={linea} />
          ))}
        </fieldset>
      ) : null}

      <borrar.Form method="post">
        <input type="hidden" name="intencion" value="paso-borrar" />
        <input type="hidden" name="paso" value={paso.id} />
        <button type="submit" className="btn btn-ghost">
          Borrar paso
        </button>
      </borrar.Form>

      {texto.error ? <p className={estilos.error}>{texto.error}</p> : null}
      {borrar.data?.error ? <p className={estilos.error}>{borrar.data.error}</p> : null}
    </div>
  );
}

function Enlace({ paso, linea }: { paso: PasoReceta; linea: LineaReceta }) {
  const fetcher = useFetcher<{ error?: string | null }>();

  /* Mientras el envío está en vuelo manda lo que se acaba de pulsar, no lo que
     dice el servidor: si no, la casilla parpadea de vuelta y luego avanza. */
  const enVuelo = fetcher.formData?.get("usada");
  const usada =
    enVuelo !== undefined ? enVuelo === "si" : paso.lineas.includes(linea.id);

  return (
    <label className={estilos.enlace}>
      <input
        type="checkbox"
        checked={usada}
        onChange={(e) =>
          fetcher.submit(
            {
              intencion: "enlace",
              paso: paso.id,
              linea: linea.id,
              usada: e.target.checked ? "si" : "no",
            },
            { method: "post" },
          )
        }
      />
      <span className={estilos.ingrediente}>{linea.ingrediente}</span>
      {fetcher.data?.error ? (
        <span className={estilos.error}>{fetcher.data.error}</span>
      ) : null}
    </label>
  );
}

/* ── Terminar ────────────────────────────────────────────────────────────── */

function Terminar() {
  const fetcher = useFetcher<{ error?: string | null }>();

  return (
    <div className={estilos.bloque}>
      <fetcher.Form method="post">
        <input type="hidden" name="intencion" value="finalizar" />
        <button type="submit" className="btn btn-primary btn-block">
          Darla por terminada
        </button>
      </fetcher.Form>
      {/* El mensaje de qué falta lo redacta la función SQL, que es donde vive
          la regla: repetirlo aquí sería tenerla escrita en dos sitios. */}
      {fetcher.data?.error ? (
        <p className={estilos.error}>{fetcher.data.error}</p>
      ) : null}
      <p className={estilos.nota}>
        Una receta terminada no se edita. Para cambiarla habrá que devolverla a borrador
        desde su propia pantalla.
      </p>
    </div>
  );
}
