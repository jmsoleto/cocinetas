## Context

Ver `proposal.md` — Why. El repositorio está vacío salvo `openspec/`, así que aquí no hay código previo que condicione nada: todas las decisiones son de partida.

Lo que sí condiciona es el material de diseño ya existente en Claude Design (proyecto `10552572-f0d9-4962-b8ee-bc2a4ed39daf`), que se ha inspeccionado para preparar este change:

- **`Recetario.dc.html`** — prototipo navegable de siete pantallas: inicio, detalle de receta, modo cocina, despensa («Mi cocina»), alta manual, importación desde vídeo y revisión de la propuesta importada. Es un lienzo de 390×844 con marco de móvil.
- **`_ds/nocturne-.../styles.css`** — el design system Nocturne: una hoja de tokens (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`), un reset y una escala tipográfica, más una capa de componentes (`.btn`, `.input`, `.card`, `.tag`, `.nav`, `.table`, `.dialog`, `.hr`, `.lighten`).

Dos hechos medidos sobre ese material que explican varias decisiones de más abajo:

1. **El prototipo usa Nocturne como hoja de tokens, no como librería de componentes.** Recuento de clases del design system en las siete pantallas: `.btn` ×12, `.input` ×9, `.btn-primary` ×6, `.btn-ghost` ×4, `.btn-secondary` ×2, `.btn-block` ×2. Y **cero** usos de `.card`, `.tag`, `.nav`, `.table`, `.dialog`, `.field`, `.hr` y `.lighten`. Todo lo demás está resuelto con estilos en línea sobre los tokens.
2. **El tema `miga` invierte la dirección de las rampas de Nocturne.** En Nocturne, sobre fondo oscuro, `neutral-100` es el paso más claro y `neutral-900` el más oscuro. En `miga`, sobre fondo claro, la rampa va al revés: `neutral-200` es el más oscuro (`#322a23`) y `neutral-900` el más claro (`#ece2d5`). Nocturne no es un tema oscuro y `miga` su versión clara: son dos convenciones opuestas sobre las mismas variables.

Restricciones externas: alojamiento gratuito, un puñado de usuarios, e instalación en el móvil como objetivo de distribución.

## Goals / Non-Goals

**Goals:**

- Dejar montado un esqueleto donde el siguiente change pueda empezar directamente por una pantalla del prototipo, sin tocar cimientos.
- Que el bucle de desarrollo local sea completo y offline: base de datos, autenticación y correo, todo en la máquina.
- Que la sesión sea legible en el servidor desde el primer byte, porque todas las pantallas del prototipo son personalizadas (la despensa determina qué recetas se ven).
- Dejar registrados por escrito los puntos donde `miga` rompe Nocturne, para que no se descubran de uno en uno dentro de seis meses.

**Non-Goals:**

- Cualquier pantalla del prototipo más allá del saludo. En particular, no se toca el modelo de datos de recetas ni de ingredientes.
- Recuperación de contraseña, cambio de correo, borrado de cuenta, proveedores externos (Google, Apple). El registro con correo y contraseña es todo.
- Funcionamiento offline real. El service worker se instala porque es requisito para la instalabilidad, no para servir contenido sin red.
- Dominio propio, analítica, monitorización, CI.

## Decisions

### D1 — React Router (framework mode) sobre Cloudflare Workers

**Alternativas consideradas:** Next.js App Router sobre Vercel; TanStack Start; Astro con islas de React.

Next.js sobre Vercel es el camino más documentado y `@supabase/ssr` tiene guías de primera clase para él, pero el tier gratuito de Vercel es _hobby, no comercial_: si Cocinetas llegara a ser algo, se empieza con deuda de migración. Cloudflare Workers no tiene esa cláusula y su tier gratuito (100.000 peticiones al día) sobra para el volumen previsto.

React Router v7 gana además por encaje conceptual: `loader` y `action` reciben la `Request` y devuelven la `Response`, que es exactamente la forma que necesita una sesión basada en cookies (leer `Cookie` de la petición, escribir `Set-Cookie` en la respuesta). Al ser Vite por debajo, `vite-plugin-pwa` funciona sin adaptaciones.

TanStack Start es elegante pero más joven, con más rotación de API y menos material hecho para Supabase. Astro se descarta porque el modo cocina y el importador son pantallas con estado, y el modelo de islas estorba ahí.

**Versión, corregido durante la implementación:** este documento decía «React Router v7». La plantilla oficial de Cloudflare (`create-cloudflare --framework=react-router`) entrega **React Router v8**, y el repositorio `remix-run/react-router-templates` ya no tiene plantilla `cloudflare`. Se va con v8: es la versión actual del mismo enfoque —framework mode, `loader`/`action`, Vite, Workers— y fijar v7 sería elegir a propósito un major anterior. La decisión no cambia, solo el número.

**Consecuencia operativa:** Workers necesita `compatibility_flags: ["nodejs_compat"]` en `wrangler.jsonc` para que el SDK de Supabase resuelva sus dependencias de Node.

### D2 — Sesión en cookies, con un cliente de Supabase por petición

Se usa `@supabase/ssr`, no el cliente de navegador. La sesión vive en cookies `HttpOnly` escritas por el servidor mediante cabeceras `Set-Cookie`, no en `localStorage`.

Motivo: sin esto el servidor no sabe quién pide la página y hay que renderizar un esqueleto y rellenarlo tras hidratar — justo el estado intermedio que `specs/app-shell` prohíbe. Además, cookies escritas desde el servidor sortean el límite de siete días que Safari (ITP) impone a las cookies escritas desde `document.cookie`.

En Workers no hay estado global entre peticiones, así que **cada `loader` y cada `action` construye su propio cliente** a partir de las cookies de esa petición y devuelve las cabeceras que deba escribir. Un helper `createSupabaseServerClient(request)` devuelve `{ supabase, headers }`, y toda respuesta que provenga de una ruta autenticada debe propagar esas `headers` — es el mecanismo por el que la sesión se renueva de forma transparente.

**Alternativa descartada:** cliente único de módulo. En Workers eso filtraría la sesión de un usuario a la petición de otro.

### D3 — Supabase en local con Docker, migraciones versionadas

`supabase start` levanta Postgres, GoTrue, PostgREST y **Mailpit** (buzón local). El correo de confirmación del registro cae en Mailpit, de modo que el flujo completo de alta se puede probar sin configurar ningún SMTP y sin enviar correo real.

El esquema vive en `supabase/migrations/*.sql`, versionado en git. Ninguna migración se aplica a mano desde el panel de Supabase: se escribe el fichero, se prueba con `supabase db reset` en local, y se sube con `supabase db push`.

**Coste asumido:** Docker es requisito para desarrollar. Ni Docker ni la CLI de Supabase están instalados en la máquina actual; instalarlos es la primera tarea.

### D4 — Confirmación de correo activada, con el servicio integrado de Supabase

Se deja el registro exigiendo confirmación por correo, tal como pide `specs/user-auth`. En local lo sirve Mailpit; en producción, el servicio de correo integrado de Supabase.

Ese servicio integrado está limitado a muy pocos envíos por hora y está pensado para desarrollo, no para producción. Con el puñado de usuarios previsto es suficiente, y es la decisión tomada conscientemente. Si el número de altas crece, la salida es enchufar un SMTP propio (Resend tiene tier gratuito) desde el panel de Supabase: es un cambio de configuración, no de código, y por eso no condiciona nada de este change.

### D5 — Nocturne se vendoriza intacto; `miga` va en una capa aparte

`app/styles/nocturne.css` es una copia literal del design system y **no se edita nunca**. Cuando Nocturne cambie en Claude Design se sustituye el fichero entero. Todo lo nuestro va después, en `app/styles/miga.css`.

**Alternativa descartada:** fusionar ambos en un único `cocinetas.css` con la paleta ya sustituida. Es más limpio de leer, pero rompe la posibilidad de resincronizar con Claude Design, que es donde el diseño va a seguir evolucionando.

`miga.css` contiene exactamente dos cosas:

**(a) La redefinición de tokens.** Tomada de `THEMES.miga` en el prototipo. Los tokens que `miga` define coinciden exactamente con los que el prototipo consume (`neutral 200–900`, `accent 200–800`, `accent-2-600`, más `bg`, `surface`, `text`, `divider` y las tres sombras), así que no hay huecos que rellenar para reproducir el prototipo:

```
--color-bg: #f7f1e8;        --color-surface: #fffbf4;    --color-text: #2c2521;
--color-divider: color-mix(in srgb, #2c2521 14%, transparent);
--color-neutral-200: #322a23;  300: #4a3f34;  400: #6b5c4a;  500: #7d6c58;
--color-neutral-600: #9c8c78;  700: #c4b5a1;  800: #ddd0be;  900: #ece2d5;
--color-accent: #b25c3c;
--color-accent-200: #7a3a23;   300: #8f4529;  400: #b25c3c;  500: #c47454;
--color-accent-600: #d08e6f;   700: #e0b49c;  800: #eccdbb;
--color-accent-2-600: #8a9a6f;
--shadow-sm: 0 0 0 1px #e6dbcb;
--shadow-md: 0 0 0 1px #ddd0be, 0 6px 18px rgba(80,60,40,0.12);
--shadow-lg: 0 0 0 1px #d3c3ad, 0 14px 32px rgba(80,60,40,0.16);
```

Los tokens `--app-page-grad` y `--app-shell-shadow` del prototipo **no se copian**: pintan el fondo de la maqueta y la sombra del marco de móvil, que no existen en la aplicación real.

**(b) El saneado de las reglas de Nocturne que asumen fondo oscuro.** Consecuencia directa del hecho 2 del contexto. Cuatro reglas quedan rotas al invertirse la rampa, y hay que corregirlas en `miga.css`:

| Regla de Nocturne                                           | Qué hace bajo `miga`                                                                                            | Corrección                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `.dialog-backdrop` usa `--color-neutral-900` al 50%         | `neutral-900` es casi blanco → el velo sale `#f2eade`, luminancia 0,830 contra el 0,885 del fondo: **un scrim que no separa nada** | `--color-neutral-200`, que lo baja a 0,274    |
| `.tag-accent`: fondo `accent-800`, texto `accent-100`       | fondo melocotón claro; `accent-100` no existe en `miga` y hereda el `#f5f4ff` de Nocturne → **1,37:1, texto invisible** | texto `--color-accent-200` → 5,70:1           |
| `.tag-neutral`: fondo `neutral-800`, texto `neutral-100`    | mismo problema → **1,39:1, texto invisible**                                                                    | texto `--color-neutral-200` → 9,28:1          |
| `.tag-accent-2`: fondo `accent-2-800`, texto `accent-2-100` | ninguno de los dos existe en `miga`; hereda el índigo oscuro de Nocturne → **fuera de paleta**                  | definir el par sobre el verde oliva `#8a9a6f` |

Ninguna de las cuatro se usa todavía, precisamente porque el prototipo no toca esas clases. Se corrigen ahora porque el día que se usen el síntoma será desconcertante y la causa está a tres capas de distancia.

`.lighten` (`mix-blend-mode: lighten`) haría desaparecer por completo cualquier fotografía sobre el fondo claro de `miga`. No se corrige: **no se usa**. El prototipo resuelve las fotos con un hueco `<image-slot>`, que en la aplicación real será un `<img>` con `object-fit: cover`. Queda anotado aquí para que nadie lo adopte leyendo el readme de Nocturne, que lo recomienda con insistencia.

### D6 — Componentes propios en CSS Modules sobre los tokens

Se reutilizan de Nocturne los tokens, el reset, la escala tipográfica y las dos clases que el prototipo sí usa: `.btn` (con sus variantes) e `.input`. Todo lo demás —tarjetas de receta, chips de categoría, insignia de coincidencia con la despensa, pestañas, navegación inferior, filas de despensa, selector de comensales— se escribe como componentes propios en CSS Modules.

Es lo que el prototipo ya hace de facto (hecho 1 del contexto), y es lo razonable: la capa de componentes de Nocturne está pensada para escritorio y fondo oscuro. Su `.nav` es una barra de cabecera, no una navegación inferior de móvil; su `.dialog` mide 440px; su `.table` no pinta nada aquí.

**Consecuencia honesta:** se va a escribir más CSS propio del que sugiere el readme de Nocturne. La disciplina que se mantiene es la que de verdad importa: **ningún valor literal de color, espaciado, radio, sombra o tipografía**; todo sale de `var(--…)`.

**Alternativa descartada:** Tailwind mapeado a los tokens. Convivirían dos vocabularios (`.btn` frente a utilidades) y a medio plazo uno gana y el otro queda como deuda.

### D7 — PWA: manifest, service worker y las etiquetas que iOS necesita aparte

`vite-plugin-pwa` genera y registra el service worker; sin service worker Chrome no ofrece instalar. El manifest declara `name: "Cocinetas"`, `display: "standalone"`, `orientation: "portrait"`, `start_url: "/"`, `scope: "/"` y `theme_color`/`background_color` a `#f7f1e8` (el `--color-bg` de `miga`).

Iconos: 192 y 512 píxeles, **más una variante `purpose: "maskable"`** con la zona de seguridad respetada — sin ella Android recorta el icono a un círculo y se come el dibujo.

iOS necesita su propio juego de etiquetas porque **ignora los iconos del manifest**: `apple-touch-icon`, `apple-mobile-web-app-capable` y `apple-mobile-web-app-status-bar-style` van en el `<head>` del documento raíz.

El shell de móvil se apoya en `<meta name="viewport" content="..., viewport-fit=cover">` junto con `padding` desde `env(safe-area-inset-*)` en la navegación inferior y la cabecera, y en `100dvh` (nunca `100vh`) para las pantallas a página completa.

### D8 — Rutas en español

`/`, `/entrar`, `/registro`, `/salir`. La aplicación es íntegramente en español y las URLs se ven: aparecen al compartir y en la barra del navegador antes de instalar. No hay razón para que sean el único trozo de interfaz en inglés.

### D9 — Inter se sigue cargando desde Google Fonts, por ahora

`nocturne.css` abre con `@import url('https://fonts.googleapis.com/css2?family=Inter…')`. Autoalojar Inter sería mejor —una petición externa menos, bloqueante, y una dependencia de terceros menos en una aplicación que aspira a estar instalada— pero exige editar el fichero vendorizado, que D5 declara intocable.

Se acepta el `@import` en este change y se anota como mejora posterior: la salida limpia es autoalojar los ficheros de fuente y neutralizar el `@import` desde la capa propia, no parchear el fichero importado.

## Risks / Trade-offs

**La PWA instalada en iOS tiene su propio almacén de cookies, separado del de Safari** → Quien se registre en Safari y luego añada la aplicación a la pantalla de inicio, la abrirá **sin sesión** y no entenderá por qué. Mitigación en este change: ninguna, se documenta. Mitigación real, en un change posterior: llevar el onboarding a «instala primero, regístrate después», o detectar el arranque sin sesión en modo `standalone` y explicarlo con un mensaje. Es la razón por la que este riesgo se anota aquí y no se ignora: condiciona cuál será la ruta de entrada del producto.

**iOS no dispara `beforeinstallprompt`** → No hay botón «Instalar» posible en iOS; hay que enseñar el gesto Compartir → «Añadir a pantalla de inicio». Además, en iOS solo se puede instalar desde Safari, no desde Chrome. Mitigación: fuera de alcance aquí; el manifest y los iconos quedan listos para que un change posterior añada la ayuda contextual.

**Los proyectos gratuitos de Supabase se pausan tras unos días sin actividad** → Primera visita tras un parón, lenta o fallida. Mitigación: aceptado mientras el uso sea personal; si molesta, un Cron Trigger de Cloudflare que haga una consulta trivial a diario lo mantiene despierto, y es barato de añadir.

**El servicio de correo integrado de Supabase limita mucho los envíos por hora** → Con varias altas seguidas, algunos correos de confirmación no llegan. Aceptado conscientemente (ver D4). Salida: SMTP propio, sin cambios de código.

**El SDK de Supabase en Workers depende de `nodejs_compat`** → Si falta el flag, el fallo aparece en el despliegue, no en local. Mitigación: desplegar en Cloudflare como una de las primeras tareas, no como la última, para que el entorno real se valide pronto.

**Docker es requisito para desarrollar** → Cualquiera que clone el repositorio necesita Docker corriendo antes de poder arrancar. Se asume: es el precio de tener un entorno local completo, y era parte del objetivo declarado.

**El fichero vendorizado de Nocturne divergirá del proyecto de Claude Design** → Nadie se acordará de resincronizar. Mitigación: D5 mantiene el fichero intacto para que resincronizar sea copiar y pegar, y una cabecera en `miga.css` deja escrito de dónde salió y cuándo.

**La aplicación se instalará como `cocinetas.<algo>.workers.dev`** → Ese nombre se ve en el diálogo de instalación de Android. Aceptado por ahora; un dominio propio es una entrada de DNS y dos líneas en `wrangler.jsonc` cuando se quiera.

## Migration Plan

No hay datos ni usuarios que migrar. El despliegue es una puesta en marcha:

1. Instalar Docker y la CLI de Supabase; `supabase start` y comprobar que Mailpit recibe el correo de confirmación en local.
2. Crear el proyecto de Supabase en la nube y el Worker en Cloudflare.
3. `supabase db push` para llevar las migraciones a la nube.
4. Cargar `SUPABASE_URL` y `SUPABASE_ANON_KEY` como secrets de Wrangler (en local viven en `.dev.vars`, que va al `.gitignore`).
5. Desplegar y verificar el ciclo completo en producción desde un teléfono real: registrar, confirmar el correo, entrar, instalar en la pantalla de inicio, abrir la aplicación instalada.

**Reversión:** el Worker se revierte a la versión anterior desde el panel de Cloudflare. Las migraciones de este change solo crean objetos nuevos (`profiles` y su trigger), así que revertir es soltarlos; no hay datos que preservar.

## Open Questions

- **Dominio propio.** Diferido: cambiarlo más adelante no afecta a las specs, ni al enfoque, ni al desglose de tareas.
- **Longitud mínima de contraseña.** `specs/user-auth` exige que exista un mínimo y que se comunique, sin fijar el número. Se arranca con el valor por defecto de Supabase y se ajusta en configuración si se quiere otro.
