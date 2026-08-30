import { reactRouter } from "@react-router/dev/vite";
import { VitePWA } from "vite-plugin-pwa";

/* Fuente única del nombre y los colores de marca. Vive en JSON y no en este
   fichero porque la regla de adherencia de Nocturne prohíbe hexadecimales en
   TS/TSX, y con razón: el único sitio legítimo para un color literal es la
   metadata que consume el navegador, no el código. root.tsx lee el mismo
   fichero para la etiqueta <meta name="theme-color">. */
import marca from "./app/marca.json";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    reactRouter(),
    ...VitePWA({
      /* React Router escribe el cliente en build/client, pero vite-plugin-pwa
         asume el `dist/` por defecto de Vite: sin esto, sw.js acaba en dist/ y
         registerSW.js pide /sw.js, que devuelve 404 — y sin service worker
         servido el navegador no ofrece instalar la aplicación. */
      outDir: "build/client",
      // La aplicación se renderiza en servidor: el service worker existe para
      // que el navegador ofrezca instalarla y para precachear los assets del
      // cliente, NO para servir navegaciones desde caché. Por eso no hay
      // navigateFallback: cada navegación va a la red y la resuelve el Worker.
      registerType: "autoUpdate",
      /* Nada que inyectar: `injectRegister` transforma index.html, que en una
         aplicación SSR de React Router no existe. El registro se hace a mano
         en app/entry.client.tsx con virtual:pwa-register. */
      injectRegister: null,
      manifest: {
        name: marca.nombre,
        short_name: marca.nombreCorto,
        description: marca.descripcion,
        lang: "es",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: marca.colorTema,
        background_color: marca.colorFondo,
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,woff2,png,svg,ico}"],
        navigateFallback: null,
      },
      devOptions: { enabled: false },
      /* Sin esto el plugin corre también en el entorno SSR y duplica
         manifest y registerSW dentro de build/server, que es el Worker. */
    }).map((plugin) => ({
      ...plugin,
      applyToEnvironment: (entorno: { name: string }) => entorno.name === "client",
    })),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  css: {
    modules: {
      // Nombre legible en desarrollo para poder seguir la clase en las
      // herramientas del navegador; hash a secas en producción.
      generateScopedName:
        process.env.NODE_ENV === "production"
          ? "[hash:base64:6]"
          : "[name]__[local]__[hash:base64:4]",
      localsConvention: "camelCaseOnly",
    },
  },
});
