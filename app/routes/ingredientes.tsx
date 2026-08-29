import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/ingredientes";
import { exigirUsuario } from "../lib/session.server";
import {
  cambiarSeAsume,
  eliminarIngrediente,
  fusionarIngredientes,
  leerCatalogo,
  renombrarIngrediente,
} from "../lib/cocina.server";
import { RUTA_COCINA, RUTA_INGREDIENTES } from "../rutas";
import estilos from "./ingredientes.module.css";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Mis ingredientes · Cocinetas" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await exigirUsuario(request);
  return data({ catalogo: await leerCatalogo(supabase) }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = await exigirUsuario(request);
  const datos = await request.formData();
  const intencion = String(datos.get("intencion") ?? "");
  const id = String(datos.get("ingrediente") ?? "");

  let resultado;
  switch (intencion) {
    case "renombrar":
      resultado = await renombrarIngrediente(
        supabase,
        id,
        String(datos.get("nombre") ?? ""),
      );
      break;
    case "asumir":
      resultado = await cambiarSeAsume(supabase, id, datos.get("valor") === "si");
      break;
    case "fusionar":
      resultado = await fusionarIngredientes(
        supabase,
        id,
        String(datos.get("destino") ?? ""),
      );
      break;
    case "eliminar":
      resultado = await eliminarIngrediente(supabase, id);
      break;
    default:
      resultado = { error: "No sé qué hacer con eso." };
  }

  /* El error se devuelve junto al id del ingrediente al que se refiere: sin él
     el mensaje aparecería suelto arriba, lejos de la ficha que lo provocó, y en
     una lista larga no se sabría de cuál habla. */
  if (resultado.error)
    return data({ error: resultado.error, ingrediente: id }, { headers });
  throw redirect(RUTA_INGREDIENTES, { headers });
}

export default function Ingredientes({ loaderData, actionData }: Route.ComponentProps) {
  const { catalogo } = loaderData;

  return (
    <main className="app-main">
      <div className={estilos.pantalla}>
        <div>
          <h1 className={estilos.titulo}>Mis ingredientes</h1>
          <p className={estilos.entradilla}>
            Tu vocabulario. Escribir una palabra la mete aquí, así que aquí es donde se
            arregla.
          </p>
        </div>

        {catalogo.length === 0 ? (
          <p className={estilos.vacioTexto}>
            Todavía no has escrito ningún ingrediente. Empieza por{" "}
            <Link to={RUTA_COCINA}>tu cocina</Link>.
          </p>
        ) : (
          <ul className={estilos.lista}>
            {catalogo.map((ingrediente) => {
              const otros = catalogo.filter((o) => o.id !== ingrediente.id);
              const error =
                actionData?.ingrediente === ingrediente.id ? actionData.error : null;

              return (
                <li key={ingrediente.id}>
                  {/* <details> y no un panel desplegable en JavaScript: se abre
                      y se cierra sin que se ejecute nada del cliente. */}
                  <details className={estilos.ficha}>
                    <summary className={estilos.cabecera}>
                      <span className={estilos.nombre}>{ingrediente.nombre}</span>
                      {ingrediente.seAsume ? (
                        <span className="tag tag-neutral">se da por supuesto</span>
                      ) : null}
                      {ingrediente.enDespensa ? (
                        <span className="tag tag-accent">en la despensa</span>
                      ) : null}
                    </summary>

                    <div className={estilos.cuerpo}>
                      {error ? <p className={estilos.error}>{error}</p> : null}

                      <Form method="post" className={estilos.fila}>
                        <input type="hidden" name="intencion" value="renombrar" />
                        <input
                          type="hidden"
                          name="ingrediente"
                          value={ingrediente.id}
                        />
                        <input
                          name="nombre"
                          className="input"
                          defaultValue={ingrediente.nombre}
                          aria-label={`Nombre de ${ingrediente.nombre}`}
                          required
                        />
                        <button type="submit" className="btn btn-secondary">
                          Guardar
                        </button>
                      </Form>

                      {otros.length > 0 ? (
                        <Form method="post" className={estilos.fila}>
                          <input type="hidden" name="intencion" value="fusionar" />
                          <input
                            type="hidden"
                            name="ingrediente"
                            value={ingrediente.id}
                          />
                          <select
                            name="destino"
                            className="input"
                            aria-label={`Fusionar ${ingrediente.nombre} dentro de`}
                            required
                          >
                            <option value="">Fusionar dentro de…</option>
                            {otros.map((otro) => (
                              <option key={otro.id} value={otro.id}>
                                {otro.nombre}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="btn btn-secondary">
                            Fusionar
                          </button>
                        </Form>
                      ) : null}

                      <div className={estilos.acciones}>
                        <Form method="post">
                          <input type="hidden" name="intencion" value="asumir" />
                          <input
                            type="hidden"
                            name="ingrediente"
                            value={ingrediente.id}
                          />
                          <input
                            type="hidden"
                            name="valor"
                            value={ingrediente.seAsume ? "no" : "si"}
                          />
                          <button type="submit" className="btn btn-ghost">
                            {ingrediente.seAsume
                              ? "Dejar de darlo por supuesto"
                              : "Darlo por supuesto"}
                          </button>
                        </Form>

                        <Form method="post">
                          <input type="hidden" name="intencion" value="eliminar" />
                          <input
                            type="hidden"
                            name="ingrediente"
                            value={ingrediente.id}
                          />
                          <button type="submit" className="btn btn-ghost">
                            Eliminar
                          </button>
                        </Form>
                      </div>

                      <p className={estilos.nota}>
                        Fusionar no se puede deshacer: el ingrediente elegido desaparece
                        y todo lo que lo usaba pasa a usar este.
                      </p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        <p className={estilos.pie}>
          <Link to={RUTA_COCINA}>Volver a mi cocina</Link>
        </p>
      </div>
    </main>
  );
}
