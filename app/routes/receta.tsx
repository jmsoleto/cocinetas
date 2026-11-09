import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/receta";
import { exigirUsuario } from "../lib/session.server";
import { devolverABorrador, leerReceta } from "../lib/recetario.server";
import { RUTA_RECETAS, rutaEditarReceta } from "../rutas";
import estilos from "./receta.module.css";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.receta?.titulo ?? "Receta"} · Cocinetas` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = await exigirUsuario(request);
  const receta = await leerReceta(supabase, params.id);

  if (!receta) throw data("Esta receta no existe.", { status: 404, headers });

  /* Simétrico al editor, que manda aquí las terminadas: el detalle es de las
     terminadas y el editor de los borradores, sin pantallas que valgan para
     las dos cosas. */
  if (!receta.finalizadaEn) throw redirect(rutaEditarReceta(receta.id), { headers });

  return data({ receta }, { headers });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, headers } = await exigirUsuario(request);
  const resultado = await devolverABorrador(supabase, params.id);
  if (resultado.error) return data({ error: resultado.error }, { headers });
  throw redirect(rutaEditarReceta(params.id), { headers });
}

export default function Receta({ loaderData, actionData }: Route.ComponentProps) {
  const { receta } = loaderData;

  /* Todo esto llega renderizado desde el servidor y se lee sin que se ejecute
     una sola línea de JavaScript. Que el EDITOR no lo prometa no exime a esta
     pantalla: `app-shell` exige que cualquier ruta sea legible, y además es la
     que algún día habrá que poder seguir sin red. */
  return (
    <main className="app-main">
      <article className={estilos.pantalla}>
        <div>
          <h1 className={estilos.titulo}>{receta.titulo}</h1>
          {receta.comensales ? (
            <p className={estilos.entradilla}>Para {receta.comensales} comensales</p>
          ) : null}
        </div>

        {actionData?.error ? <p className={estilos.error}>{actionData.error}</p> : null}

        <section>
          <h2 className={estilos.subtitulo}>Ingredientes</h2>
          <ul className={estilos.ingredientes}>
            {receta.lineas.map((linea) => (
              <li key={linea.id} className={estilos.linea}>
                {linea.cantidad ? (
                  <span className={estilos.cantidad}>{linea.cantidad}</span>
                ) : null}
                <span className={estilos.ingrediente}>{linea.ingrediente}</span>
                {linea.nota ? <span className={estilos.nota}>{linea.nota}</span> : null}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className={estilos.subtitulo}>Pasos</h2>
          <ol className={estilos.pasos}>
            {receta.pasos.map((paso) => {
              const usadas = receta.lineas.filter((l) => paso.lineas.includes(l.id));
              return (
                <li key={paso.id} className={estilos.paso}>
                  <p className={estilos.pasoTexto}>{paso.texto}</p>
                  {/* Los ingredientes de ESE paso al lado. La fase 4 hará de
                      esto una pantalla propia; aquí ya se ve el dato. */}
                  {usadas.length > 0 ? (
                    <p className={estilos.pasoUsa}>
                      {usadas.map((l) => l.ingrediente).join(", ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <div className={estilos.acciones}>
          <Form method="post">
            <button type="submit" className="btn btn-secondary btn-block">
              Volver a borrador para editarla
            </button>
          </Form>
          <p className={estilos.nota}>
            Una receta terminada no se edita. Devolverla a borrador conserva todo lo que
            tiene, y puedes darla por terminada otra vez cuando acabes.
          </p>
        </div>

        <p className={estilos.pie}>
          <Link to={RUTA_RECETAS}>Volver a las recetas</Link>
        </p>
      </article>
    </main>
  );
}
