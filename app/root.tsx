import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import marca from "./marca.json";

/* Orden deliberado: los tokens y el reset de Nocturne primero, la paleta miga
   encima —redefine los tokens y sanea las reglas escritas para fondo oscuro—,
   y el shell propio al final. Cambiar el orden rompe la cascada. */
import "./styles/nocturne.css";
import "./styles/miga.css";
import "./styles/app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  /* Solo en producción: vite-plugin-pwa genera el manifest al construir y no
     lo sirve en desarrollo (devOptions desactivado, para que el service worker
     no se meta en medio del recargado en caliente). Sin esta condición, cada
     página de dev registra dos 404 en la consola — ruido que acaba tapando
     errores de verdad. La instalabilidad se prueba contra el build, que es
     donde se mide de todas formas. */
  ...(import.meta.env.PROD ? [{ rel: "manifest", href: "/manifest.webmanifest" }] : []),
  /* iOS ignora por completo los iconos del manifest y usa este. Sin él, el
     icono de la pantalla de inicio sería una miniatura de la página. */
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        {/* viewport-fit=cover deja que el contenido llegue bajo la muesca y el
            indicador de gestos; app.css lo compensa con env(safe-area-inset-*). */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* Tiñe la barra de estado en Android. El valor sale de marca.json
            para no repetir el hexadecimal ni saltarse la regla de adherencia. */}
        <meta name="theme-color" content={marca.colorTema} />
        {/* iOS no lee el manifest para nada de esto: necesita sus etiquetas.
            `capable` abre la aplicación sin barra de direcciones; el estilo de
            barra `default` deja el texto oscuro, que es lo que pide un fondo
            claro como el de miga. */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* El estándar es el de arriba; este lo mantienen las versiones de iOS
            que aún no leen el otro. Chrome avisa de que está obsoleto, pero
            quitarlo rompería la instalación en iOS antiguo. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={marca.nombreCorto} />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="app-shell">{children}</div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Algo se ha torcido";
  let detail = "Ha ocurrido un error inesperado.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "No encontrado" : "Error";
    detail =
      error.status === 404 ? "Esta página no existe." : error.statusText || detail;
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
    stack = error.stack;
  }

  return (
    <main className="app-main">
      <h1>{title}</h1>
      <p>{detail}</p>
      {stack ? (
        <pre>
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  );
}
