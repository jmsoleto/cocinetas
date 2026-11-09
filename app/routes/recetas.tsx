import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/recetas";
import { exigirUsuario } from "../lib/session.server";
import {
  barrerBorradoresVacios,
  crearBorrador,
  descartarReceta,
  leerRecetario,
} from "../lib/recetario.server";
import { CuantoTienes } from "../componentes/cobertura";
import {
  PARAM_SOLO,
  RUTA_COCINA,
  RUTA_RECETAS,
  RUTA_RECETAS_EN_CASA,
  SOLO_EN_CASA,
  rutaEditarReceta,
  rutaReceta,
} from "../rutas";
import estilos from "./recetas.module.css";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Recetas · Cocinetas" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await exigirUsuario(request);
  const soloEnCasa = new URL(request.url).searchParams.get(PARAM_SOLO) === SOLO_EN_CASA;
  const recetario = await leerRecetario(supabase);
  return data({ ...recetario, soloEnCasa }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { usuario, supabase, headers } = await exigirUsuario(request);
  const datos = await request.formData();
  const intencion = String(datos.get("intencion") ?? "");

  if (intencion === "descartar") {
    const resultado = await descartarReceta(
      supabase,
      String(datos.get("receta") ?? ""),
    );
    if (resultado.error) return data({ error: resultado.error }, { headers });
    throw redirect(RUTA_RECETAS, { headers });
  }

  /* Crear. La fila tiene que existir ANTES de pintar el editor: se guarda al
     vuelo, y el guardado al vuelo no tiene dónde escribir si no hay receta. */
  await barrerBorradoresVacios(supabase);
  const { id, error } = await crearBorrador(supabase, usuario.id);
  if (error || !id)
    return data({ error: error ?? "No se pudo crear la receta." }, { headers });
  throw redirect(rutaEditarReceta(id), { headers });
}

