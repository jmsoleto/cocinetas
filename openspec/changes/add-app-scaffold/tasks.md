## 1. Herramientas y proyecto base

- [x] 1.1 Instalar Docker Desktop y la CLI de Supabase; verificar con `docker info` y `supabase --version` respondiendo sin error
- [x] 1.2 Crear la aplicación React Router v8 en modo framework con la plantilla de Cloudflare, en la raíz del repositorio sin pisar `openspec/`; verificar que `npm run dev` sirve la página por defecto en el navegador
- [x] 1.3 Endurecer `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`) y añadir lint y formato; verificar que `npm run typecheck` y el lint pasan en limpio sobre el proyecto recién creado
- [x] 1.4 Añadir `.gitignore` cubriendo `node_modules`, `.dev.vars`, `.wrangler`, `build` y los artefactos de Supabase; verificar que `git status` no lista ninguno de ellos
- [x] 1.5 Primer commit del esqueleto desnudo, antes de añadir nada propio, para tener un punto de retorno limpio

## 2. Despliegue temprano

- [x] 2.1 Crear el Worker en Cloudflare y desplegar la aplicación tal cual; verificar que la URL `*.workers.dev` sirve la página y anotar la URL definitiva
- [x] 2.2 Confirmar que el HTML llega renderizado desde el servidor; verificar con `curl` a la URL desplegada que el marcado de la página viene en la respuesta y no lo pinta el cliente

## 3. Design system y shell móvil

