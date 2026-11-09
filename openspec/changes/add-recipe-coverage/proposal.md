## Why

Hasta aquí Cocinetas guarda dos cosas por separado: lo que tienes en casa (fase
1) y lo que sabes cocinar (fase 2). Todavía no las cruza, y ese cruce es la
razón de ser del producto: abrir el recetario y ver qué puedes hacer **ahora**,
sin ir a la compra. Sin él, Cocinetas es un recetario más.

Va ahora porque ya tiene todo lo que necesita. Las recetas terminadas tienen
líneas que apuntan al catálogo, la despensa apunta al mismo catálogo y los
básicos ya vienen marcados como «se da por supuesto». El trabajo que falta es
pequeño, pero lleva change y spec propios porque es la idea central del producto.

## What Changes

- **La cobertura de una receta.** Para cada receta, cuántos de los ingredientes
  que de verdad necesita tienes en la despensa. Fuera del recuento quedan dos
  cosas: los ingredientes que se dan por supuestos (sal, aceite) y las líneas
  opcionales. Dos líneas del mismo ingrediente cuentan como uno.
- **Las líneas opcionales.** Una línea de receta se puede marcar como opcional
  («perejil para decorar»). Es lo que la decisión D7 de la fase 1 separó a
  propósito de «se da por supuesto»: lo segundo es del ingrediente y vale para
  todas las recetas, lo primero es de una línea de una receta. Se añade una
  columna a `recipe_ingredients` y una casilla por línea en el editor, que se
  guarda al vuelo como todo lo demás.
- **La lista de recetas lo muestra.** Cada receta terminada lleva su «4/7» o un
  «Tienes todo». Si te faltan uno o dos ingredientes los nombra («Falta: nata»).
  Las recetas terminadas se ordenan de menos a más ingredientes que faltan.
- **El filtro «solo con lo que tengo en casa».** Deja en la lista solo las
  recetas a las que no les falta nada. Funciona sin JavaScript, como un enlace,
  porque la lista se tiene que poder leer sin él.
- **El detalle de la receta señala lo que falta.** Cada ingrediente aparece como
  «lo tienes», «falta», «se da por supuesto» u «opcional». Así el «Tienes todo»
  no promete más de lo que sabe: lo que se dio por supuesto se ve como supuesto,
  no como comprobado.
- **Una vista en la base de datos, `security_invoker = true`.** La regla de qué
  cuenta y qué no vive en un solo sitio, la vista, y la lista y el detalle leen
  de ella. Si la vista no se declara `security_invoker`, corre con los
  privilegios de quien la creó y se salta la RLS entera.

## Capabilities

### New Capabilities

- `recipe-coverage`: qué ingredientes necesita de verdad una receta, cuáles
  tienes, cómo se presenta el resultado en la lista y en el detalle, y el filtro
  de lo que se puede cocinar ya.

### Modified Capabilities

- `recipes`: las líneas de ingrediente pueden marcarse como opcionales, y esa
  marca se edita y se guarda igual que la cantidad y la nota.

## Impact

- **Base de datos**: una migración con la columna
  `recipe_ingredients.opcional` (booleana, no nula, falsa por defecto) y la vista
  de cobertura, con privilegios explícitos: se revoca todo y se concede `select`
  a `authenticated`. No añade tablas. Las filas que ya existen quedan como no
  opcionales, que es lo que eran.
- **Código**: `app/lib/recetario.server.ts` (leer la cobertura, guardar la marca
  de opcional), `app/routes/recetas.tsx` (insignia, orden, faltantes y filtro),
  `app/routes/receta.tsx` (estado de cada línea) y `app/routes/receta.editar.tsx`
  (la casilla de opcional).
- **Documentación**: en `openspec/ROADMAP.md`, la fase 3 pasa de «ninguna tabla
  nueva» a «ninguna tabla nueva, una columna», y apunta al change.
- **Fuera de esta fase**: «me falta poco» como filtro aparte (el orden por
  cobertura ya lo cubre), una lista de la compra con lo que falta, cantidades en
  la despensa y sustituciones de ingredientes. Ninguna entrada de
  `PENDIENTE.md` entra en el alcance.
