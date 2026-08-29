# Pendiente

Cosas que se dejaron a propósito fuera de un change, con el porqué y lo que
haría falta para cerrarlas. No es una lista de deseos: solo entra aquí lo que
se decidió aplazar conscientemente, con su contexto suficiente para que quien
lo retome no tenga que reconstruirlo.

---

## 1. El `?code=` de la confirmación de correo se está tirando

**Qué pasa hoy.** Al pulsar el enlace del correo, Supabase confirma la cuenta y
redirige a `https://cocinetas.cocinetas.workers.dev/?code=<pkce>`. Como `/` exige
sesión, la persona acaba en `/entrar` escribiendo su contraseña otra vez. El
`code` es un código PKCE canjeable por una sesión, y lo ignoramos.

**Por qué se dejó.** La spec de `user-auth` solo exige confirmar el correo antes
de permitir el acceso, y eso se cumple. Entrar automáticamente es mejora de
experiencia, no un requisito incumplido, así que no se amplió el alcance del
change del esqueleto por cuenta propia.

**Qué haría falta.** Una ruta `/auth/callback` cuyo loader llame a
`supabase.auth.exchangeCodeForSession(code)` y redirija a `/` propagando las
`headers` — como hacen ya `entrar.tsx` y `registro.tsx`. Unas 20 líneas.
Además, poner esa URL como `redirect_to` para que el correo apunte ahí en vez de
a la raíz. Ojo: la Site URL de producción **no** está en `supabase/config.toml`,
vive en el panel del proyecto (ver el aviso en ese fichero).

**Cuidado al hacerlo.** Un enlace de confirmación se puede abrir dos veces, o
caducado. El canje debe fallar en silencio hacia `/entrar` con un mensaje
comprensible, no reventar con un error 500.

---

## 2. Inter se carga desde Google Fonts

**Qué pasa hoy.** `app/styles/nocturne.css` abre con
`@import url('https://fonts.googleapis.com/css2?family=Inter…')`. Es una petición
externa y bloqueante en una aplicación que aspira a estar instalada en el móvil,
y una dependencia de terceros de más.

**Por qué se dejó.** Quitarla exige editar el fichero vendorizado del design
system, y la decisión D5 del change del esqueleto dice que ese fichero no se
toca nunca: es una copia literal de Claude Design que se sustituye entera cuando
el diseño cambie allí. Parchearlo rompería esa propiedad.

**Qué haría falta.** Autoalojar los ficheros de Inter (woff2) en `public/`,
declararlos con `@font-face` desde `app/styles/miga.css` —la capa propia— y
neutralizar el `@import` desde ahí, sin tocar `nocturne.css`. De paso entran en
el precaché del service worker y la aplicación deja de depender de Google para
renderizar texto.

---

## ~~Y una decisión que conviene tomar ANTES de la primera pantalla de recetas~~

> **RESUELTA el 2026-08-26.** El modelo de recetas e ingredientes está decidido
> entero y escrito en `changes/archive/2026-08-29-add-pantry/design.md`, y el reparto en fases en
> `ROADMAP.md`. Se mantiene el texto de abajo porque plantea bien el problema.
> Dos matices sobre lo que decía: el catálogo es **privado de cada persona**, no
> global, y **no lleva alias** — al ser propio se puede renombrar y fusionar, que
> es lo que los alias venían a suplir. El razonamiento está en las decisiones D2
> y D3 de ese diseño.

No es trabajo aplazado, es una elección de modelo de datos que se vuelve cara
después: **cómo se identifican los ingredientes**.

Todo el valor de «Mi cocina» —el «4/7 ingredientes», el «Tienes todo», el filtro
de «solo con lo que tengo en casa»— depende de que *cebolla* en una receta y
*cebolla* en la despensa sean la misma fila. Con texto libre eso se degrada en
cuanto alguien escriba «cebolla morada», y rehacerlo más tarde significa migrar
datos que ya existen. Merece una tabla `ingredients` canónica con alias desde el
primer día.
