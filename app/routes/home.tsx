import type { Route } from "./+types/home";
import estilos from "./home.module.css";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Cocinetas" }];
}

export default function Home() {
  return (
    <main className="app-main">
      <div className={estilos.saludo}>
        <h1 className={estilos.titulo}>Hola, mundo</h1>
        <p className={estilos.entradilla}>
          El esqueleto está montado. Aquí irá el recetario.
        </p>
      </div>
    </main>
  );
}
