El orden va de abajo arriba: primero la base de datos, comprobada por SQL antes
de que exista ninguna pantalla; después la marca de opcional, porque sin ella el
cruce da cifras falsas en cualquier receta con perejil de decorar; y al final la
lista y el detalle.

Hitos: al acabar el grupo 1 la cobertura se puede consultar por SQL y es
privada; al acabar el 2 se pueden marcar líneas opcionales; al acabar el 4 la
fase está entregada.

## 1. Base de datos

- [x] 1.1 Migración `supabase/migrations/<fecha>_recipe_coverage.sql` que añade `recipe_ingredients.opcional boolean not null default false`. Verificar tras `supabase db reset` que las líneas que ya existen quedan con `opcional = false` y que `authenticated` puede actualizar la columna sin ningún `grant` nuevo
- [x] 1.2 Crear `public.recipe_line_coverage` con `security_invoker = true`: una fila por línea, con `receta_id`, `linea_id`, `ingrediente_id`, `nombre` y `estado`, y la precedencia opcional > supuesto > tiene > falta de la D1. Unir con `pantry` por `(perfil_id, ingrediente_id)`. Verificar con una receta de prueba que cada uno de los cuatro estados sale donde debe, incluida una línea de sal marcada como opcional, que tiene que salir `opcional`
- [x] 1.3 Crear `public.recipe_coverage` con `security_invoker = true`, agregando **desde `recipe_line_coverage` y no desde las tablas**: `receta_id`, `necesarios`, `tienes`, `faltan` y `faltan_nombres` (ordenado por nombre), contando `count(distinct ingrediente_id)` sobre las líneas en `tiene` o `falta`. Verificar los escenarios de la spec por SQL: dos líneas de aceite cuentan una vez, perejil opcional más perejil no opcional cuenta como necesario, y una receta de solo básicos da `necesarios = 0`, no `null` y sin desaparecer de la vista
- [x] 1.4 Privilegios explícitos en las dos vistas: `revoke all ... from anon, authenticated` y `grant select ... to authenticated`. Comentar en la migración por qué `security_invoker` es obligatorio, y lo que se descubra sobre los privilegios por defecto de las vistas. Verificar en `pg_class.relacl` qué tienen las vistas de verdad, en vez de suponerlo
- [x] 1.5 Comprobar el aislamiento con dos cuentas en local: cada una ve solo las filas de sus recetas en las dos vistas, y la cobertura de cada una se calcula con su propia despensa. Con la clave anónima, las dos vistas deben dar 42501
- [x] 1.6 Mirar el `explain` de `recipe_coverage` filtrada por una persona con una decena de recetas. Verificar que no hay un recorrido secuencial sobre `pantry` ni sobre `recipe_ingredients` que justifique un índice (D6). Si lo hay, el índice entra en esta misma migración y se anota el motivo
- [x] 1.7 `supabase db diff --linked` antes de subir, leyendo los privilegios de las vistas en el diff. Después `supabase db push`, y repetir contra producción la comprobación de la clave anónima (42501 en las dos vistas)

## 2. Líneas opcionales en el editor

- [x] 2.1 Leer `opcional` en `RECETA_COMPLETA` y en el tipo `LineaReceta`, y aceptar `opcional` en `guardarLinea` y en la intención `linea-guardar` del editor. Verificar por la red que marcar y desmarcar manda un booleano y la fila cambia
- [x] 2.2 Casilla «Opcional» por línea en el editor, que se envía en cuanto cambia y no con el retardo de los campos de texto, por un `fetcher` propio de la fila y con el aviso de error pegado a ella como los demás campos. Verificar que al recargar la casilla sigue como se dejó, y que un fallo de red se dice en vez de quedarse marcada en falso — **Salvedad:** el caso del fallo de red no se cumple. Tumba la pantalla entera en vez de avisar en la fila, y pasa igual con los campos de texto de la fase 2. Se aplazó a la entrada 6 de `PENDIENTE.md`
- [x] 2.3 Verificar los escenarios de `specs/recipes` de este change: una línea nueva nace no opcional, la marca no pasa a otra receta ni al catálogo, y una receta con todas sus líneas opcionales se puede terminar

## 3. La lista: cobertura, orden y filtro

- [x] 3.1 En `recetario.server.ts`, leer `recipe_coverage` y unirla con las recetas terminadas por id, en paralelo con la lectura de la lista. Los borradores no llevan cobertura. Verificar que la lista sigue cargando para una cuenta sin recetas y para una con solo borradores
- [x] 3.2 Ordenar las terminadas por `faltan` de menor a mayor, después por título con `localeCompare(…, "es")` y por último por id (D4). Los borradores siguen en su orden de siempre. Verificar con tres recetas a las que faltan 3, 0 y 1 ingredientes, y con dos que empatan, que salen en orden alfabético con tildes bien ordenadas
- [x] 3.3 Mostrar junto a cada terminada «Tienes todo» como etiqueta si `faltan = 0`, incluido `necesarios = 0`, y si no, la fracción `tienes/necesarios`. Con uno o dos que falten, nombrarlos: «Falta: nata», «Faltan: nata y puerro». Verificar los cuatro escenarios de la spec, incluido el de solo básicos, que no puede mostrar «0/0»
- [x] 3.4 Filtro «solo con lo que tengo en casa» como enlace a `?solo=en-casa`, y otro para quitarlo, leído en el `loader`. Con el filtro puesto se ocultan los borradores y se ve que está puesto. Si no queda ninguna receta, un mensaje que lo dice y enlaza a la lista entera. Verificar recargando con el filtro puesto, y con JavaScript deshabilitado

## 4. El detalle, e integración

- [x] 4.1 En el `loader` del detalle, leer `recipe_line_coverage` para esa receta en paralelo con `leerReceta`, **sin tocar `RECETA_COMPLETA` para meterle la cobertura** (D3). Unir por id de línea. Verificar que la consulta de la receta es la misma de antes, salvo la columna `opcional`
- [x] 4.2 Etiqueta de texto por línea con su estado, y la misma cobertura que la lista en la cabecera. Decidir aquí el texto de las etiquetas (pregunta abierta del diseño), con el mismo vocabulario que la pantalla de Mi cocina. Verificar la receta del escenario «Una receta con de todo», y que la fracción del detalle coincide con la de la lista
- [x] 4.3 Verificar que el estado de cada línea se entiende sin color, con un lector de pantalla (VoiceOver), y que el detalle sigue siendo legible con JavaScript deshabilitado
- [x] 4.4 Estilos en CSS Modules sobre los tokens del design system, sin valores literales. Verificar que `npm run lint` pasa, incluidas las reglas de adherencia, y que la lista con etiquetas y faltantes se lee a ancho de teléfono sin desbordar
- [x] 4.5 Actualizar `openspec/ROADMAP.md`: la fase 3 pasa a «ninguna tabla nueva; una columna (`recipe_ingredients.opcional`) y dos vistas», con el motivo de las dos vistas (D1), y se marca como hecha con el change al archivar. Verificar que el texto de la fase coincide con lo construido

## 5. Verificación final

- [x] 5.1 Recorrer a mano todos los escenarios de `specs/recipe-coverage` contra la aplicación en marcha, con dos cuentas para los de privacidad. Cambiar la despensa y la marca de «se da por supuesto» desde Mi cocina y comprobar que la lista y el detalle lo reflejan al volver
- [x] 5.2 Con recetas reales, no de prueba: poner el filtro y comprobar que lo que sale es de verdad lo que se puede cocinar con lo que hay en casa
- [x] 5.3 Pasar `npm run typecheck`, `npm run lint` y `npm run format:check` en limpio
