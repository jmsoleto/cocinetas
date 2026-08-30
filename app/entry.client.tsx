import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { registerSW } from "virtual:pwa-register";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});

/* Registro del service worker.

   vite-plugin-pwa normalmente inyecta esto transformando index.html, pero una
   aplicación SSR de React Router no tiene index.html: el HTML lo emite
   root.tsx. Se registra aquí, en el punto de entrada del cliente, que es donde
   la documentación del plugin manda hacerlo en frameworks con servidor.

   El service worker existe para que el navegador ofrezca instalar la
   aplicación y para precachear los assets del cliente. Las navegaciones NO se
   sirven desde caché: cada una va a la red y la resuelve el Worker, que es
   quien conoce la sesión. */
registerSW({ immediate: true });
