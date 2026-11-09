El orden entrega un editor de borradores usable a mitad de camino, en vez de una
lista bonita que solo se puede llenar por SQL. El ROADMAP proponía lo contrario
—modelo, lista y detalle primero, editor después— y él mismo anotaba la pega:
ese entregable intermedio no lo puede usar nadie sin acceso a la base de datos.
Aquí la lista llega antes que el editor, pero mínima: existe para poder llegar a
un borrador, no como entregable.

Hitos: al acabar el grupo 3 se pueden crear borradores y verlos; al acabar el 4
se puede escribir una receta entera; al acabar el 5 la fase está cerrada.

## 1. Base de datos

- [x] 1.1 Crear `public.recipes` con `titulo` y `comensales` nullables, `finalizada_en` nullable como único indicador de estado, y `origen_tipo` con valor `manual`. Verificar que insertar una receta sin nada más que el perfil funciona: un borrador tiene que poder existir vacío
- [x] 1.2 Añadir a `recipes` el `check (finalizada_en is null or length(btrim(titulo)) > 0)`. Verificar que sellar la fecha con el título vacío falla con 23514, y que un borrador sin título se guarda sin problema
- [x] 1.3 Crear `public.recipe_ingredients` con `orden`, `cantidad` y `nota` de texto libre, y `ingrediente_id` NOT NULL contra `ingredients (id, perfil_id)` compuesto. Verificar que una línea que apunta a un ingrediente ajeno falla con 23503 aunque el `perfil_id` de la fila sea el propio
- [x] 1.4 **Sin `unique (receta_id, ingrediente_id)`** en las líneas: una receta lleva dos líneas del mismo ingrediente a propósito. Verificar insertando «100 ml de aceite» y «50 ml de aceite» en la misma receta
- [x] 1.5 **Sin `unique (receta_id, orden)`** ni en líneas ni en pasos, solo índice. Verificar que renumerar en bloque no revienta a mitad de sentencia, que es lo que esa restricción provocaría
- [x] 1.6 Crear `public.steps` con `orden` y `texto`. Añadir `unique (id, receta_id)` en `steps` y en `recipe_ingredients`: es lo que permite la clave ajena compuesta del punto siguiente, igual que `ingredients_id_perfil_key` en la fase 1
- [x] 1.7 Crear `public.step_ingredients` llevando `receta_id`, con dos claves ajenas compuestas —`(paso_id, receta_id)` y `(linea_id, receta_id)`—. Verificar que enlazar un paso de una receta con una línea de **otra receta de la misma persona** falla: la RLS por sí sola deja pasar ese caso
- [x] 1.8 Dar a esas dos claves ajenas comportamientos distintos a propósito: `on delete cascade` desde `steps`, `no action` desde `recipe_ingredients`. **`no action` y no `restrict`**, que es la lección de `pantry`: con `restrict` la comprobación es inmediata y borrar una receta entera fallaría. Verificar los tres casos —borrar un paso se lleva sus enlaces, borrar una línea enlazada falla con 23503, y borrar la receta entera funciona
- [x] 1.9 RLS y privilegios explícitos en las cuatro tablas: `revoke all from anon, authenticated` antes de conceder solo los verbos usados. Verificar con `information_schema.role_table_grants` que `anon` no tiene ninguno y `authenticated` exactamente los previstos
- [x] 1.10 Escribir `reordenar_pasos(receta_id, ids uuid[])` y su equivalente para las líneas, renumerando por posición en el array en una sola sentencia. Verificar que mover el noveno al segundo puesto deja los pasos sin huecos ni repeticiones
- [x] 1.11 Escribir `finalizar_receta(id)` como `security invoker`: comprueba título no vacío, al menos una línea y al menos un paso, y sella `finalizada_en` en la misma llamada. Verificar que cada carencia da un mensaje distinto en español y que ninguna deja la receta sellada
- [x] 1.12 Ampliar `fusionar_ingredientes` para reasignar también las líneas de receta —la migración de la fase 1 dejó señalado el sitio—, sin unir líneas entre sí. Verificar que tras fusionar dos ingredientes que aparecían en la misma receta quedan dos líneas, ambas al superviviente, cada una con su cantidad
- [x] 1.13 Comprobar el aislamiento de extremo a extremo con dos cuentas: con el rol `authenticated` y el JWT de una, `select` sobre las recetas, líneas, pasos y enlaces de la otra devuelve cero filas, y `update`/`delete` no afectan a ninguna
- [x] 1.14 Aplicar con `supabase db reset` y contrastar con `supabase db diff --linked` que no queda diferencia inesperada

