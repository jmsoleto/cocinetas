import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFetcher } from "react-router";

/* Guardado al vuelo.
 *
 * No hay botón de guardar: la fila del borrador existe desde que se crea, así
 * que siempre hay dónde escribir y no hace falta un segundo estado de «sin
 * guardar». El razonamiento está en la D3 del diseño.
 *
 * Lo delicado no es guardar, es CONTARLO. Con un botón, el fallo aparece cuando
 * pulsas; al vuelo, el guardado del paso 7 puede fallar cuando ya estás en el 9.
 * Por eso el error se queda pegado a su campo y el indicador global no puede
 * decir «Guardado» mientras quede algo pendiente o roto. */

export type EstadoGuardado = "limpio" | "pendiente" | "guardando" | "error";

type Anotar = (clave: string, estado: EstadoGuardado) => void;

/* Dos contextos y no uno, a propósito: los campos solo consumen la función de
   anotar, que es estable, así que un cambio de estado en un campo no vuelve a
   renderizar los otros treinta. El indicador consume el mapa, y es uno solo. */
const CtxAnotar = createContext<Anotar>(() => {});
const CtxEstados = createContext<Record<string, EstadoGuardado>>({});

export function ProveedorGuardado({ children }: { children: React.ReactNode }) {
  const [estados, setEstados] = useState<Record<string, EstadoGuardado>>({});

  const anotar = useCallback<Anotar>((clave, estado) => {
    setEstados((previo) =>
      previo[clave] === estado ? previo : { ...previo, [clave]: estado },
    );
  }, []);

  return (
    <CtxAnotar.Provider value={anotar}>
      <CtxEstados.Provider value={estados}>{children}</CtxEstados.Provider>
    </CtxAnotar.Provider>
  );
}

/**
 * Un campo que se guarda solo.
 *
 * Se envía al salir del campo, por temporizador mientras se escribe, y al
 * ocultarse la página. Lo último no es adorno: en un móvil «cerrar la pestaña»
 * es cambiar de aplicación, y sin `visibilitychange` el último párrafo escrito
 * se perdería porque nunca llegó a haber un `blur`.
 */
export function useGuardadoAlVuelo(opciones: {
  clave: string;
  valorInicial: string;
  datos: (valor: string) => Record<string, string>;
  retardoMs?: number;
}) {
  const { clave, valorInicial, datos, retardoMs = 1200 } = opciones;

  const fetcher = useFetcher<{ error?: string | null }>({ key: clave });
  const [valor, setValor] = useState(valorInicial);

  /* `enviado` va duplicado en estado y en referencia, y no es descuido: el
     estado es lo que el render compara para saber si queda algo pendiente, y la
     referencia es lo que leen los oyentes de `visibilitychange`, que se
     registran una vez y necesitan el valor de AHORA. Leer una referencia
     durante el render sería justamente el fallo que esto evita. */
  const [enviado, setEnviado] = useState(valorInicial);
  const valorActual = useRef(valorInicial);
  const enviadoRef = useRef(valorInicial);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Se copia en un efecto y no durante el render: `datos` es una función nueva
     en cada render, y meterla en las dependencias reharía los oyentes cada vez.
     Para un campo montado, lo que cierra dentro (el id de la fila) no cambia. */
  const datosRef = useRef(datos);
  useEffect(() => {
    datosRef.current = datos;
  });

  const enviar = useCallback(() => {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    if (valorActual.current === enviadoRef.current) return;
    const v = valorActual.current;
    enviadoRef.current = v;
    setEnviado(v);
    fetcher.submit(datosRef.current(v), { method: "post" });
  }, [fetcher]);

  const alCambiar = useCallback(
    (nuevo: string) => {
      setValor(nuevo);
      valorActual.current = nuevo;
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(enviar, retardoMs);
    },
    [enviar, retardoMs],
  );

  useEffect(() => {
    const alOcultarse = () => {
      if (document.visibilityState === "hidden") enviar();
    };
    document.addEventListener("visibilitychange", alOcultarse);
    /* `pagehide` además de lo anterior porque iOS no siempre dispara
       `visibilitychange` al descartar una pestaña. */
    window.addEventListener("pagehide", enviar);
    return () => {
      document.removeEventListener("visibilitychange", alOcultarse);
      window.removeEventListener("pagehide", enviar);
    };
  }, [enviar]);

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const error = fetcher.data?.error ?? null;
  const estado: EstadoGuardado = error
    ? "error"
    : fetcher.state !== "idle"
      ? "guardando"
      : valor !== enviado
        ? "pendiente"
        : "limpio";

  const anotar = useContext(CtxAnotar);
  useEffect(() => {
    anotar(clave, estado);
  }, [anotar, clave, estado]);

  return {
    valor,
    error,
    estado,
    /** Para <input onChange={…}> y <textarea onChange={…}>. */
    alCambiar,
    /** Para onBlur: sale del campo, se envía sin esperar al temporizador. */
    alSalir: enviar,
  };
}

/**
 * Lo que se le cuenta a la persona.
 *
 * Un error manda sobre todo lo demás: mientras haya un campo sin guardar, esto
 * NO puede decir «Guardado», aunque los otros veintinueve estén al día.
 */
export function IndicadorGuardado() {
  const estados = useContext(CtxEstados);

  const resumen = useMemo(() => {
    const valores = Object.values(estados);
    if (valores.includes("error")) return "error" as const;
    if (valores.includes("guardando")) return "guardando" as const;
    if (valores.includes("pendiente")) return "pendiente" as const;
    return "limpio" as const;
  }, [estados]);

  const texto = {
    error: "Hay algo sin guardar",
    guardando: "Guardando…",
    pendiente: "Sin guardar",
    limpio: "Guardado",
  }[resumen];

  return (
    <span role="status" aria-live="polite" data-estado={resumen}>
      {texto}
    </span>
  );
}
