/* Las URLs de la aplicación, en un módulo neutro.
 *
 * Vivían en session.server.ts, que es lo natural hasta que un componente las
 * usa en un <Link>: entonces el cliente importa un módulo de servidor y el
 * build de producción se cae con "Server-only module referenced by client".
 * En desarrollo no salta, porque Vite no impone esa frontera igual.
 * Una URL no es código de servidor, así que vive aquí. */
export const RUTA_ENTRAR = "/entrar";
export const RUTA_REGISTRO = "/registro";
export const RUTA_SALIR = "/salir";
export const RUTA_INICIO = "/";
export const RUTA_COCINA = "/cocina";
export const RUTA_INGREDIENTES = "/ingredientes";
export const RUTA_RECETAS = "/recetas";
/* El filtro va en la URL y no en un interruptor con JavaScript: así funciona
   sin JavaScript, sobrevive a una recarga y se puede enlazar. */
export const PARAM_SOLO = "solo";
export const SOLO_EN_CASA = "en-casa";
export const RUTA_RECETAS_EN_CASA = `${RUTA_RECETAS}?${PARAM_SOLO}=${SOLO_EN_CASA}`;

/* Con parámetro, así que funciones y no constantes. Se construyen aquí y no en
   cada componente para que cambiar la forma de la URL sea un solo sitio. */
export const rutaReceta = (id: string) => `/recetas/${id}`;
export const rutaEditarReceta = (id: string) => `/recetas/${id}/editar`;

/* El modo cocina es UNA ruta y el paso va en la búsqueda, no en un segmento:
   así cambiar de paso no vuelve a leer la receta (D1 de add-cook-mode). Sin
   paso es «Antes de empezar»; los pasos empiezan en 1, como los lee una persona. */
export const PARAM_PASO = "paso";
export const rutaCocinar = (id: string, paso?: number) =>
  paso ? `/recetas/${id}/cocinar?${PARAM_PASO}=${paso}` : `/recetas/${id}/cocinar`;
