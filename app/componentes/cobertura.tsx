import type { Cobertura, EstadoLinea } from "../lib/recetario.server";
import estilos from "./cobertura.module.css";

/* Cómo se cuenta lo que tienes de una receta. Vive aquí, y no en cada pantalla,
 * porque la lista y el detalle tienen que decir lo mismo de la misma receta: el
 * número sale de una sola vista de la base de datos, y la forma de contarlo, de
 * un solo componente. */

/**
 * «Tienes todo», o «4/7» y, si faltan uno o dos, cuáles.
 *
 * «Tienes todo» va sin número, también para una receta de solo básicos: ahí
 * hay cero necesarios, y «0/0» no le dice nada a nadie. Los que faltan se
 * nombran cuando son pocos porque es lo que decide si bajas a la tienda; con
 * más, el nombre ya no cabe y el número basta.
 */
export function CuantoTienes({ cobertura }: { cobertura: Cobertura }) {
  if (cobertura.faltan === 0) {
    return <span className="tag tag-accent">Tienes todo</span>;
  }

  const { faltanNombres } = cobertura;
  const nombrados =
    faltanNombres.length > 0 && faltanNombres.length <= 2
      ? `${faltanNombres.length === 1 ? "Falta" : "Faltan"}: ${faltanNombres.join(" y ")}`
      : null;

  return (
    <span className={estilos.cuanto}>
      {/* «4/7» se lee en voz alta como «cuatro séptimos»: al lector de pantalla
          se le da la frase entera y a la vista, la fracción. */}
      <span aria-hidden="true">
        {cobertura.tienes}/{cobertura.necesarios}
      </span>
      <span className={estilos.oculto}>
        Tienes {cobertura.tienes} de {cobertura.necesarios} ingredientes.
      </span>
      {nombrados ? <span className={estilos.faltan}>{nombrados}</span> : null}
    </span>
  );
}

/* Las mismas palabras que la pantalla de Mi cocina, que ya llama así a lo que
   está en la despensa y a lo que se da por supuesto. Es texto y no solo color:
   el estado tiene que entenderse sin distinguir colores y con un lector de
   pantalla. */
const ETIQUETA: Record<EstadoLinea, { texto: string; clase: string }> = {
  tiene: { texto: "en la despensa", clase: "tag tag-accent" },
  falta: { texto: "falta", clase: "tag tag-outline" },
  supuesto: { texto: "se da por supuesto", clase: "tag tag-neutral" },
  opcional: { texto: "opcional", clase: "tag tag-neutral" },
};

/** El estado de una línea de la receta frente a la despensa. */
export function EstadoDeLinea({ estado }: { estado: EstadoLinea }) {
  const { texto, clase } = ETIQUETA[estado];
  return <span className={clase}>{texto}</span>;
}
