import { useEffect, useState } from "react";

/**
 * Que la pantalla no se apague mientras el componente está montado (D4 de
 * add-cook-mode). Devuelve si el bloqueo está activo de VERDAD, para poder
 * decírselo a la persona solo cuando es cierto.
 *
 * Tres cosas que no son obvias:
 *
 * - El navegador suelta el bloqueo él solo al ocultarse la página. Por eso se
 *   vuelve a pedir al volver a `visible`: si no, cambiar de aplicación a mitad
 *   de la receta dejaría la pantalla apagándose el resto del rato.
 * - Cualquier fallo se traga en silencio. Que no exista la API, que se deniegue
 *   o que haya batería baja no es un error del modo cocina, que funciona igual.
 * - Montado en la ruta, y no en cada paso, para que cambiar de paso no lo
 *   suelte y lo vuelva a pedir.
 */
export function useMantenerPantalla(): boolean {
  const [activa, setActiva] = useState(false);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let bloqueo: WakeLockSentinel | null = null;
    let desmontado = false;

    const alSoltarse = () => setActiva(false);

    const pedir = async () => {
      if (document.visibilityState !== "visible" || (bloqueo && !bloqueo.released)) {
        return;
      }
      try {
        const nuevo = await navigator.wakeLock.request("screen");
        /* Si salimos del modo cocina mientras se resolvía, se suelta enseguida:
           un bloqueo huérfano dejaría la pantalla encendida en el resto de la
           aplicación. */
        if (desmontado) {
          void nuevo.release();
          return;
        }
        bloqueo = nuevo;
        bloqueo.addEventListener("release", alSoltarse);
        setActiva(true);
      } catch {
        setActiva(false);
      }
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") void pedir();
    };

    void pedir();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      desmontado = true;
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      if (bloqueo) {
        bloqueo.removeEventListener("release", alSoltarse);
        void bloqueo.release().catch(() => {});
      }
    };
  }, []);

  return activa;
}
