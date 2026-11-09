## Context

La motivación está en `proposal.md`. Aquí va lo que hay y lo que condiciona cómo
se hace.

El modelo se decidió entero en `changes/archive/2026-08-29-add-pantry/design.md`
y este change no lo renegocia. Lo que el cruce necesita ya existe:

```
  recipes ─▶ recipe_ingredients ─▶ ingredients ◀─ pantry
              ingrediente_id          se_asume     (perfil_id, ingrediente_id)
              [+ opcional]   ← lo único que falta
```

- `ingredients.se_asume` existe desde la fase 1 y nace marcado para sal,
  aceite, pimienta y agua (D7 de la fase 1).
- `pantry` es binaria, sin cantidades, con clave primaria
  `(perfil_id, ingrediente_id)` (D6 de la fase 1).
- `recipe_ingredients` no lleva `unique (receta_id, ingrediente_id)`: una receta
  puede llevar dos líneas del mismo ingrediente a propósito.
- `opcional` no existe. D7 de la fase 1 la nombró como propiedad de la línea y
  advirtió que no se fundiera con `se_asume`, pero la fase 2 no la creó porque
  nada la usaba todavía. Ahora sí hay algo que la usa, y por eso entra aquí, lo
  que cumple la regla de que ninguna columna nace antes que quien la use.
- La fase 2 dejó un aviso (D8 de `add-recipes`): exigir al menos una línea para
  terminar una receta no evita el denominador cero, porque una receta con solo
  básicos lo tiene igual. La spec lo resuelve con «Tienes todo», nunca «0/0».

Hay dos restricciones técnicas heredadas:

- **Las vistas se saltan la RLS por defecto.** Una vista normal se ejecuta con
  los privilegios de su dueño, que en Supabase es `postgres` y no está sujeto a
  RLS. Por eso el ROADMAP exige `security_invoker = true`.
- **Los privilegios por defecto de Supabase no son de fiar.** La fase 1 necesitó
  dos migraciones correctoras, y la fase 2 descubrió que las funciones nacen con
  `EXECUTE` para PUBLIC. Para las tablas, una relación nueva nace ya sin
  privilegios desde `20260829000000`. Que eso valga también para las vistas
  está por comprobar, y se comprueba en vez de suponerlo.

## Goals / Non-Goals

**Goals:**

- Que la regla de qué cuenta y qué no esté escrita **en un solo sitio**, y que la
  lista y el detalle no puedan dar cifras distintas para la misma receta.
- Que la cobertura respete la RLS por construcción, no por cuidado de cada
  consulta.
- Que la receta que la fase 4 querrá guardar en el dispositivo siga siendo la
  misma consulta de siempre, sin datos de la despensa mezclados dentro.

**Non-Goals:**

- Cobertura de borradores. La vista la calcula, porque no distingue estados,
  pero la interfaz no la muestra (véase la spec).
- Guardar la cobertura en una tabla, o en caché. Se calcula en cada lectura.
- Cualquier acción desde lo que falta: añadirlo a la despensa con un toque, o
  una lista de la compra. Es tentador y es otro change.

## Decisions

### D1 — Dos vistas en cadena: una por línea y otra por receta

```
  recipe_line_coverage      una fila por LÍNEA: estado ∈ tiene | falta | supuesto | opcional
          │
          ▼  (se agrega desde la de arriba, no desde las tablas)
  recipe_coverage           una fila por RECETA: necesarios, tienes, faltan, faltan_nombres[]
```

La primera calcula el estado de cada línea, con esta precedencia:

```
  opcional   si la línea es opcional            (gana aunque el ingrediente se asuma)
  supuesto   si el ingrediente se da por supuesto
  tiene      si está en la despensa
  falta      en otro caso
```

La segunda **no vuelve a leer los ingredientes ni la despensa**. Solo lee
`recipes`, para que haya una fila por receta aunque no tenga líneas, y agrega
la primera contando los
ingredientes distintos de las líneas en `tiene` o `falta`, que son los
necesarios. Con eso, «dos líneas del mismo ingrediente cuentan una vez» sale
gratis con `count(distinct ingrediente_id)`, y lo mismo «opcional en una línea y
necesario en otra cuenta como necesario»: la línea no opcional aporta el
ingrediente a la cuenta y la opcional no resta nada.

El detalle lee la vista por línea y la lista lee la vista por receta. Como la
segunda se deriva de la primera, **no hay dos implementaciones de la regla que
puedan divergir**, que es lo que exige el escenario «Lista y detalle coinciden».

