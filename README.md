# Cocinetas

Recetario de cocina. Aplicación web que se instala en el móvil: guardas lo que
sabes cocinar, marcas lo que tienes en casa, y te dice qué puedes hacer ahora
mismo con eso.

Ahora mismo esto es solo el esqueleto: registro, inicio de sesión y una pantalla
que te saluda. Las recetas vienen después.

## Qué necesitas antes de empezar

|                      | Para qué                                             |
| -------------------- | ---------------------------------------------------- |
| **Node 22**          | La aplicación                                        |
| **Docker** corriendo | Supabase en local levanta una docena de contenedores |
| **CLI de Supabase**  | `brew install supabase/tap/supabase`                 |

## Arrancar en local

```bash
npm install

# Levanta Postgres, autenticación, y Mailpit (un buzón de correo falso).
# La primera vez descarga las imágenes y tarda unos minutos.
supabase start

# Copia las credenciales que acaba de imprimir supabase start
cp .dev.vars.example .dev.vars
#   SUPABASE_URL      <- API_URL
#   SUPABASE_ANON_KEY <- ANON_KEY
# Si se te han ido de la pantalla: `supabase status`

npm run dev
```

En http://localhost:5173

Al registrarte, **el correo de confirmación no sale de tu máquina**: cae en
Mailpit, en http://localhost:54324. Ábrelo desde ahí y pulsa el enlace. El panel
de la base de datos está en http://localhost:54323.

## Comandos

|                     |                                                             |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Desarrollo, con recarga en caliente                         |
| `npm run build`     | Build de producción                                         |
| `npm run preview`   | Sirve el build, en el runtime real de Cloudflare            |
| `npm run typecheck` | Tipos                                                       |
| `npm run lint`      | ESLint, incluidas las reglas de adherencia al design system |
| `npm run format`    | Prettier                                                    |
| `supabase status`   | Las URLs y claves locales                                   |
| `supabase db reset` | Rehace la base de datos desde las migraciones               |
| `supabase stop`     | Apaga los contenedores                                      |

## Cómo está montado

```
  Navegador  ──▶  Cloudflare Worker  ──▶  Supabase
                  React Router SSR        Postgres + RLS
                  loader / action         autenticación
                  cookies HttpOnly
```

La sesión viaja en **cookies**, no en `localStorage`. Eso es lo que permite que
el servidor sepa quién pide la página y la renderice ya personalizada en el
primer byte. Cada `loader` y cada `action` crea su propio cliente de Supabase
con las cookies de esa petición (`app/lib/supabase.server.ts`) y **devuelve unas
`headers` que hay que propagar en la respuesta**: ahí viajan las `Set-Cookie`
con las que la sesión se renueva sola. Si se pierden, la sesión muere a mitad
de uso.

El aislamiento entre usuarios está en la base de datos, no en el código: las
políticas RLS de `supabase/migrations/` impiden que nadie lea ni escriba el
perfil de otro aunque un `loader` se equivoque de filtro.

### Estilos

```
  app/styles/nocturne.css   el design system, copiado tal cual — NO SE TOCA
  app/styles/miga.css       la paleta de Cocinetas, encima
  app/styles/app.css        el shell de móvil
  *.module.css              lo propio de cada pantalla
```

`nocturne.css` viene del proyecto de Claude Design y se sustituye entero cuando
cambie allí; por eso no se edita nunca. Todo lo nuestro va en `miga.css`, que
además corrige cuatro reglas de Nocturne escritas para fondo oscuro.

**Regla que el lint impone:** ni un color, ni una distancia, ni una fuente a
mano. Todo sale de `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`,
`var(--shadow-*)`. Si escribes un `#b25c3c` o un `16px` en un `.tsx`, ESLint
falla — y tiene razón.

Solo hay un tema, la paleta cálida clara `miga`. No se sigue el modo oscuro del
sistema: un teléfono en oscuro ve exactamente los mismos colores.

## Desplegar

Desplegado en **https://cocinetas.cocinetas.workers.dev**

```bash
npx wrangler login

# Crea el proyecto en supabase.com y enlaza este repositorio con él
supabase link --project-ref <ref>
supabase db push          # lleva las migraciones a la nube

npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY

npm run deploy
```

## Trabajar en esto

Las decisiones y su porqué están en `openspec/`, no en la cabeza de nadie.
Antes de tocar arquitectura, mira `openspec/changes/*/design.md`: explica qué se
eligió, qué se descartó y por qué.
