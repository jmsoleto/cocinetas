-- Ajustar los privilegios de `profiles` a lo que la migración anterior decía.
--
-- HALLAZGO
-- Supabase trae en el esquema `public` un `alter default privileges` que concede
-- TODO sobre cualquier tabla nueva a `anon`, `authenticated` y `service_role`.
-- Eso ocurre al crear la tabla, así que el `grant select, update ... to
-- authenticated` de la migración anterior no añadía nada: los privilegios ya
-- estaban puestos, y mucho más amplios. A `anon`, al que deliberadamente no se
-- le concedió nada, le llegaron delete, insert, select, truncate y update.
--
-- Se descubrió comparando `supabase db diff --linked` contra el estado local,
-- no leyendo el SQL: la migración parecía precisa y no lo era.
--
-- QUÉ RIESGO HAY, DE VERDAD
-- Ninguno inmediato. RLS es el muro real: `anon` no tiene ninguna política, así
-- que un SELECT le devuelve cero filas y cualquier escritura se deniega. Y
-- TRUNCATE —que es el único verbo aquí al que RLS NO se aplica— no lo expone
-- PostgREST. Esto es cerrar una puerta que estaba tapiada por dentro, no
-- taparla por primera vez.
--
-- POR QUÉ ARREGLARLO IGUAL
-- Porque el privilegio concedido y el privilegio pretendido deben coincidir.
-- Mientras no coincidan, cualquier razonamiento futuro sobre esta tabla parte
-- de una premisa falsa, y la siguiente tabla que cuelgue de aquí —la despensa,
-- las recetas— heredará el mismo descuido sin que nadie lo note.

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

-- Exactamente lo que la aplicación usa, y nada más. Insertar es cosa del
-- trigger, que corre como definer; borrar va en cascada al borrarse la cuenta.
grant select, update on table public.profiles to authenticated;

-- `anon` se queda sin nada: sin sesión no hay perfiles que ver. Antes de este
-- cambio dependíamos solo de RLS para eso; ahora lo dicen las dos capas.