**Alternativa descartada: una sola vista por receta, y el estado de cada línea
calculado en TypeScript.** Es la que pedía el ROADMAP («una vista»), y obliga a
repetir la precedencia opcional > supuesto > despensa en el código de la ruta.
El día que cambie, cambiará en un sitio y se olvidará en el otro. Que haya dos
vistas en lugar de una no cambia el modelo, porque ninguna guarda nada.

**Alternativa descartada: calcular todo en TypeScript** a partir de la receta y
la despensa. Habría que traer la despensa entera en cada carga de la lista, y la
regla quedaría fuera de la base de datos, donde no se puede comprobar con SQL.

### D2 — `security_invoker = true`, y la unión con la despensa lleva el perfil

Las dos vistas se declaran `with (security_invoker = true)`, así que cada tabla
por debajo aplica su RLS a quien consulta. La vista por receta, al leer de la
otra, lo hereda.

La unión con `pantry` se hace por `(perfil_id, ingrediente_id)`, que es su clave
primaria. Unir solo por `ingrediente_id` daría el mismo resultado: la clave
ajena compuesta de `pantry` contra `ingredients (id, perfil_id)` ya obliga a que
una fila de despensa y su ingrediente sean del mismo perfil. Se une por las dos
columnas de todas formas, porque así se lee en la propia vista que se cruza la
despensa **del dueño de la receta**, sin tener que saber qué garantiza otra
migración, y porque es exactamente la clave del índice.

Privilegios, según la D8 de la fase 1: `revoke all ... from anon, authenticated`
y después `grant select ... to authenticated`. Lo que hay que comprobar es el
resultado, no el SQL. Se comprueba en local y otra vez en producción después del
`db push`, con la clave anónima (debe dar 42501) y con dos cuentas (cada una ve
solo lo suyo), igual que se hizo con `finalizar_receta` en la fase 2.

### D3 — La cobertura va en una consulta aparte, no dentro de la receta

`leerReceta` trae la receta entera en una sola consulta (`RECETA_COMPLETA`). La
D2 de la fase 2 lo justificó así: la fase 4 tendrá que guardar la receta en el
dispositivo como un documento. La cobertura **no entra en ese documento**. La
receta solo cambia cuando la editas; la cobertura cambia cada vez que tocas la
despensa. Un documento guardado con la cobertura dentro estaría desfasado en
cuanto añadieras algo a la despensa.

El detalle hace dos lecturas en paralelo: la receta, como siempre, y las filas
de la vista por línea para esa receta. Se unen por id de línea en la ruta.

### D4 — Ordenar y filtrar en el `loader`, con el filtro en la URL

La lista ya lee las recetas en una consulta. Ahora lee además `recipe_coverage`
en otra, y las une por id de receta en `recetario.server.ts`.

- **Orden de las terminadas:** por `faltan` de menor a mayor. A igualdad, por
  título alfabético en español (`localeCompare` con `"es"`), y por id si
  coincide el título. El título es estable porque una receta terminada no se
  edita (D8 de la fase 2), y es lo que una persona espera de una lista. El orden
  por la última edición, que es el de ahora, no cumple «predecible» en cuanto se
  mezcla con la cobertura. Los borradores se quedan como estaban.
- **Filtro:** un parámetro de búsqueda, `?solo=en-casa`, y un enlace que lo pone
  y lo quita. Es un `<Link>` y no un interruptor con JavaScript, así que
  funciona sin JavaScript, se puede recargar y se puede enlazar, que es lo que
  pide la spec. Con el filtro puesto se ocultan también los borradores, porque
  la pregunta es «qué puedo cocinar» y un borrador no se cocina.

Se hace en el servidor de la aplicación y no en SQL porque el conjunto es
pequeño (las recetas de una persona) y la unión con la lista de borradores ya
vive ahí. Pasar el orden a SQL no ahorraría nada medible.

### D5 — `opcional`: columna booleana, casilla que se guarda al instante

`alter table recipe_ingredients add column opcional boolean not null default
false`. Las filas que ya existen quedan como no opcionales, que es lo que eran.
No hace falta un `grant` nuevo, porque `authenticated` tiene `update` sobre la
tabla entera y eso incluye las columnas nuevas.

En el editor es una casilla por línea. No pasa por el guardado al vuelo con
retardo de los campos de texto: una casilla es un cambio entero, no un tecleo a
medias, así que se envía en cuanto cambia, por el mismo camino (`linea-guardar`)
y con el mismo manejo de errores. `guardarLinea` acepta `opcional` junto a
`cantidad` y `nota`.

