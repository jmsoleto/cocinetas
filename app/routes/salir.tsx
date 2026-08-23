import { redirect } from "react-router";
import type { Route } from "./+types/salir";
import { crearClienteSupabase } from "../lib/supabase.server";
import { RUTA_ENTRAR } from "../rutas";

/* Solo POST. Un GET que cierre sesión se dispararía con cualquier precarga del
   navegador o etiqueta <img> ajena. */
export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = crearClienteSupabase(request);
  await supabase.auth.signOut();

  /* Sin esto el navegador puede servir la página protegida desde su caché al
     pulsar "atrás", enseñando contenido de una sesión ya cerrada. */
  headers.set("Cache-Control", "no-store, must-revalidate");
  throw redirect(RUTA_ENTRAR, { headers });
}

export async function loader() {
  throw redirect(RUTA_ENTRAR);
}