## 2. Acceso a datos desde el servidor

- [x] 2.1 Módulo de servidor de recetas con la lectura de **una receta entera en una sola consulta** —receta, líneas, pasos y enlaces—, no repartida en varias: es lo que permitirá cachearla como documento en la fase 4. Verificar que `npm run typecheck` pasa y que la pantalla de detalle no dispara más de una consulta
- [x] 2.2 Lectura de la lista separando terminadas y borradores, sin filtrar por `perfil_id` en el código porque de eso responde la RLS. Verificar con una cuenta que tenga de los dos tipos
- [x] 2.3 Escrituras: crear, cambiar título y comensales, añadir/editar/borrar línea, añadir/editar/borrar paso, marcar y desmarcar enlaces, reordenar, finalizar, devolver a borrador y descartar. Verificar que cada error de Postgres se traduce a español —23503 al borrar una línea enlazada dice **qué pasos** la usan, no solo que está en uso
- [x] 2.4 Registrar las rutas nuevas en `app/routes.ts` y sus URLs en `app/rutas.ts`, en español como las existentes. Verificar que `npm run typecheck` regenera los tipos de ruta sin errores

## 3. Lista de recetas y crear

- [x] 3.1 Ruta protegida con las recetas terminadas y los borradores en secciones distintas. Verificar que sin sesión redirige a `/entrar` sin enviar contenido
- [x] 3.2 «Nueva receta» crea la fila y redirige al editor. Verificar que el borrador existe en la base de datos antes de que se pinte el editor: el guardado al vuelo no tiene dónde escribir si no
- [x] 3.3 Retirar sin preguntar los borradores sin título, sin líneas y sin pasos. Verificar que un borrador devuelto desde «terminada» **no** lo alcanza, porque tiene las tres cosas
- [x] 3.4 Descartar un borrador a mano, pidiendo confirmación aparte cuando tenga contenido. Verificar los dos casos: el vacío se va sin ceremonia, el lleno pregunta
- [x] 3.5 Estado vacío que explique para qué sirve el recetario y cómo empezar. Verificar con una cuenta recién creada

## 4. El editor

