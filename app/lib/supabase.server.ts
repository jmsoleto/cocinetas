import { env } from "cloudflare:workers";
import { createServerClient, parseCookieHeader } from "@supabase/ssr";

/**
 * Cliente de Supabase para UNA petición.
 *
 * En Cloudflare Workers no hay estado global entre peticiones, y aunque lo
 * hubiera sería un error usarlo: un cliente a nivel de módulo filtraría la
 * sesión de una persona a la petición de otra. Cada `loader` y cada `action`
 * construye el suyo con las cookies de su propia petición.
 *
 * Devuelve también `headers`. Toda respuesta que salga de una ruta autenticada
 * DEBE propagarlas: son las `Set-Cookie` con las que Supabase renueva la sesión
 * antes de que caduque. Si se pierden, la sesión muere sola a mitad de uso.
 */
export function crearClienteSupabase(request: Request) {
  const headers = new Headers();

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "").map((cookie) => ({
          name: cookie.name,
          value: cookie.value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          headers.append(
            "Set-Cookie",
            serializarCookie(name, value, {
              ...options,
              // La sesión no la lee nunca el JavaScript de la página: solo el
              // servidor. HttpOnly la pone fuera del alcance de cualquier
              // script, y de paso esquiva el tope de siete días que Safari
              // impone a las cookies escritas desde document.cookie.
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: new URL(request.url).protocol === "https:",
            }),
          );
        }
      },
    },
  });

  return { supabase, headers };
}

type OpcionesCookie = {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  secure?: boolean;
  maxAge?: number;
  expires?: Date;
  domain?: string;
};

function serializarCookie(
  nombre: string,
  valor: string,
  opciones: OpcionesCookie,
): string {
  const partes = [`${nombre}=${encodeURIComponent(valor)}`];
  if (opciones.path) partes.push(`Path=${opciones.path}`);
  if (opciones.domain) partes.push(`Domain=${opciones.domain}`);
  if (opciones.maxAge !== undefined) partes.push(`Max-Age=${opciones.maxAge}`);
  if (opciones.expires) partes.push(`Expires=${opciones.expires.toUTCString()}`);
  if (opciones.sameSite) {
    const s = opciones.sameSite;
    partes.push(`SameSite=${s.charAt(0).toUpperCase()}${s.slice(1)}`);
  }
  if (opciones.secure) partes.push("Secure");
  if (opciones.httpOnly) partes.push("HttpOnly");
  return partes.join("; ");
}
