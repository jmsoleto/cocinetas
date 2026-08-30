-- Ajustar los privilegios de la fase 1 a lo que las migraciones pretendían.
--
-- HALLAZGO
-- La migración anterior revocó los privilegios de tabla de `anon` y
-- `authenticated` antes de conceder los suyos, aprendida la lección de
-- `20260823010000_privilegios_profiles.sql`. Lo que no cubrió son las
-- FUNCIONES: el `alter default privileges` que Supabase trae en el esquema
-- `public` también concede `execute` sobre cualquier función nueva a `anon`,
-- `authenticated` y `service_role`. Las cuatro funciones de ingredientes y
-- despensa nacieron, por tanto, invocables por cualquiera sin sesión.
--
-- Se descubrió con `supabase db diff --linked` después de subir la migración,
-- no leyendo el SQL. Y de paso desmintió una suposición: en la imagen LOCAL de
-- Supabase esos privilegios por defecto ya no se conceden, así que el problema
-- no se ve en desarrollo. En el proyecto de producción sí están. Comprobar
-- solo en local habría dado un falso "aquí no pasa nada".
--
-- QUÉ RIESGO HAY, DE VERDAD
-- Ninguno explotable. `anon` no tiene ni un privilegio de tabla ni una sola
-- política RLS, así que aunque llame a las funciones no puede leer ni escribir
-- nada. Y las cuatro son `security invoker`, no `definer`: `resolver_ingrediente`
-- y `anadir_a_despensa` lanzan 42501 sin sesión, y `fusionar_ingredientes` no
-- encuentra los dos ingredientes y lanza P0002. Esto es cerrar una puerta que
-- estaba tapiada por dentro, otra vez.
--
-- POR QUÉ ARREGLARLO IGUAL
-- Por lo mismo que la vez anterior: el privilegio concedido y el pretendido
-- deben coincidir, o cualquier razonamiento futuro parte de una premisa falsa.
-- Y porque la única defensa hoy es que cada función se acuerde de comprobar la
-- sesión por su cuenta. Eso es una barandilla, no un muro.

-- Se revoca a PUBLIC, no a `anon`. Es la parte que se descubre comprobando y
-- no razonando: además del `alter default privileges` de Supabase, PostgreSQL
-- concede por su cuenta `execute` sobre toda función nueva al pseudo-rol
-- PUBLIC, del que `anon` es miembro por definición. Un
-- `revoke ... from anon` se aplica sin error, no cambia nada, y deja la
-- sensación de haber cerrado algo. Solo desaparece quitándoselo a PUBLIC.

revoke execute on function public.normalizar_ingrediente(text) from public;
revoke execute on function public.resolver_ingrediente(text) from public;
revoke execute on function public.anadir_a_despensa(text) from public;
revoke execute on function public.fusionar_ingredientes(uuid, uuid) from public;

-- Y ahora se concede a quien de verdad las usa. `authenticated` porque es el
-- rol efectivo de la aplicación: las llamadas llegan con la clave anónima MÁS
-- el JWT de la persona. `service_role` porque quitarle privilegios es una
-- decisión aparte que este change no toma (ver abajo).

grant execute on function public.normalizar_ingrediente(text) to authenticated, service_role;
grant execute on function public.resolver_ingrediente(text) to authenticated, service_role;
grant execute on function public.anadir_a_despensa(text) to authenticated, service_role;
grant execute on function public.fusionar_ingredientes(uuid, uuid) to authenticated, service_role;


-- ── La causa, no el síntoma ───────────────────────────────────────────────
-- Lo de arriba arregla cuatro funciones. Esto evita que vuelva a pasar.
--
-- Mientras el `alter default privileges` siga puesto, cada tabla y cada función
-- que se cree en `public` nacerá con permisos que nadie pidió, y la única
-- defensa será que quien escriba la migración se acuerde de revocarlos. La
-- fase 2 trae cuatro tablas más —`recipes`, `recipe_ingredients`, `steps`,
-- `step_ingredients`— y la 6 añade funciones. Que nazcan limpias.
--
-- Se le quita también a `authenticated`, no solo a `anon`, y es deliberado:
-- obliga a que cada migración conceda explícitamente lo que su tabla necesita,
-- que es lo que ya vienen haciendo todas. Si alguien olvida el `grant`, la
-- consulta falla en desarrollo con un "permission denied" evidente; si olvida
-- el `revoke`, no falla nada y el descuido pasa a producción. Preferimos el
-- fallo ruidoso.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

-- Y la de PostgreSQL, por el mismo motivo que arriba: sin esto, la siguiente
-- función de `public` vuelve a nacer ejecutable por cualquiera a través de
-- PUBLIC, y el `revoke ... from anon` que alguien escriba de memoria volverá a
-- no hacer nada.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- Las secuencias se quedan como están, a propósito. No hay ninguna en `public`
-- —todas las claves son uuid— y revocárselas a `authenticated` prepararía una
-- trampa para el día que alguien cree una tabla con `bigserial`: el insert
-- fallaría con un "permission denied for sequence" que no menciona la tabla y
-- cuesta relacionar. Arreglar un problema que no existe a cambio de un fallo
-- confuso futuro no compensa.


-- ── Lo que NO se toca, y por qué ──────────────────────────────────────────
--
-- `service_role` conserva todo sobre las tres tablas. Es la clave de
-- administración, salta la RLS por diseño, nunca sale al navegador, y puede
-- volver a concederse cualquier cosa ella misma: revocárselo no aporta
-- seguridad y sí puede romper el editor de tablas del panel de Supabase. El
-- `supabase db diff --linked` seguirá mostrando esa diferencia para siempre.
-- Es ruido conocido y aceptado, no un descuido pendiente.
--
-- `crear_perfil_para_usuario_nuevo` y `tocar_actualizado_en` tampoco se tocan,
-- aunque tengan el mismo `execute` de más. Devuelven `trigger`, así que
-- PostgREST no las expone como RPC y llamarlas fuera de un disparador falla:
-- no hay nada que cerrar. Y la primera se ejecuta durante el alta de cada
-- cuenta, que es el camino más crítico de la aplicación. Tocar sus privilegios
-- para ganar pulcritud, arriesgando que nadie pueda registrarse, es un cambio
-- malo aunque la teoría diga que PostgreSQL no comprueba `execute` al disparar
-- un trigger.