- [x] 4.1 Ruta del editor que cargue un borrador, y que ante una receta **terminada** redirija al detalle en vez de editar. Verificar entrando a mano en la URL del editor de una receta terminada
- [x] 4.2 Armazón del guardado al vuelo: un `fetcher` por campo o por fila —no uno para todo, que cancelaría el envío anterior—, disparado en `blur`, por temporizador y en `visibilitychange`. Verificar escribiendo un paso y cambiando de aplicación en el móvil sin salir del campo: al volver, el texto está
- [x] 4.3 Indicador de guardado y de error: el aviso queda pegado a la fila que falló y sigue visible después, y el indicador global no dice «Guardado» mientras quede algo sin guardar. Verificar provocando un fallo de red a mitad de edición
- [x] 4.4 Título y comensales, ambos opcionales mientras sea borrador. Verificar que dejarlos vacíos no impide nada hasta el momento de finalizar
- [x] 4.5 Líneas de ingrediente con `<datalist>` sobre el catálogo propio, más cantidad y nota de texto libre. Verificar que escribir «pak choi» por primera vez crea el ingrediente y lo deja disponible en las sugerencias siguientes
- [x] 4.6 Pasos con su texto. Verificar que un paso escrito por la mitad se guarda tal cual, sin tratarse como error
- [x] 4.7 Casillas por paso para declarar qué líneas usa, sobre las líneas de esa misma receta. Verificar que un paso sin ninguna marcada es válido y no impide finalizar
- [x] 4.8 Borrar líneas y pasos con la asimetría de D7: el paso se lleva sus enlaces, la línea enlazada se niega diciendo qué pasos la usan. Verificar los dos casos desde la interfaz, no solo por SQL
- [x] 4.9 Reordenar arrastrando, con asa y no arrastrando la fila entera —dentro de una lista que se desplaza, el gesto de arrastrar y el de desplazar son el mismo para un dedo—. Verificar en un teléfono de verdad, no en el emulador del navegador
- [x] 4.10 Elegir cómo se resuelve el arrastre táctil: la API nativa `draggable` es de ratón y en iOS no hace nada. Si entra una dependencia de cliente, es la primera del proyecto y se justifica en el commit. Verificar que `npm run build` no crece de forma desproporcionada
- [x] 4.11 Dar a reordenar un camino de teclado. No es respaldo sin JavaScript —D2 ya decidió que no se promete—, es accesibilidad: arrastrar no lo puede hacer un lector de pantalla. Verificar reordenando un paso solo con el teclado

## 5. Finalizar, ver y devolver a borrador

- [x] 5.1 Finalizar desde el editor, con el mensaje concreto de qué falta cuando no se puede. Verificar los tres casos: sin título, sin líneas, sin pasos
- [x] 5.2 Pantalla de detalle de una receta terminada: título, comensales si los hay, líneas y pasos. Verificar que es legible **con JavaScript deshabilitado**, que es lo que `app-shell` sigue exigiendo aunque el editor no lo prometa
- [x] 5.3 Devolver una receta a borrador desde el detalle, conservando todo el contenido. Verificar que vuelve a la sección de borradores y que finalizarla de nuevo la devuelve a su sitio

## 6. Integración

- [x] 6.1 Dar acceso al recetario desde la pantalla principal, y revisar qué pinta ahí ahora que las recetas son el centro de la aplicación. Verificar que se llega y se vuelve sin escribir la URL a mano
- [x] 6.2 Actualizar los mensajes de `cocina.server.ts`: `eliminarIngrediente` responde hoy al 23503 con «Ese ingrediente está en tu despensa», y a partir de ahora el motivo puede ser una receta. Verificar los dos motivos por separado
- [x] 6.3 Estilos en CSS Modules sobre los tokens del design system, sin un solo valor literal. Verificar que `npm run lint` pasa, incluidas las reglas de adherencia
- [x] 6.4 Propagar las `headers` de Supabase en toda respuesta de las rutas nuevas, **incluidas las de los `fetcher`**, que en este editor son la mayoría. Verificar que una sesión larga escribiendo una receta no expulsa
- [x] 6.5 Corregir `openspec/ROADMAP.md`, que nombra estas tablas en castellano (`recetas`, `pasos`, `pasos.segundo_video`) contradiciendo la D10 de la fase 1. Verificar que no queda ninguna mención en castellano en las fases 2 y 6

## 7. Verificación final

- [x] 7.1 Recorrer a mano los escenarios de `specs/recipes` y del delta de `specs/ingredients` contra la aplicación en marcha, con dos cuentas distintas para los de aislamiento
- [x] 7.2 Escribir una receta real de principio a fin —no de prueba— y terminarla. Es la única forma de saber si el guardado al vuelo y el arrastre se aguantan en uso
- [x] 7.3 Pasar `npm run typecheck`, `npm run lint` y `npm run format:check` en limpio
- [x] 7.4 Comprobar el editor a ancho de teléfono y que nada queda bajo la muesca ni el indicador de gestos, con la lista de pasos lo bastante larga como para que haya que desplazarse mientras se arrastra
