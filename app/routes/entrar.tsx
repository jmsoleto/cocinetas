import { Form, Link, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/entrar";
import { crearClienteSupabase } from "../lib/supabase.server";
import { rechazarSiYaEntro } from "../lib/session.server";
import { RUTA_INICIO } from "../rutas";
import estilos from "../rutas-auth.module.css";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Entrar · Cocinetas" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await rechazarSiYaEntro(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const datos = await request.formData();
  const correo = String(datos.get("correo") ?? "").trim();
  const clave = String(datos.get("clave") ?? "");

  const { supabase, headers } = crearClienteSupabase(request);
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: clave,
  });

  if (error) {
    /* Un correo sin confirmar sí se distingue, porque decirlo no revela nada
       que la persona no sepa ya: acaba de registrarse. Todo lo demás cae en el
       mismo mensaje genérico — separar "no existe" de "clave incorrecta"
       convertiría el formulario en un buscador de correos registrados. */
    const sinConfirmar = error.code === "email_not_confirmed";
    return {
      error: sinConfirmar
        ? "Te falta confirmar el correo. Mira tu bandeja de entrada."
        : "Correo o contraseña incorrectos.",
      correo,
    };
  }

  throw redirect(RUTA_INICIO, { headers });
}

export default function Entrar({ actionData }: Route.ComponentProps) {
  const [parametros] = useSearchParams();
  const acabaDeRegistrarse = parametros.get("confirma") === "1";

  return (
    <main className="app-main">
      <div className={estilos.pantalla}>
        <div>
          <h1 className={estilos.titulo}>Entrar</h1>
          <p className={estilos.entradilla}>Tu recetario te espera.</p>
        </div>

        {acabaDeRegistrarse ? (
          <p className={estilos.aviso}>
            Cuenta creada. Te hemos enviado un correo para confirmarla: ábrelo antes de
            entrar.
          </p>
        ) : null}

        {actionData?.error ? <p className={estilos.error}>{actionData.error}</p> : null}

        <Form method="post" className={estilos.formulario}>
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
          </div>

          <div className="field">
            <label htmlFor="clave">Contraseña</label>
            <input
              id="clave"
              name="clave"
              type="password"
              className="input"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            Entrar
          </button>
        </Form>

        <p className={estilos.pie}>
          ¿Aún no tienes cuenta? <Link to="/registro">Créala aquí</Link>.
        </p>
      </div>
    </main>
  );
}
