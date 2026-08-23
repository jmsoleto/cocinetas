import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/registro";
import { crearClienteSupabase } from "../lib/supabase.server";
import { rechazarSiYaEntro } from "../lib/session.server";
import { RUTA_ENTRAR } from "../rutas";
import estilos from "../rutas-auth.module.css";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Crear cuenta · Cocinetas" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await rechazarSiYaEntro(request);
  return null;
}

type Errores = { general?: string; correo?: string; clave?: string; nombre?: string };

export async function action({ request }: Route.ActionArgs) {
  const datos = await request.formData();
  const correo = String(datos.get("correo") ?? "").trim();
  const clave = String(datos.get("clave") ?? "");
  const nombre = String(datos.get("nombre") ?? "").trim();

  const errores: Errores = {};
  if (!nombre) errores.nombre = "Dinos cómo quieres que te llamemos.";
  if (!correo) errores.correo = "Hace falta un correo.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    errores.correo = "Ese correo no tiene buena pinta. Revísalo.";
  if (clave.length < LONGITUD_MINIMA_CLAVE)
    errores.clave = `La contraseña necesita al menos ${LONGITUD_MINIMA_CLAVE} caracteres.`;

  // Se devuelven el correo y el nombre para no obligar a reescribirlos.
  // La contraseña no: nunca vuelve al navegador.
  if (Object.keys(errores).length > 0) return { errores, correo, nombre };

  const { supabase, headers } = crearClienteSupabase(request);
  const { error } = await supabase.auth.signUp({
    email: correo,
    password: clave,
    options: { data: { nombre } },
  });

  if (error) {
    /* No se distingue "ese correo ya tiene cuenta" de cualquier otro fallo:
       decirlo confirmaría a un desconocido qué correos están registrados. */
    return {
      errores: {
        general: "No hemos podido crear la cuenta con esos datos.",
      } satisfies Errores,
      correo,
      nombre,
    };
  }

  throw redirect(`${RUTA_ENTRAR}?confirma=1`, { headers });
}

const LONGITUD_MINIMA_CLAVE = 6;

export default function Registro({ actionData }: Route.ComponentProps) {
  const errores = actionData?.errores;

  return (
    <main className="app-main">
      <div className={estilos.pantalla}>
        <div>
          <h1 className={estilos.titulo}>Crear cuenta</h1>
          <p className={estilos.entradilla}>
            Para guardar tus recetas y lo que tienes en la cocina.
          </p>
        </div>

        {errores?.general ? <p className={estilos.error}>{errores.general}</p> : null}

        <Form method="post" className={estilos.formulario}>
          <div className="field">
            <label htmlFor="nombre">¿Cómo te llamamos?</label>
            <input
              id="nombre"
              name="nombre"
              className="input"
              autoComplete="given-name"
              defaultValue={actionData?.nombre ?? ""}
              required
            />
            {errores?.nombre ? <p className={estilos.error}>{errores.nombre}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="correo">Correo</label>
            <input
              id="correo"
              name="correo"
              type="email"
              className="input"
              autoComplete="email"
              inputMode="email"
              defaultValue={actionData?.correo ?? ""}
              required
            />
            {errores?.correo ? <p className={estilos.error}>{errores.correo}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="clave">Contraseña</label>
            <input
              id="clave"
              name="clave"
              type="password"
              className="input"
              autoComplete="new-password"
              required
            />
            {errores?.clave ? <p className={estilos.error}>{errores.clave}</p> : null}
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            Crear cuenta
          </button>
        </Form>

        <p className={estilos.pie}>
          ¿Ya tienes cuenta? <Link to={RUTA_ENTRAR}>Entra por aquí</Link>.
        </p>
      </div>
    </main>
  );
}
