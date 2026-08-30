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

## 3. Producción está en Cloudflare, y España bloquea las IPs de Cloudflare

**Qué pasa hoy.** La aplicación se despliega en Cloudflare Workers, en
`cocinetas.cocinetas.workers.dev`. Los operadores españoles anulan por orden
judicial rangos de IP de Cloudflare —las medidas antipiratería que promueve
LaLiga—, en ventanas alrededor de los partidos. El daño colateral se lleva por
delante todo lo alojado ahí, tenga o no que ver con el fútbol. Cocinetas es una
aplicación íntegramente en español, para gente en España: el bloqueo cae justo
sobre su único mercado.

Comprobado el 2026-08-29: el despliegue estaba **vivo y sirviendo al 100%**
(versión `17133662`, subida a las 17:25Z) y el DNS resolvía sin problema a
`188.114.97.5`. Aun así el navegador no llegaba, con `ERR_QUIC_PROTOCOL_ERROR`.
No es una avería de la aplicación: el paquete no pasa.

**Por qué se dejó.** Hoy Cocinetas tiene un usuario, que es quien la escribe, y
el bloqueo es por ventanas, no permanente. Migrar de alojamiento con la fase 2
sin empezar es gastar el esfuerzo en el peor momento posible. Además no urge
tanto como parece: el problema está acotado al alojamiento de la aplicación,
porque **Supabase no está afectado** —vive en AWS— y por tanto los datos, la
autenticación y la RLS siguen igual se mueva lo que se mueva.

**Qué haría falta.** No estar en una IP de Cloudflare. Como el bloqueo va contra
rangos de CDN, casi cualquier otra cosa sirve: un VPS con IP propia, Fly, Render,
Railway, Vercel. Y es más barato de lo que parece, porque el acoplamiento medido
es mínimo:

```
  app/lib/supabase.server.ts   import { env } from "cloudflare:workers"   ← 1 línea
  workers/app.ts               10 líneas, handler genérico de React Router
  wrangler.jsonc               configuración de despliegue
  vite.config.ts               @cloudflare/vite-plugin
  app/env.d.ts                 tipos del entorno
```

Una línea de código de aplicación. React Router v8 en framework mode no depende
del host: lo específico de Cloudflare es el adaptador, no la aplicación. **El
framework y el host son separables**, y mover el host no es reescribir nada.

**Cuidado con las dos reacciones intuitivas, que no funcionan.** El bloqueo es
**por IP**, no por nombre:

- Comprar un dominio propio no arregla nada. `cocinetas.es` resolvería a las
  mismas IPs anycast de Cloudflare. Se cambia el nombre, no la dirección, y la
  orden va contra la dirección. No gastes dinero ahí creyendo que lo resuelve.
- Cambiar de DNS tampoco —ni 1.1.1.1, ni 8.8.8.8, ni DNS-over-HTTPS—. Eso
  esquiva bloqueos por DNS, y este no lo es: el nombre resuelve perfectamente.

Para verificar en local mientras dure, **una VPN sí funciona**: saca el tráfico
de la ruta nula del operador.

**Y una decisión que esto revisa.** La D1 del esqueleto eligió Cloudflare Workers
comparándolo con Next.js sobre Vercel y con TanStack Start. En esa comparación no
entró que el mercado objetivo de la aplicación es exactamente el país donde esas
IPs se bloquean. No invalida la elección del framework, pero convierte «Workers»
en una decisión revisable en vez de en un cimiento.

---

## 4. La aplicación no funciona sin red, y un recetario debería

**Qué pasa hoy.** El esqueleto renderiza en el servidor y cada navegación
necesita al servidor: la sesión viaja en cookies que solo el servidor lee, y cada
`loader` consulta Supabase. El service worker existe por la instalabilidad, pero
solo precachea el armazón, no tus datos. Sin red, la aplicación no hace nada.

**Por qué importa más de lo que parece.** Un recetario es el caso arquetípico de
aplicación que debería funcionar sin conexión: abres la receta, cocinas veinte
minutos, y no necesitas el servidor para nada en todo ese rato. El escenario real
es un móvil en la encimera, con las manos sucias y el wifi que no llega a la
cocina.

Y se cruza con la entrada 3: si el modo cocina funcionara con la receta ya en el
dispositivo, un bloqueo de IPs durante un partido dejaría de ser «la aplicación
no va» y pasaría a ser «no puedo crear recetas nuevas hasta luego». Pero eso es
la consecuencia, no el motivo: se hace porque **es mejor producto**, y el bloqueo
solo ha adelantado el momento de verlo.

**Por qué se dejó.** No es un fallo: es una tensión entre dos cosas buenas, y
tira contra decisiones del esqueleto que se tomaron con razones sólidas —que el
servidor sepa quién pide la página en el primer byte, y que no haya un parpadeo
en blanco mientras se resuelve la sesión—. Reconciliarlas es trabajo de diseño de
verdad, no un parche, y no cabía en la fase 1.

**Qué haría falta.** Antes que nada, decidir **qué tiene que sobrevivir sin red**,
que casi seguro no es todo. El mínimo defendible: una receta finalizada que ya se
haya abierto, y el modo cocina sobre ella. Eso implica guardar la receta y sus
pasos en el dispositivo, y que la interfaz sepa leer de ahí cuando el `loader` no
alcanza el servidor. Y decidir qué pasa con las escrituras sin red: encolarlas y
sincronizar después, o negarse y decirlo claro. Encolar es mucho más trabajo y
trae conflictos de sincronización; negarse es honesto y casi gratis.

**El momento natural es la fase 4**, el modo cocina, que es la pantalla que más lo
pide y la que menos necesita el servidor. Conviene no llegar ahí sin haberlo
pensado, porque si el modo cocina se construye asumiendo servidor, volver luego
cuesta el doble.

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
