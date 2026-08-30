-- Terminar de quitarle a `anon` las funciones de ingredientes y despensa.
--
-- HALLAZGO
-- La migración anterior revocó `execute` a PUBLIC y dio el asunto por cerrado
-- porque en local el `anon` dejó de poder llamarlas. En producción seguía
-- pudiendo. El volcado del esquema remoto explica por qué:
--
--   REVOKE ALL ON FUNCTION resolver_ingrediente FROM PUBLIC;   ← sí se aplicó
--   GRANT  ALL ON FUNCTION resolver_ingrediente TO "anon";     ← y esto seguía
--
-- Había DOS concesiones, no una. PostgreSQL concede `execute` sobre toda
-- función nueva al pseudo-rol PUBLIC, y además el `alter default privileges`
-- de Supabase la concede DIRECTAMENTE a `anon`, `authenticated` y
-- `service_role`. Son asientos distintos: revocar uno no toca el otro.
--
-- En la imagen local solo existía la de PUBLIC, así que revocar a PUBLIC
-- bastaba y la comprobación salía verde. Es el segundo caso en esta migración
-- y la anterior en que local dice que sí y producción dice que no: comprobar
-- solo en local, aquí, no demuestra nada sobre privilegios.
--
-- Lo que la migración anterior SÍ dejó bien, y no hay que repetir: los
-- privilegios por defecto de tablas y funciones ya no conceden nada a `anon`
-- ni a `authenticated`, así que las tablas y funciones de las fases siguientes
-- nacen limpias. Esto solo termina de limpiar las cuatro que ya existían.
--
-- QUÉ RIESGO HUBO
-- Ninguno explotable, igual que antes. Las cuatro son `security invoker`,
-- `anon` no tiene un solo privilegio sobre las tablas ni una política RLS, y
-- las que tocan datos comprueban la sesión y lanzan 42501. Se comprobó contra
-- producción: `anon` recibe «Hace falta sesión para resolver un ingrediente»,
-- no una respuesta. Pero la única defensa era esa comprobación dentro de cada
-- función, que es una barandilla, no un muro.

revoke all on function public.normalizar_ingrediente(text) from anon;
revoke all on function public.resolver_ingrediente(text) from anon;
revoke all on function public.anadir_a_despensa(text) from anon;
revoke all on function public.fusionar_ingredientes(uuid, uuid) from anon;

-- `authenticated` y `service_role` las conservan: la migración anterior se las
-- concedió explícitamente y siguen siendo quienes las usan.
