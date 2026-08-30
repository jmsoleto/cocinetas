import { redirect } from "react-router";
import { crearClienteSupabase } from "./supabase.server";
import { RUTA_ENTRAR, RUTA_INICIO } from "../rutas";

/**
 * Quién pide esta página, o `null` si nadie ha iniciado sesión.
 *
 * Se usa `getUser()` y no `getSession()`: `getSession()` devuelve lo que diga
 * la cookie sin comprobarlo, y la cookie la controla el cliente. `getUser()`
 * pregunta al servidor de autenticación, que es el único que puede afirmar que
 * el token es auténtico.
 */
export async function obtenerUsuario(request: Request) {
  const { supabase, headers } = crearClienteSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { usuario: user, supabase, headers };
}

/** Igual que el anterior, pero sin sesión no devuelve: redirige a /entrar. */
export async function exigirUsuario(request: Request) {
  const { usuario, supabase, headers } = await obtenerUsuario(request);
  if (!usuario) throw redirect(RUTA_ENTRAR, { headers });
  return { usuario, supabase, headers };
}

/** Para /entrar y /registro: quien ya tiene sesión no debe ver el formulario. */
export async function rechazarSiYaEntro(request: Request) {
  const { usuario, headers } = await obtenerUsuario(request);
  if (usuario) throw redirect(RUTA_INICIO, { headers });
  return { headers };
}
