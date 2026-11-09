import { useCallback, useEffect, useRef, useState } from "react";

/* Reordenar arrastrando, a mano y sin dependencia.
 *
 * POR QUÉ NO `draggable`: la API nativa de arrastrar y soltar es de ratón. En
 * iOS no ocurre absolutamente nada, y ese es el dispositivo objetivo. Hay que
 * ir por Pointer Events.
 *
 * POR QUÉ NO UNA LIBRERÍA: hoy la aplicación no envía una sola línea de
 * JavaScript propio, y esta sería su primera dependencia de cliente. El caso es
 * el más simple que existe —una lista vertical, arrastre iniciado en un asa, de
 * diez elementos—, que es justo donde una librería de arrastrar y soltar aporta
 * menos: su valor está en las listas anidadas, la detección de colisiones y la
 * virtualización, nada de lo cual pasa aquí. Si en un dispositivo real esto
 * resulta insufrible, dnd-kit es la salida y este fichero desaparece entero.
 *
 * POR QUÉ UN ASA Y NO LA FILA: dentro de una lista que se desplaza en vertical,
 * arrastrar y desplazar son el mismo gesto para un dedo. El asa es lo que los
 * desambigua, y por eso lleva `touch-action: none` en el CSS: sin eso el
 * navegador se queda el gesto y hace scroll.
 *
 * CÓMO SE VE: la lista se reordena en vivo mientras el dedo cruza cada hueco,
 * en lugar de que el elemento siga al dedo píxel a píxel. Es bastante menos
 * código y encaja con listas cortas. Si hiciera falta el seguimiento fino, el
 * sitio es aquí, con un `transform` sobre el elemento levantado. */

/** Devuelve una lista nueva con `id` llevado a `destino`. Pura, a propósito:
 *  así el que llama se queda con el resultado en la mano y no tiene que esperar
 *  a que React vuelva a renderizar para saber qué mandar al servidor. */
function reubicar(lista: string[], id: string, destino: number): string[] {
  const desde = lista.indexOf(id);
  if (desde === -1 || destino < 0 || destino >= lista.length || desde === destino) {
    return lista;
  }
  const copia = lista.slice();
  copia.splice(desde, 1);
  copia.splice(destino, 0, id);
  return copia;
}

