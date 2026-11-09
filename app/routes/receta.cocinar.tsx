import { useEffect, useRef } from "react";
import {
  Link,
  data,
  redirect,
  useNavigate,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import type { Route } from "./+types/receta.cocinar";
import { exigirUsuario } from "../lib/session.server";
import { leerReceta, type LineaReceta, type PasoReceta } from "../lib/recetario.server";
import { Deslizable } from "../componentes/deslizar";
import { useMantenerPantalla } from "../componentes/pantalla";
import { PARAM_PASO, rutaCocinar, rutaEditarReceta, rutaReceta } from "../rutas";
import estilos from "./receta.cocinar.module.css";

/* El modo cocina: «Antes de empezar» y después un paso por pantalla.
 *
 * Es UNA ruta con el paso en `?paso=`. La receta se lee una vez, en la primera
 * carga, y cambiar de paso ya no vuelve al servidor (ver `shouldRevalidate`).
 * Los controles son enlaces de verdad: sin JavaScript el navegador los sigue y
 * el servidor pinta el paso, y con JavaScript se quedan en el cliente. Es la D1
 * del diseño de add-cook-mode.
 *
 * No escribe nada: ni hay `action`, ni guarda por dónde ibas. */

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Cocinar ${loaderData?.receta?.titulo ?? "receta"} · Cocinetas` }];
}

/** El número de paso de la URL, o `null` si no hay o no es uno de esta receta.
 *  `null` es «Antes de empezar». */
function pasoDeLaUrl(valor: string | null, total: number): number | null {
  if (valor === null || !/^\d+$/.test(valor)) return null;
  const n = Number(valor);
  return n >= 1 && n <= total ? n : null;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = await exigirUsuario(request);
  const receta = await leerReceta(supabase, params.id);

  /* Ajena o inexistente, igual: la RLS no deja verla, y no se distingue. */
  if (!receta) throw data("Esta receta no existe.", { status: 404, headers });

  /* Un borrador no se cocina: puede tener pasos a medias o ninguno. Se manda a
     su editor, como hace el detalle. */
  if (!receta.finalizadaEn) throw redirect(rutaEditarReceta(receta.id), { headers });

  /* Un paso que la receta no tiene lleva a «Antes de empezar», y con la URL
     limpia: que la dirección no diga «paso 9» mientras se ve otra cosa. */
  const valor = new URL(request.url).searchParams.get(PARAM_PASO);
  if (valor !== null && pasoDeLaUrl(valor, receta.pasos.length) === null) {
    throw redirect(rutaCocinar(receta.id), { headers });
  }

  return data({ receta }, { headers });
}

/* Lo que hace instantáneo el cambio de paso. Ir de `?paso=2` a `?paso=3` es la
   misma ruta con otra búsqueda, y la receta que ya está cargada sirve: una
   receta terminada no se edita, así que no puede haber cambiado mientras
   alguien la cocina. Cualquier otra navegación vuelve a leer, como siempre. */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formData,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formData && currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function Cocinar({ loaderData }: Route.ComponentProps) {
  const { receta } = loaderData;
  const [busqueda] = useSearchParams();
  const navegar = useNavigate();
  const pantallaMantenida = useMantenerPantalla();

  const total = receta.pasos.length;
  const paso = pasoDeLaUrl(busqueda.get(PARAM_PASO), total);
  /* `pasoDeLaUrl` ya garantiza que el número está en rango; esto es para que
     el tipo lo sepa también. */
  const pasoActual = paso === null ? undefined : receta.pasos[paso - 1];

  /* Los destinos, calculados una vez y compartidos por los enlaces y por el
     deslizamiento, para que los dos gestos lleven siempre al mismo sitio. */
  const anterior = paso === null ? null : rutaCocinar(receta.id, paso - 1 || undefined);
  const siguiente =
    paso === null
      ? rutaCocinar(receta.id, 1)
      : paso < total
        ? rutaCocinar(receta.id, paso + 1)
        : null;

  /* Al cambiar de pantalla, el foco va a su encabezado: así un lector de
     pantalla anuncia «Paso 3 de 7» y sigue leyendo desde ahí, en vez de
     quedarse en un «Siguiente» que ya no tiene contexto. En la primera carga no
     se roba el foco (D5). */
  const encabezado = useRef<HTMLHeadingElement>(null);
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    encabezado.current?.focus();
  }, [paso]);

  const salir = rutaReceta(receta.id);

  return (
    <main className={estilos.pantalla}>
      <div className={estilos.barra}>
        <Link to={salir} className="btn btn-ghost">
          Salir
        </Link>
        {/* Solo cuando el bloqueo está activo de verdad. Si el dispositivo no
            lo permite, no se dice nada: un «no se ha podido» solo estorbaría. */}
        {pantallaMantenida ? (
          <span className={estilos.aviso} role="status">
            La pantalla no se apagará
          </span>
        ) : null}
      </div>

      <Deslizable
        className={estilos.contenido}
        alAnterior={anterior ? () => navegar(anterior) : undefined}
        alSiguiente={siguiente ? () => navegar(siguiente) : undefined}
      >
        {paso === null || !pasoActual ? (
          <AntesDeEmpezar receta={receta} encabezado={encabezado} />
        ) : (
          <Paso
            paso={pasoActual}
            numero={paso}
            total={total}
            lineas={receta.lineas}
            encabezado={encabezado}
          />
        )}
      </Deslizable>

      <nav className={estilos.controles} aria-label="Pasos de la receta">
        {anterior ? (
          <Link to={anterior} className={`btn btn-secondary ${estilos.control}`}>
            Anterior
          </Link>
        ) : null}
        {siguiente ? (
          <Link to={siguiente} className={`btn btn-primary ${estilos.control}`}>
            {paso === null ? "Empezar" : "Siguiente"}
          </Link>
        ) : (
          /* El último paso no avanza: termina. Lo dice así, y solo este control
             lo hace — deslizar en el último paso no saca a nadie de la receta. */
          <Link to={salir} className={`btn btn-primary ${estilos.control}`}>
            Terminar
          </Link>
        )}
      </nav>
    </main>
  );
}

function AntesDeEmpezar({
  receta,
  encabezado,
}: {
  receta: { titulo: string | null; lineas: LineaReceta[] };
  encabezado: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className={estilos.seccion}>
      <p className={estilos.receta}>{receta.titulo}</p>
      <h1 ref={encabezado} tabIndex={-1} className={estilos.encabezado}>
        Antes de empezar
      </h1>
      <p className={estilos.entradilla}>Saca todo esto antes de encender el fuego.</p>
      <Ingredientes lineas={receta.lineas} />
    </section>
  );
}

function Paso({
  paso,
  numero,
  total,
  lineas,
  encabezado,
}: {
  paso: PasoReceta;
  numero: number;
  total: number;
  lineas: LineaReceta[];
  encabezado: React.RefObject<HTMLHeadingElement | null>;
}) {
  /* Las líneas que declara ESTE paso, en el orden de la receta. Apunta a la
     línea y no al ingrediente, así que con dos líneas de aceite cada paso
     enseña la suya con su cantidad. */
  const usadas = lineas.filter((l) => paso.lineas.includes(l.id));

  return (
    <section className={estilos.seccion}>
      <h1 ref={encabezado} tabIndex={-1} className={estilos.encabezado}>
        Paso {numero} de {total}
      </h1>
      <p className={estilos.texto}>{paso.texto}</p>
      {/* Un paso sin ingredientes es normal («precalienta el horno»): ni lista
          vacía ni aviso. */}
      {usadas.length > 0 ? <Ingredientes lineas={usadas} /> : null}
    </section>
  );
}

function Ingredientes({ lineas }: { lineas: LineaReceta[] }) {
  return (
    <ul className={estilos.ingredientes}>
      {lineas.map((linea) => (
        <li key={linea.id} className={estilos.linea}>
          {linea.cantidad ? (
            <span className={estilos.cantidad}>{linea.cantidad}</span>
          ) : null}
          <span className={estilos.ingrediente}>{linea.ingrediente}</span>
          {linea.nota ? <span className={estilos.nota}>{linea.nota}</span> : null}
          {linea.opcional ? <span className="tag tag-neutral">opcional</span> : null}
        </li>
      ))}
    </ul>
  );
}
