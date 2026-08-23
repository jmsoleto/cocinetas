## Why

Cocinetas existe hoy solo como prototipo de diseño (`Recetario.dc.html` en Claude Design): siete pantallas navegables sobre el design system Nocturne, sin nada de código. No hay proyecto, ni base de datos, ni despliegue, ni forma de que nadie use la aplicación.

Este change monta el esqueleto completo —proyecto, estilos, base de datos, autenticación, despliegue e instalabilidad— y lo demuestra con la pantalla mínima posible: un saludo al usuario que ha iniciado sesión. Ninguna funcionalidad de recetas entra aquí. El objetivo es que a partir del siguiente change se pueda construir pantalla a pantalla sin volver a tocar los cimientos.

## What Changes

- **Proyecto**: aplicación React Router v7 (framework mode) con TypeScript y SSR, sobre Vite, desplegada en Cloudflare Workers.
- **Design system**: se vendoriza `styles.css` de Nocturne sin modificar, y se le superpone el tema `miga` (paleta cálida clara) como única paleta de la aplicación. No hay conmutador de temas.
- **Shell móvil**: la aplicación se dirige exclusivamente a móvil, con área segura (`env(safe-area-inset-*)`), altura `dvh` y ancho máximo de seguridad para que no se rompa si alguien la abre en un portátil.
- **PWA instalable**: manifest, service worker, iconos (incluida variante `maskable`) y etiquetas `apple-*`, de modo que la aplicación se pueda añadir a la pantalla de inicio en Android y en iOS.
- **Base de datos**: Supabase en local con Docker (`supabase start`), con migraciones versionadas en el repositorio y una tabla `profiles` protegida por RLS.
- **Autenticación**: registro con email, contraseña y nombre; inicio y cierre de sesión. La sesión viaja en cookies gestionadas por `@supabase/ssr`, de forma que el servidor renderiza ya autenticado en el primer byte.
- **Pantalla de demostración**: una ruta protegida que muestra «Hola, `<nombre>`» y un botón de cerrar sesión. Es todo lo que se construye de interfaz.
- **Tooling**: TypeScript estricto, lint, formato, variables de entorno separadas para local (`.dev.vars`) y producción (secrets de Wrangler).

Sin cambios que rompan nada: el repositorio está vacío.

## Capabilities

### New Capabilities

- `app-shell`: cómo se sirve y se presenta la aplicación — renderizado en servidor, tema único `miga` sobre los tokens de Nocturne, shell de móvil con área segura, e instalabilidad como PWA en Android e iOS.
- `user-auth`: registro, inicio de sesión, cierre de sesión, persistencia de la sesión en cookies legibles desde el servidor, perfil de usuario y protección de rutas.

### Modified Capabilities

Ninguna. El repositorio no tiene specs previas.

## Impact

**Se crea todo el proyecto.** Hoy el repositorio solo contiene `openspec/`.

- **Dependencias nuevas**: `react`, `react-dom`, `react-router`, `@react-router/dev`, `vite`, `@cloudflare/vite-plugin`, `wrangler`, `typescript`, `@supabase/supabase-js`, `@supabase/ssr`, `vite-plugin-pwa`.
- **Herramientas externas requeridas**: Docker (para Supabase en local) y la CLI de Supabase. Ninguna de las dos está instalada en la máquina de desarrollo actualmente.
- **Servicios externos**: una cuenta de Cloudflare (Workers, tier gratuito) y un proyecto de Supabase en la nube para producción.
- **Dominio**: se despliega en `*.workers.dev` por ahora. Un dominio propio queda para más adelante y no condiciona este change.
- **Activos importados**: `_ds/nocturne-.../styles.css` del proyecto de Claude Design se copia al repositorio como artefacto vendorizado. `Recetario.dc.html` queda como referencia de diseño, no se traduce a código en este change.

**Lo que este change NO hace**: recetas, despensa, modo cocina, importación desde vídeo, estimación nutricional, y cualquiera de las siete pantallas del prototipo más allá del saludo.
