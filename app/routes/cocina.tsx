import { useEffect, useRef } from "react";
import { Form, Link, data, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/cocina";
import { exigirUsuario } from "../lib/session.server";
import {
  anadirADespensa,
  leerCatalogo,
  quitarDeDespensa,
  repartirCocina,
} from "../lib/cocina.server";
import { RUTA_COCINA, RUTA_INGREDIENTES } from "../rutas";
import estilos from "./cocina.module.css";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Mi cocina · Cocinetas" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await exigirUsuario(request);
  const catalogo = await leerCatalogo(supabase);
  return data(repartirCocina(catalogo), { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = await exigirUsuario(request);
  const datos = await request.formData();
  const intencion = String(datos.get("intencion") ?? "");

  const resultado =
    intencion === "quitar"
      ? await quitarDeDespensa(supabase, String(datos.get("ingrediente") ?? ""))
      : await anadirADespensa(supabase, String(datos.get("nombre") ?? ""));

  /* Si algo hay que contar, se cuenta sin recargar; si no, redirección a la
     misma pantalla para que recargar no reenvíe el formulario. En los dos
     casos viajan las `headers`: ahí van las Set-Cookie que renuevan la sesión.
     Perderlas en una acción es la forma más silenciosa de expulsar a alguien. */
  if (resultado.error) return data({ error: resultado.error }, { headers });
  throw redirect(RUTA_COCINA, { headers });
}

export default function Cocina({ loaderData, actionData }: Route.ComponentProps) {
  const { despensa, sugerencias } = loaderData;

  /* Tras añadir con éxito, el campo se vacía y recupera el foco.

     La despensa se llena de seguido, y sin esto el texto anterior se queda
     dentro —el navegador conserva lo tecleado al volver a la misma ruta— y hay
     que borrarlo a mano antes de cada ingrediente.

     Se distingue el alta de la retirada por el `intencion` que viaja en el
     envío: si no se hiciera, quitar un ingrediente de la lista borraría de paso
     lo que estuvieras escribiendo arriba. Y no se vacía cuando la acción
     devuelve error, porque ahí lo escrito es justo lo que hay que corregir. */
  const navegacion = useNavigation();
  const formularioAnadir = useRef<HTMLFormElement>(null);
  const campoAnadir = useRef<HTMLInputElement>(null);
  const eraAlta = useRef(false);

  const enviando = navegacion.state === "submitting";
  const esAlta = navegacion.formData?.get("intencion") !== "quitar";

  useEffect(() => {
    if (enviando) {
      eraAlta.current = esAlta;
      return;
    }
    if (!eraAlta.current) return;
    eraAlta.current = false;
    if (actionData?.error) return;
    formularioAnadir.current?.reset();
    campoAnadir.current?.focus();
  }, [enviando, esAlta, actionData]);

  return (
    <main className="app-main">
      <div className={estilos.pantalla}>
        <div>
          <h1 className={estilos.titulo}>Mi cocina</h1>
          <p className={estilos.entradilla}>Lo que tienes en casa ahora mismo.</p>
        </div>

        {actionData?.error ? <p className={estilos.error}>{actionData.error}</p> : null}

        <Form method="post" className={estilos.anadir} ref={formularioAnadir}>
          <div className="field">
            <label htmlFor="nombre">Añadir un ingrediente</label>
            {/* Un <datalist> y no un desplegable en JavaScript: el navegador lo
                resuelve solo, funciona sin que se ejecute nada del cliente y en
                el móvil usa el selector nativo. */}
            <input
              ref={campoAnadir}
              id="nombre"
              name="nombre"
              className="input"
              list="sugerencias"
              autoComplete="off"
              placeholder="Cebolla, arroz, pimentón…"
              required
            />
            <datalist id="sugerencias">
              {sugerencias.map((ingrediente) => (
                <option key={ingrediente.id} value={ingrediente.nombre} />
              ))}
            </datalist>
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            Añadir
          </button>
        </Form>

        {despensa.length === 0 ? (
          <div className={estilos.vacio}>
            <p className={estilos.vacioTitulo}>Tu despensa está vacía.</p>
            <p className={estilos.vacioTexto}>
              Ve marcando lo que tengas en casa. Cuando haya recetas, Cocinetas usará
              esta lista para decirte cuáles puedes hacer ahora mismo, sin bajar a
              comprar.
            </p>
            <p className={estilos.vacioTexto}>
              La sal, el aceite, la pimienta y el agua se dan por supuestos: no hace
              falta que los añadas.
            </p>
          </div>
        ) : (
          <ul className={estilos.lista}>
            {despensa.map((ingrediente) => (
              <li key={ingrediente.id} className={estilos.entrada}>
                <span className={estilos.nombre}>{ingrediente.nombre}</span>
                <Form method="post">
                  <input type="hidden" name="intencion" value="quitar" />
                  <input type="hidden" name="ingrediente" value={ingrediente.id} />
                  <button
                    type="submit"
                    className="btn btn-ghost btn-icon"
                    aria-label={`Quitar ${ingrediente.nombre} de la despensa`}
                  >
                    ×
                  </button>
                </Form>
              </li>
            ))}
          </ul>
        )}

        <p className={estilos.pie}>
          <Link to={RUTA_INGREDIENTES}>Ver todos mis ingredientes</Link> para
          renombrarlos, fusionarlos o quitarlos del todo.
        </p>
      </div>
    </main>
  );
}