`fusionar_ingredientes` no cambia, porque la marca viaja con la línea al
reasignarse. `finalizar_receta` tampoco: la spec de `recipes` dice que una
receta con todas sus líneas opcionales se puede terminar.

### D6 — Sin índices nuevos

El ROADMAP preveía «un par de índices», y no hacen falta. Las uniones de la
vista van por claves que ya están indexadas: `pantry (perfil_id,
ingrediente_id)` es la clave primaria, `ingredients.id` también, y
`recipe_ingredients` tiene índice por `receta_id` y por `ingrediente_id`. Con las
recetas de una sola persona, un índice especulativo cuesta en cada escritura y
no se nota en ninguna lectura. Si el `explain` de la vista con datos reales
muestra un recorrido secuencial que importe, se añade entonces.

### D7 — Cada estado se dice con palabras, no solo con color

En el detalle, cada línea lleva una etiqueta de texto: «Lo tienes», «Falta»,
«Se da por supuesto» u «Opcional». Se usan las etiquetas (`tag`) del design
system, que ya tienen variante de color, pero el color acompaña al texto y no lo
sustituye. En la lista, «Tienes todo» va como etiqueta, y la fracción y «Falta:
…» como texto secundario junto al título.

## Risks / Trade-offs

**[La despensa no se parece a la realidad]** → Es el riesgo mayor del producto,
ya anotado en la fase 1, y aquí es donde se nota: un «Tienes todo» sobre una
despensa vieja te manda a cocinar sin huevos. Mitigación: en el detalle, lo que
se da por supuesto se muestra como supuesto, no como comprobado, y los
ingredientes que faltan se nombran en la lista. No hay forma de que el sistema
sepa lo que se acabó; puede, como mucho, no fingir que lo sabe.

**[Una vista olvida `security_invoker`, o la siguiente fase añade otra sin él]**
→ No falla de forma visible: con una sola cuenta todo parece funcionar. La única
prueba que lo demuestra es la de dos cuentas, y por eso va como tarea, contra
local y contra producción. La migración lo explica en un comentario, como se ha
hecho con cada trampa de privilegios anterior.

**[Las vistas nacen con privilegios que nadie pidió]** → Las tablas ya no, desde
`20260829000000`. Las funciones sí, y lo descubrió la fase 2. Las vistas no se
han comprobado nunca. Mitigación: `revoke` y `grant` explícitos en la migración,
y comprobar los privilegios efectivos de la vista con `db diff --linked` y con la
clave anónima.

**[El orden cambia bajo la persona]** → Añadir algo a la despensa puede mover
una receta a otra posición de la lista. Es lo esperable, porque el orden dice lo
que tienes, pero quien vuelva a la lista buscando una receta por su posición no
la encontrará donde estaba. Se acepta.

**[La regla del supuesto es global]** → Un alioli con mucho aceite tampoco lo
contará. Se aceptó en la D7 de la fase 1 y no se reabre aquí. Si molesta en una
receta concreta, quitar la marca al aceite lo arregla para todas.

## Migration Plan

Una migración, `supabase/migrations/<fecha>_recipe_coverage.sql`, con la columna
`opcional`, las dos vistas, sus privilegios y comentarios que expliquen
`security_invoker`. No hay datos que migrar: las líneas que ya existen toman el
valor por defecto.

1. `supabase db reset` en local y las comprobaciones de las tareas.
2. `supabase db diff --linked` antes de subir, leyendo los privilegios de las
   vistas en el diff y no en el fichero.
3. `supabase db push`, y repetir contra producción las comprobaciones de
   privilegios: la clave anónima y las dos cuentas.
4. Desplegar la aplicación. Una aplicación vieja sobre la base nueva funciona,
   porque solo ignora la columna y las vistas. Por eso el orden es primero la
   base y después la aplicación.

Vuelta atrás: `drop view recipe_coverage`, después `drop view
recipe_line_coverage`, en ese orden porque la primera depende de la segunda, y
`alter table recipe_ingredients drop column opcional`. Solo se pierde qué líneas
eran opcionales.

## Open Questions

- **El texto exacto de las etiquetas** («Lo tienes» o «En casa», «Se da por
  supuesto» o «Básico»). La spec fija los cuatro estados y que se lean sin
  color, no las palabras. Se decide al verlo en pantalla, junto a la lista de
  la despensa, para que use el mismo vocabulario.