export default function Recetas({ loaderData, actionData }: Route.ComponentProps) {
  const { soloEnCasa } = loaderData;
  const vacio =
    loaderData.terminadas.length === 0 && loaderData.borradores.length === 0;

  /* Con el filtro puesto se ocultan también los borradores: la pregunta es «qué
     puedo cocinar», y un borrador no se cocina. */
  const terminadas = soloEnCasa
    ? loaderData.terminadas.filter((r) => r.cobertura?.faltan === 0)
    : loaderData.terminadas;
  const borradores = soloEnCasa ? [] : loaderData.borradores;

  return (
    <main className="app-main">
      <div className={estilos.pantalla}>
        <div>
          <h1 className={estilos.titulo}>Recetas</h1>
          <p className={estilos.entradilla}>
            Lo que sabes hacer, y lo que estás escribiendo.
          </p>
        </div>

        {actionData?.error ? <p className={estilos.error}>{actionData.error}</p> : null}

        <Form method="post">
          <button type="submit" className="btn btn-primary btn-block">
            Nueva receta
          </button>
        </Form>

        {loaderData.terminadas.length > 0 ? <Filtro soloEnCasa={soloEnCasa} /> : null}

        {soloEnCasa && terminadas.length === 0 ? (
          <div className={estilos.vacio} role="status">
            <p className={estilos.vacioTitulo}>
              Con lo que tienes en casa no llegas a ninguna.
            </p>
            <p className={estilos.vacioTexto}>
              A todas tus recetas les falta algo. Quita el filtro para ver cuánto le
              falta a cada una: arriba de la lista están las que menos.
            </p>
            <p className={estilos.vacioTexto}>
              <Link to={RUTA_RECETAS}>Ver todas las recetas</Link>
            </p>
          </div>
        ) : null}

        {vacio ? (
          <div className={estilos.vacio}>
            <p className={estilos.vacioTitulo}>Todavía no hay ninguna receta.</p>
            <p className={estilos.vacioTexto}>
              Escribe la primera. Empieza siendo un borrador: puedes dejarla a medias y
              volver cuando quieras, porque se guarda sola mientras escribes.
            </p>
            <p className={estilos.vacioTexto}>
              Los ingredientes que teclees se van quedando en tu cocina, así que la
              siguiente receta te los irá sugiriendo.
            </p>
          </div>
        ) : null}

        {borradores.length > 0 ? (
          <section className={estilos.seccion}>
            {/* Aparte de las terminadas y con su propio encabezado: un borrador
                no se puede cocinar, y confundirlos es lo que esta separación
                existe para impedir. */}
            <h2 className={estilos.seccionTitulo}>Borradores</h2>
            <ul className={estilos.lista}>
              {borradores.map((receta) => (
                <li key={receta.id} className={estilos.entrada}>
                  <Link to={rutaEditarReceta(receta.id)} className={estilos.enlace}>
                    <span className={estilos.nombre}>
                      {receta.titulo?.trim() || "Sin título"}
                    </span>
                    {receta.vacia ? (
                      <span className="tag tag-neutral">vacío</span>
                    ) : null}
                  </Link>
                  <Descartar receta={receta.id} conContenido={!receta.vacia} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {terminadas.length > 0 ? (
          <section className={estilos.seccion}>
            <h2 className={estilos.seccionTitulo}>
              {soloEnCasa ? "Con lo que tienes en casa" : "Terminadas"}
            </h2>
            <ul className={estilos.lista}>
              {terminadas.map((receta) => (
                <li key={receta.id} className={estilos.entrada}>
                  <Link to={rutaReceta(receta.id)} className={estilos.enlaceReceta}>
                    <span className={estilos.nombre}>{receta.titulo}</span>
                    {receta.cobertura ? (
                      <CuantoTienes cobertura={receta.cobertura} />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className={estilos.pie}>
          <Link to={RUTA_COCINA}>Volver a mi cocina</Link>
        </p>
      </div>
    </main>
  );
}

/* El filtro es un enlace, no un interruptor: funciona sin JavaScript, sobrevive
   a una recarga y se puede compartir. Mientras está puesto lo dice, porque lo
   que se ve deja de ser el recetario entero. */
function Filtro({ soloEnCasa }: { soloEnCasa: boolean }) {
  if (!soloEnCasa) {
    return (
      <p className={estilos.filtro}>
        <Link to={RUTA_RECETAS_EN_CASA} className="btn btn-secondary">
          Solo con lo que tengo en casa
        </Link>
      </p>
    );
  }
  return (
    <p className={estilos.filtro}>
      <span className="tag tag-accent">Solo con lo que tienes en casa</span>
      <Link to={RUTA_RECETAS} className="btn btn-ghost">
        Quitar el filtro
      </Link>
    </p>
  );
}

/* Descartar un borrador VACÍO no borra nada que exista, así que va directo.
   Uno con contenido es trabajo, y pide confirmación aparte — con <details> y no
   con un confirm() del navegador: se abre y se cierra sin ejecutar nada, y un
   diálogo del sistema no se puede redactar en el idioma de la aplicación. */
function Descartar({
  receta,
  conContenido,
}: {
  receta: string;
  conContenido: boolean;
}) {
  if (!conContenido) {
    return (
      <Form method="post">
        <input type="hidden" name="intencion" value="descartar" />
        <input type="hidden" name="receta" value={receta} />
        <button type="submit" className="btn btn-ghost">
          Descartar
        </button>
      </Form>
    );
  }

  return (
    <details className={estilos.confirmar}>
      <summary className="btn btn-ghost">Descartar</summary>
      <div className={estilos.confirmarCuerpo}>
        <p className={estilos.vacioTexto}>
          Este borrador tiene contenido. Descartarlo lo borra entero y no se puede
          deshacer.
        </p>
        <Form method="post">
          <input type="hidden" name="intencion" value="descartar" />
          <input type="hidden" name="receta" value={receta} />
          <button type="submit" className="btn btn-secondary">
            Sí, descartarlo
          </button>
        </Form>
      </div>
    </details>
  );
}
