## Why

Cocinetas promete decirte qué puedes cocinar **ahora mismo, con lo que tienes en
casa**. Todo ese valor —el «4/7 ingredientes», el «Tienes todo», el filtro de
«solo con lo que tengo»— depende de una única condición: que *cebolla* en una
receta y *cebolla* en la despensa sean la misma fila. Con texto libre eso se
degrada en cuanto alguien escriba «cebolla morada», y rehacerlo después significa
migrar datos que ya existen.

Esta fase construye esa condición antes de que haya una sola receta, y la
demuestra con la pantalla más pequeña que la usa de verdad: la despensa.

Va primero, y no las recetas, por una razón de producto: el catálogo de
ingredientes empieza vacío, así que las primeras recetas se teclearían sin una
sola sugerencia. **La despensa es el mecanismo de siembra del catálogo.** Cuando
llegue la receta número uno, el vocabulario ya existe y el autocompletado ya
funciona.

## What Changes

- **Catálogo de ingredientes por persona.** Una tabla de ingredientes privada
  para cada cuenta, con nombre normalizado —sin tildes, sin mayúsculas, sin
  espacios de sobra— y unicidad por perfil. Escribir una palabra es añadirla al
  catálogo: la resolución buscar-o-crear nunca falla.
- **Ingredientes que se dan por supuestos.** Sal, aceite, pimienta y agua nacen
  marcados como «se asume que los tienes». No aparecen en la despensa y no
  contarán en la cobertura de una receta. No se siembra ninguna fila: solo se le
  da un valor inicial distinto a las filas que la persona cree.
- **Despensa binaria.** La fila existe o no existe. No hay cantidades: la
  promesa del producto necesita presencia, no inventario, y un inventario
  obligaría a descontar al cocinar, cosa que nadie hace.
- **Reparar el vocabulario.** Renombrar un ingrediente y fusionar dos que
  resultaron ser el mismo. Al ser el catálogo privado, las dos operaciones son
  seguras: solo afectan a quien las hace.
- **Pantalla «Mi cocina».** Ver lo que tienes, buscar con autocompletado sobre tu
  propio catálogo, añadir, quitar.
- **Barrido de huérfanos.** Un ingrediente que no usa ninguna receta ni está en
  la despensa se puede borrar. No hace daño, pero ensucia el autocompletado —y
  un autocompletado con la errata dentro invita a volver a elegirla.

Sin cambios que rompan nada: no hay datos previos de ingredientes ni de despensa.

## Capabilities

### New Capabilities

- `ingredients`: el vocabulario de una persona. Cómo se crea un ingrediente a
  partir de un texto, cómo se decide que dos textos son el mismo ingrediente,
  qué se puede renombrar y fusionar, y qué significa que un ingrediente se dé por
  supuesto.
- `pantry`: qué tiene una persona en casa. Cómo se añade y se quita, por qué es
  una marca y no una cantidad, y qué ingredientes nunca aparecen en ella.

### Modified Capabilities

Ninguna. `app-shell` y `user-auth` se usan tal cual están: esta fase añade una
ruta protegida más y no cambia ningún requisito suyo.

## Impact

**Base de datos.** Dos tablas nuevas en `public`, ambas con RLS y con la misma
frase de aislamiento que ya usa `profiles`: `perfil_id = auth.uid()`.

Los privilegios hay que **revocarlos explícitamente**. Supabase trae en el
esquema `public` un `alter default privileges` que concede todo sobre cualquier
tabla nueva a `anon`, `authenticated` y `service_role`. Le pasó a `profiles` y
hizo falta una segunda migración para corregirlo
(`20260823010000_privilegios_profiles.sql`). Estas dos tablas nacen ya con los
privilegios ajustados a lo que la migración pretende, no a lo que Postgres
regala.

**Interfaz.** Una ruta protegida nueva y su navegación. Es la primera pantalla de
contenido real de la aplicación: hasta ahora solo existía el saludo del
esqueleto.

**Dependencias.** Ninguna nueva. Se resuelve con lo que ya hay: React Router,
`@supabase/ssr` y CSS Modules sobre los tokens del design system.

**Lo que esta fase NO hace.** Recetas, pasos, el cruce entre despensa y receta,
fotos, importación desde vídeo. Y tampoco alias: al poder renombrar y fusionar
sobre un catálogo propio, una tabla de equivalencias no protege de nada que estas
dos operaciones no reparen ya. El reparto completo está en `openspec/ROADMAP.md`.
