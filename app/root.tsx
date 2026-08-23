import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";

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
