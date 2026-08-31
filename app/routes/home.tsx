import { Form, Link, data } from "react-router";
import type { Route } from "./+types/home";
import { exigirUsuario } from "../lib/session.server";
import { RUTA_COCINA, RUTA_RECETAS } from "../rutas";
import estilos from "./home.module.css";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Cocinetas" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { usuario, supabase, headers } = await exigirUsuario(request);

  /* RLS hace que esta consulta solo pueda devolver el perfil propio, así que
     no hace falta filtrar por id: aunque este código se equivocara, la base de
     datos no entregaría la fila de otra persona. */
  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre")
    .single<{ nombre: string }>();

  // `data()` en vez de Response.json: conserva el tipo de loaderData en el
  // componente. Propagar las cabeceras es lo que mantiene viva la sesión —
  // aquí viajan las Set-Cookie con las que Supabase la renueva.
  return data({ nombre: perfil?.nombre ?? usuario.email }, { headers });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="app-main">
      <div className={estilos.saludo}>
        <h1 className={estilos.titulo}>Hola, {loaderData.nombre}</h1>
        <p className={estilos.entradilla}>
          Tus recetas y lo que tienes en casa, para saber qué puedes cocinar hoy.
        </p>

        {/* El recetario pasa a ser lo primero: era la promesa del producto y
            hasta ahora esta pantalla mandaba a la despensa porque no había otra
            cosa. La cocina sigue a un toque, que es donde se siembra el
            vocabulario que el editor autocompleta. */}
        <div className={estilos.acciones}>
          <Link to={RUTA_RECETAS} className="btn btn-primary btn-block">
            Recetas
          </Link>
        </div>

        <div className={estilos.acciones}>
          <Link to={RUTA_COCINA} className="btn btn-secondary btn-block">
            Mi cocina
          </Link>
        </div>

        <div className={estilos.acciones}>
          <Form method="post" action="/salir">
            <button type="submit" className="btn btn-secondary">
              Cerrar sesión
            </button>
          </Form>
        </div>
      </div>
    </main>
  );
}