- [x] 3.1 Copiar `_ds/nocturne-64a5de61-3365-4d57-a150-5aeee131088f/styles.css` del proyecto de Claude Design a `app/styles/nocturne.css` sin modificar una sola línea; verificar que el fichero copiado es idéntico al origen
- [x] 3.2 Escribir `app/styles/miga.css` con la redefinición de tokens de la decisión D5(a), y una cabecera que registre de qué proyecto de Claude Design y de qué fecha procede `nocturne.css`; verificar en el navegador que el fondo es `#f7f1e8` y el texto `#2c2521`
- [x] 3.3 Añadir a `miga.css` el saneado de las cuatro reglas de fondo oscuro de la tabla D5(b) (`.dialog-backdrop`, `.tag-accent`, `.tag-neutral`, `.tag-accent-2`); verificar con una página de prueba desechable que el fondo de diálogo oscurece y que el texto de las tres etiquetas se lee sobre su fondo
- [ ] 3.4 Escribir `app/styles/app.css` con el shell de móvil: `100dvh` en las pantallas a página completa, ancho máximo de seguridad centrado, y `padding` desde `env(safe-area-inset-*)`; verificar en el simulador de un dispositivo con muesca que nada queda tapado
- [x] 3.5 Configurar `root.tsx` con `lang="es"` y `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, y encadenar las tres hojas en orden `nocturne` → `miga` → `app`; verificar en las herramientas de desarrollo que los tokens resueltos son los de `miga` y no los de Nocturne
- [x] 3.6 Añadir la configuración de CSS Modules y un componente de prueba que consuma solo variables CSS; verificar que sus estilos se aplican con nombre de clase generado

## 4. Supabase en local

- [x] 4.1 `supabase init` y `supabase start`; verificar que el Studio local y el buzón Mailpit abren en sus puertos
- [x] 4.2 Escribir la migración `0001_profiles.sql`: tabla `profiles` con clave foránea a `auth.users`, columna de nombre, RLS activado y políticas que limiten lectura y escritura al propio usuario; verificar con `supabase db reset` que la migración aplica desde cero sin error
- [x] 4.3 Añadir a la misma migración el trigger sobre alta en `auth.users` que crea el perfil con el nombre recibido en el registro; verificar con un alta de prueba desde el Studio que la fila de `profiles` aparece sola
- [x] 4.4 Comprobar el aislamiento por RLS: verificar, autenticado como un usuario de prueba, que una consulta al perfil de otro usuario devuelve cero filas
- [x] 4.5 Crear `.dev.vars` con `SUPABASE_URL` y `SUPABASE_ANON_KEY` apuntando a la instancia local; verificar que `npm run dev` arranca leyéndolas y que `.dev.vars` no aparece en `git status`

## 5. Sesión y autenticación

- [x] 5.1 Instalar `@supabase/supabase-js` y `@supabase/ssr`, y añadir `nodejs_compat` a `compatibility_flags` en `wrangler.jsonc`; verificar que el build de producción (`npm run build`) termina sin error
- [x] 5.2 Escribir `app/lib/supabase.server.ts` con `createSupabaseServerClient(request)` que devuelva `{ supabase, headers }` construido por petición; verificar desde un loader de prueba que lee las cookies de la petición entrante
- [x] 5.3 Escribir `app/lib/session.server.ts` con `getUser(request)` y `requireUser(request)`, este último redirigiendo a `/entrar` cuando no hay sesión; verificar que una petición sin cookies a una ruta protegida responde 302 a `/entrar`
- [x] 5.4 Implementar `/registro` (formulario de correo, contraseña y nombre + action de alta), con los mensajes de error en español y conservando correo y nombre al fallar; verificar que un alta correcta deja el correo esperando en Mailpit
- [x] 5.5 Añadir a `/registro` los casos de error: correo ya registrado, correo mal formado, contraseña corta, nombre vacío; verificar cada uno manualmente y comprobar que el de correo duplicado no revela que la cuenta existe
- [x] 5.6 Implementar `/entrar` con el mensaje de error genérico único para credenciales inválidas; verificar que contraseña equivocada y correo inexistente producen exactamente el mismo texto
- [x] 5.7 Comprobar el bloqueo por correo sin confirmar: verificar que una cuenta recién creada y no confirmada no puede iniciar sesión, y que tras pulsar el enlace de Mailpit sí puede
- [x] 5.8 Implementar `/salir` como action que cierra sesión y limpia las cookies; verificar que tras cerrar sesión el botón de atrás del navegador no devuelve el contenido protegido
- [x] 5.9 Propagar las `headers` devueltas por el cliente en todas las respuestas de rutas autenticadas; verificar que una sesión se mantiene activa tras recargar repetidamente y que las cookies se reescriben cuando toca renovar
- [x] 5.10 Redirigir a la pantalla principal a quien solicite `/entrar` o `/registro` teniendo ya sesión; verificar ambas rutas con sesión iniciada

## 6. Pantalla de saludo

- [x] 6.1 Implementar `/` como ruta protegida cuyo loader lee el perfil y renderiza «Hola, `<nombre>`» junto a un control de cerrar sesión; verificar en el navegador con una cuenta de prueba
- [x] 6.2 Comprobar que el saludo llega renderizado en servidor: verificar con `curl` incluyendo la cookie de sesión que el nombre del usuario aparece en el HTML de la respuesta
- [x] 6.3 Comprobar el funcionamiento sin JavaScript: verificar con JavaScript deshabilitado que la página se lee y que los formularios de `/entrar` y `/registro` siguen enviándose

## 7. PWA instalable

- [x] 7.1 Instalar y configurar `vite-plugin-pwa`; verificar que el service worker se registra en el build de producción servido en local
- [x] 7.2 Diseñar los iconos a 192 y 512 píxeles más la variante `maskable` con zona de seguridad respetada; verificar la variante `maskable` contra una máscara circular sin que se corte nada significativo
- [x] 7.3 Escribir el manifest con `name: "Cocinetas"`, `display: "standalone"`, `orientation: "portrait"`, `start_url`, `scope` y `theme_color`/`background_color` a `#f7f1e8`; verificar en el panel Application de las herramientas de desarrollo que no reporta advertencias de instalabilidad
- [ ] 7.4 Añadir en `root.tsx` las etiquetas propias de iOS (`apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`) y el `<meta name="theme-color">`; verificar que el icono de la pantalla de inicio en iOS es el de Cocinetas y no una captura de la página

## 8. Producción y verificación de extremo a extremo

- [x] 8.1 Crear el proyecto de Supabase en la nube y aplicar las migraciones con `supabase db push`; verificar en el panel que `profiles`, sus políticas y el trigger existen
- [x] 8.2 Cargar `SUPABASE_URL` y `SUPABASE_ANON_KEY` como secrets de Wrangler y desplegar; verificar que la aplicación desplegada conecta con Supabase y no lanza errores de compatibilidad de Node en los logs del Worker
- [ ] 8.3 Recorrer el ciclo completo desde un teléfono Android real: registrar, confirmar el correo, entrar, ver el saludo, instalar desde el aviso del navegador, abrir la aplicación instalada y comprobar que sigue con la sesión iniciada
- [ ] 8.4 Recorrer el ciclo completo desde un iPhone real con Safari, añadiendo la aplicación a la pantalla de inicio; verificar el icono, la ausencia de barra de direcciones, y **dejar anotado** si la aplicación instalada arranca sin sesión — es el riesgo del almacén de cookies separado y hay que confirmar si se materializa
- [x] 8.5 Escribir el `README.md` con los requisitos previos (Docker, CLI de Supabase), el arranque local paso a paso y el procedimiento de despliegue; verificar siguiéndolo desde un clon limpio del repositorio
