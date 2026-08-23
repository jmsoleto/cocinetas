import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
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
