## 1. Base de datos

- [x] 1.1 Escribir `public.normalizar_ingrediente(text)`: minúsculas, espacios colapsados y tildes retiradas **dejando la `ñ` intacta** —es una letra del alfabeto, no una `n` acentuada—. Verificar con `select` que «Platano», «  plátano » y «plátano» dan el mismo resultado y que «ñora» no se convierte en «nora»
- [x] 1.2 Crear `public.ingredients` con `normalizado` como columna generada sobre esa función y un índice único `(perfil_id, normalizado)`. Verificar que insertar «Cebolla» teniendo «cebolla» falla con 23505
- [x] 1.3 Crear `public.pantry` con clave primaria `(perfil_id, ingrediente_id)`. Verificar que insertar dos veces la misma pareja falla con 23505
- [x] 1.4 Atar la despensa a ingredientes **propios** con una clave ajena compuesta contra `ingredients (id, perfil_id)`, no solo contra `id`. Verificar que meter en la despensa el id de un ingrediente ajeno falla con 23503 aunque el `perfil_id` sea el propio
- [x] 1.5 Poner RLS y privilegios explícitos en ambas tablas: `revoke all` antes de conceder solo los verbos que se usan —`pantry` no necesita `update`—. Verificar con `information_schema.role_table_grants` que `anon` no tiene ninguno y que `authenticated` tiene exactamente los previstos
- [x] 1.6 Escribir `public.resolver_ingrediente(text)` como `security invoker` con `insert ... on conflict do nothing`, marcando `se_asume` cuando el nombre caiga en la lista fija de la función. Verificar que dos llamadas seguidas con «cebolla» devuelven el mismo id y que «Sal» nace ya marcada
- [x] 1.7 Escribir `public.fusionar_ingredientes(origen, destino)`: traslada las entradas de despensa y borra el origen, en una sola transacción. Verificar que tras fusionar dos ingredientes que estaban ambos en la despensa queda una sola entrada
- [x] 1.8 Comprobar el aislamiento de extremo a extremo con dos cuentas: con el rol `authenticated` y el JWT de una, `select` sobre los ingredientes y la despensa de la otra devuelve cero filas, y `update`/`delete` no afectan a ninguna
- [x] 1.9 Aplicar con `supabase db reset` y contrastar con `supabase db diff --linked` que no queda diferencia inesperada — que es como se descubrió el problema de privilegios de `profiles`

## 2. Acceso a datos desde el servidor

- [x] 2.1 Crear el módulo de servidor de la cocina con las consultas de lectura —despensa ordenada y catálogo propio— tipadas, sin filtrar por `perfil_id` en el código porque de eso responde la RLS. Verificar que `npm run typecheck` pasa
- [x] 2.2 Añadir las escrituras: añadir y quitar de la despensa, renombrar, cambiar la marca de «se da por supuesto», fusionar y eliminar. Verificar que cada una traduce el error de Postgres a un mensaje en español —23505 al renombrar es «ya existe», 23503 al eliminar es «está en uso»— en vez de dejar escapar un 500
- [x] 2.3 Registrar las rutas nuevas en `app/routes.ts` y sus URLs en `app/rutas.ts`, en español como las existentes. Verificar que `npm run typecheck` regenera los tipos de ruta sin errores

## 3. Pantalla «Mi cocina»

- [x] 3.1 Ruta protegida `/cocina` que liste la despensa en orden alfabético estable. Verificar que sin sesión redirige a `/entrar` sin enviar contenido
- [x] 3.2 Formulario de añadir con autocompletado sobre el catálogo propio mediante `<datalist>`, de modo que funcione sin JavaScript. Verificar que la lista ofrece los ingredientes propios que aún no están en la despensa y excluye los que se dan por supuestos
- [x] 3.3 Quitar de la despensa desde cada entrada, dejando el ingrediente en el catálogo. Verificar que tras quitarlo vuelve a aparecer entre las sugerencias del formulario
- [x] 3.4 Estado vacío que explique para qué sirve la despensa y cómo empezar, en lugar de una lista en blanco. Verificar abriéndola con una cuenta recién creada
- [x] 3.5 Rechazar con un mensaje comprensible el intento de añadir algo que se da por supuesto, y el nombre vacío. Verificar escribiendo «sal» y enviando el formulario en blanco

## 4. Reparar el vocabulario

- [x] 4.1 Ruta protegida que liste el catálogo propio completo, marcando cuáles se dan por supuestos y cuáles están en la despensa. Verificar con una cuenta que tenga de los tres tipos
- [x] 4.2 Renombrar en línea, y cuando el nombre nuevo choque con otro ingrediente, ofrecer fusionar en vez de fallar. Verificar renombrando «cebollas» a «cebolla» teniendo ambas
- [x] 4.3 Fusionar dos ingredientes desde la ficha de uno, eligiendo el destino entre los demás. Verificar que el origen desaparece del catálogo y de las sugerencias
- [x] 4.4 Poner y quitar la marca de «se da por supuesto». Verificar que al quitársela a «aceite» pasa a poder añadirse a la despensa
- [x] 4.5 Eliminar un ingrediente sin uso, y negarse con una explicación cuando esté en uso. Verificar los dos casos

## 5. Integración

- [x] 5.1 Dar acceso a las pantallas nuevas desde la pantalla principal. Verificar que se llega a la cocina y se vuelve sin escribir la URL a mano
- [x] 5.2 Estilos en CSS Modules sobre los tokens del design system, sin un solo valor literal. Verificar que `npm run lint` pasa, incluidas las reglas de adherencia
- [x] 5.3 Propagar las `headers` de Supabase en toda respuesta de las rutas nuevas, incluidas las redirecciones tras una acción. Verificar que navegando por las pantallas nuevas la sesión sigue viva y no expulsa

## 6. Verificación final

- [x] 6.1 Recorrer a mano los escenarios de las dos specs contra la aplicación en marcha, con dos cuentas distintas para los de aislamiento
- [x] 6.2 Pasar `npm run typecheck`, `npm run lint` y `npm run format:check` en limpio
- [x] 6.3 Comprobar la pantalla a ancho de teléfono, que es el único objetivo soportado, y que nada queda bajo la muesca ni el indicador de gestos
