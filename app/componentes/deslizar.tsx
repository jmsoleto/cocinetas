import { useRef } from "react";

/* Pasar de pantalla deslizando el dedo, a mano y sin dependencia.
 *
 * POR QUÉ `touch-action: pan-y` (lo pone el CSS de quien lo usa): el navegador
 * se queda con el desplazamiento vertical, nativo y con su inercia, y solo nos
 * entrega lo horizontal. Cuando decide desplazar, cancela el puntero
 * (`pointercancel`) y aquí no se cuenta nada. Así leer un paso largo no salta
 * de paso.
 *
 * POR QUÉ NO UNA LIBRERÍA: son tres oyentes y dos comparaciones. La única
 * dependencia de cliente que entraría por esto no se ganaría el sitio.
 *
 * Sin JavaScript esto no hace nada, y los enlaces de adelante y atrás bastan. */

/** Lo que hay que recorrer en horizontal para que cuente. Es una estimación de
 *  partida (D3 del diseño), y la tarea 3.2 la ajusta en un teléfono de verdad. */
const UMBRAL_PX = 60;

/** Cuánto más horizontal que vertical tiene que ser el gesto. Con 1,5, un
 *  desplazamiento vertical que se tuerce un poco no cuenta como deslizar. */
const PROPORCION = 1.5;

/** Un dedo que se queda quieto tanto tiempo está seleccionando texto, no
 *  deslizando. Ese gesto se deja en paz. */
const PULSACION_LARGA_MS = 600;

type Inicio = { id: number; x: number; y: number; t: number };

export function Deslizable({
  alSiguiente,
  alAnterior,
  className,
  children,
}: {
  /** Ausente cuando no hay adónde ir: en el último paso deslizar no termina. */
  alSiguiente?: () => void;
  /** Ausente en «Antes de empezar», que no tiene anterior. */
  alAnterior?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const inicio = useRef<Inicio | null>(null);

  return (
    <div
      className={className}
      onPointerDown={(e) => {
        /* Solo el dedo o el lápiz. Con ratón, arrastrar es seleccionar. */
        if (e.pointerType === "mouse" || !e.isPrimary) return;
        inicio.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          t: e.timeStamp,
        };
      }}
      onPointerCancel={() => {
        inicio.current = null;
      }}
      onPointerUp={(e) => {
        const i = inicio.current;
        inicio.current = null;
        if (!i || i.id !== e.pointerId) return;
        if (e.timeStamp - i.t > PULSACION_LARGA_MS) return;

        const dx = e.clientX - i.x;
        const dy = e.clientY - i.y;
        if (Math.abs(dx) < UMBRAL_PX || Math.abs(dx) <= PROPORCION * Math.abs(dy))
          return;

        /* Dedo hacia la izquierda: lo que viene después, como pasar una página. */
        if (dx < 0) alSiguiente?.();
        else alAnterior?.();
      }}
    >
      {children}
    </div>
  );
}