export function useOrdenable(ids: string[], alSoltar: (ids: string[]) => void) {
  const [orden, setOrden] = useState<string[]>(ids);
  /* `levantado` va en estado Y en referencia, y la referencia NO es un lujo.
     El estado solo sirve para pintar la fila distinta. La guarda de
     `pointermove` tiene que leer la referencia, porque entre el `pointerdown`
     y los primeros movimientos puede no haber dado tiempo a un render: con un
     gesto rápido, un estado todavía en `null` se traga los primeros
     movimientos, y si se los traga todos el gesto entero no hace nada. Medido
     con eventos reales, no supuesto. */
  const [levantado, setLevantado] = useState<string | null>(null);
  const levantadoRef = useRef<string | null>(null);
  const [mensaje, setMensaje] = useState("");

  const contenedor = useRef<HTMLElement | null>(null);

  /* El orden de AHORA, para leerlo desde los manejadores. Se sincroniza en un
     efecto —nunca durante el render— y además se actualiza a mano en cada
     manejador que lo cambia, porque `pointerup` puede llegar en el mismo tic
     que el último `pointermove` y el estado todavía iría un paso por detrás. */
  const ordenActual = useRef(orden);
  useEffect(() => {
    ordenActual.current = orden;
  }, [orden]);

  /* Aceptar el orden que llega del servidor, salvo mientras se arrastra: ahí
     manda el dedo, y una revalidación a media cuesta daría un salto.
     Se compara durante el render y no en un efecto: así el cambio se aplica en
     la misma pasada, sin un fotograma con el orden viejo. */
  const clave = ids.join("|");
  const [claveVista, setClaveVista] = useState(clave);
  if (!levantado && clave !== claveVista) {
    setClaveVista(clave);
    setOrden(ids);
  }

  const comprometer = useCallback(
    (siguiente: string[]) => {
      if (siguiente.length !== ids.length || siguiente.some((id, i) => id !== ids[i])) {
        alSoltar(siguiente);
      }
    },
    [alSoltar, ids],
  );

  const aplicar = useCallback((siguiente: string[]) => {
    ordenActual.current = siguiente;
    setOrden(siguiente);
  }, []);

  /** Se pone en el asa de cada fila. */
  const asaProps = useCallback(
    (id: string) => ({
      onPointerDown: (e: React.PointerEvent) => {
        /* Solo el botón principal o el dedo: un menú contextual no arrastra. */
        if (e.button !== 0) return;
        e.preventDefault();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        levantadoRef.current = id;
        setLevantado(id);
        setMensaje("");
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (levantadoRef.current !== id || !contenedor.current) return;
        const filas = Array.from(
          contenedor.current.querySelectorAll<HTMLElement>("[data-ordenable-id]"),
        );

        /* El destino es CUÁNTAS de las demás filas ha dejado atrás el dedo, no
           sobre cuál está.
           
           La diferencia importa y costó encontrarla: como la lista se reordena
           en vivo, la fila arrastrada se coloca justo debajo del dedo, así que
           preguntar «¿sobre qué fila estoy?» se contesta a sí misma —la
           arrastrada— y el destino no vuelve a avanzar nunca. Movías tres
           puestos y bajaba uno.
           
           Contando midpoints ajenos, en cambio, la cuenta es monótona: cada vez
           que el dedo pasa el centro de una fila, el destino sube uno, y la
           propia fila arrastrada no participa. Se vuelve a medir en cada
           movimiento porque con diez filas es gratis y las posiciones cambian
           continuamente. */
        let destino = 0;
        for (const fila of filas) {
          if (fila.dataset.ordenableId === id) continue;
          const r = fila.getBoundingClientRect();
          if (e.clientY > r.top + r.height / 2) destino += 1;
        }

        const siguiente = reubicar(ordenActual.current, id, destino);
        if (siguiente !== ordenActual.current) aplicar(siguiente);
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (levantadoRef.current !== id) return;
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        levantadoRef.current = null;
        setLevantado(null);
        comprometer(ordenActual.current);
      },
      onPointerCancel: () => {
        if (levantadoRef.current !== id) return;
        levantadoRef.current = null;
        setLevantado(null);
        comprometer(ordenActual.current);
      },
      /* El camino de teclado. No es un respaldo para cuando no hay JavaScript
         —eso ya se decidió que no se promete—: es que arrastrar no lo puede
         hacer un lector de pantalla ni quien no usa ratón. */
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const lista = ordenActual.current;
        const destino = lista.indexOf(id) + (e.key === "ArrowUp" ? -1 : 1);
        const siguiente = reubicar(lista, id, destino);
        if (siguiente === lista) return;
        aplicar(siguiente);
        setMensaje(`Movido a la posición ${destino + 1} de ${siguiente.length}`);
        /* Se manda con la lista ya calculada, sin esperar a que React vuelva a
           renderizar: `reubicar` es pura y devuelve el resultado en la mano. */
        comprometer(siguiente);
      },
      "aria-label": "Mover. Usa las flechas arriba y abajo, o arrastra.",
      style: { touchAction: "none" as const },
    }),
    /* Sin `levantado` entre las dependencias: la guarda ya no lo lee, así que
       los manejadores no tienen que rehacerse al empezar a arrastrar. */
    [aplicar, comprometer],
  );

  return {
    /** El orden que hay que pintar ahora mismo. */
    orden,
    /** Id del elemento que se está arrastrando, para darle otro aspecto. */
    levantado,
    /** Se pone en el elemento que contiene las filas. */
    contenedorRef: contenedor,
    /** Se pone en el asa de cada fila; la fila lleva `data-ordenable-id`. */
    asaProps,
    /** Texto para una región `aria-live`: lo que acaba de pasar con el teclado. */
    mensaje,
  };
}
