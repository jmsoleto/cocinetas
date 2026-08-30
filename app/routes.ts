import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // Rutas en español: se ven al compartir y en la barra del navegador antes de
  // instalar, y no hay razón para que sean el único trozo de interfaz en inglés.
  route("entrar", "routes/entrar.tsx"),
  route("registro", "routes/registro.tsx"),
  route("salir", "routes/salir.tsx"),
  route("cocina", "routes/cocina.tsx"),
  route("ingredientes", "routes/ingredientes.tsx"),
] satisfies RouteConfig;
