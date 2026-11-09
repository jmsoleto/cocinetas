-- La cobertura: cuántos de los ingredientes que de verdad necesita una receta
-- están en la despensa. Es la fase 3, «Qué puedo hacer».
--
-- El razonamiento completo está en openspec/changes/add-recipe-coverage/design.md.
-- Lo que hace falta saber aquí:
--
--   · la regla de qué cuenta vive en UN sitio, `recipe_line_coverage`, y la
--     vista por receta se agrega desde ella en vez de repetirla. Así la lista y
--     el detalle no pueden dar cifras distintas para la misma receta (D1)
--   · las dos vistas son `security_invoker`, y sin eso no habría RLS (D2)
--   · no añade tablas. Añade una columna, `opcional`, que la D7 de la fase 1 ya
--     había previsto y que no se creó hasta tener quien la usara


-- ── Las líneas opcionales ─────────────────────────────────────────────────
-- «Perejil para decorar». Es una propiedad de la LÍNEA, no del ingrediente, y
-- por eso no es `ingredients.se_asume`: esa vale para todo el recetario («siempre
-- tengo sal»), esta para una línea de una receta. La D7 de la fase 1 pidió que no
-- se fundieran en la misma columna porque luego no se podrían separar.
--
-- Las filas que ya existen toman `false`, que es lo que eran. `authenticated`
-- ya tiene `update` sobre la tabla entera, y eso incluye las columnas nuevas: no
-- hace falta ningún `grant`.

alter table public.recipe_ingredients
  add column opcional boolean not null default false;

comment on column public.recipe_ingredients.opcional is
  'La receta admite este ingrediente pero se puede cocinar sin él. No cuenta '
  'para la cobertura. Es de la línea, no del ingrediente: ver se_asume.';


-- ── El estado de cada línea ───────────────────────────────────────────────
-- Una fila por línea de receta, con uno de cuatro estados y esta precedencia:
--
--   opcional   la línea es opcional          (gana aunque el ingrediente se asuma)
--   supuesto   el ingrediente se da por supuesto
--   tiene      está en la despensa
--   falta      en otro caso
--
-- `security_invoker = true` es OBLIGATORIO, no una preferencia. Una vista normal
-- se ejecuta con los privilegios de su dueño, que aquí es `postgres`, y
-- `postgres` no está sujeto a RLS: la vista devolvería las líneas y la despensa
-- de TODO el mundo a cualquiera que pudiera leerla. Con `security_invoker`, cada
-- tabla de debajo aplica su RLS a quien consulta. Y no falla de forma visible:
-- con una sola cuenta las dos versiones parecen funcionar igual. Solo la prueba
-- con dos cuentas lo demuestra.
--
-- La unión con `pantry` va por `(perfil_id, ingrediente_id)`. Unir solo por el
-- ingrediente daría lo mismo —la clave ajena compuesta de `pantry` ya ata la
-- despensa y el ingrediente al mismo perfil—, pero así se lee aquí que se cruza
-- la despensa DEL DUEÑO de la receta, y es exactamente la clave primaria.

create view public.recipe_line_coverage
  with (security_invoker = true)
as
select
  l.perfil_id,
  l.receta_id,
  l.id as linea_id,
  l.ingrediente_id,
  i.nombre,
  case
    when l.opcional then 'opcional'
    when i.se_asume then 'supuesto'
    when p.ingrediente_id is not null then 'tiene'
    else 'falta'
  end as estado
from public.recipe_ingredients l
join public.ingredients i
  on i.id = l.ingrediente_id and i.perfil_id = l.perfil_id
left join public.pantry p
  on p.perfil_id = l.perfil_id and p.ingrediente_id = l.ingrediente_id;

comment on view public.recipe_line_coverage is
  'Estado de cada línea de receta frente a la despensa: opcional, supuesto, '
  'tiene o falta. Es la única definición de la regla de cobertura.';


-- ── La cobertura de cada receta ───────────────────────────────────────────
-- Se agrega desde la vista de arriba y NO desde las tablas de ingredientes ni
-- la despensa: si la regla cambia, cambia en un solo sitio. Lee `recipes` solo
-- para que haya una fila por receta aunque no tenga líneas (un borrador vacío),
-- en vez de que la receta desaparezca de la vista.
--
-- Los necesarios son los ingredientes DISTINTOS de las líneas en `tiene` o
-- `falta`. De ahí salen solas dos reglas de la spec:
--
--   · dos líneas del mismo ingrediente cuentan una vez
--   · un ingrediente opcional en una línea y necesario en otra cuenta como
--     necesario: la línea no opcional lo aporta, y la opcional no resta
--
-- Una receta de solo básicos da `necesarios = 0`, no nulo, y la aplicación la
-- muestra como «Tienes todo», nunca «0/0».

create view public.recipe_coverage
  with (security_invoker = true)
as
select
  r.perfil_id,
  r.id as receta_id,
  count(distinct c.ingrediente_id)
    filter (where c.estado in ('tiene', 'falta'))::integer as necesarios,
  count(distinct c.ingrediente_id)
    filter (where c.estado = 'tiene')::integer as tienes,
  count(distinct c.ingrediente_id)
    filter (where c.estado = 'falta')::integer as faltan,
  coalesce(
    array_agg(distinct c.nombre order by c.nombre)
      filter (where c.estado = 'falta'),
    '{}'
  ) as faltan_nombres
from public.recipes r
left join public.recipe_line_coverage c on c.receta_id = r.id
group by r.perfil_id, r.id;

comment on view public.recipe_coverage is
  'Cuántos ingredientes necesita de verdad cada receta, cuántos tienes y cuáles '
  'faltan. Se agrega desde recipe_line_coverage, no repite la regla.';


-- ── Privilegios ───────────────────────────────────────────────────────────
-- Medido en local antes de escribir esto: para las relaciones que crea
-- `postgres` en `public`, el `alter default privileges` de
-- `20260829000000_privilegios_ingredients_pantry.sql` deja
-- `{postgres=arwdDxtm, service_role=Dxtm}`. Las vistas son relaciones del mismo
-- tipo que las tablas, así que nacen ya sin nada para `anon` ni `authenticated`.
-- El `revoke` se mantiene igual por la D8 de la fase 1: el privilegio concedido
-- y el pretendido tienen que coincidir leyendo un solo fichero.
--
-- Solo `select`: son de lectura. La marca de opcional se cambia en
-- `recipe_ingredients`, que es donde está la RLS de escritura.

revoke all on table public.recipe_line_coverage from anon, authenticated;
revoke all on table public.recipe_coverage from anon, authenticated;

grant select on table public.recipe_line_coverage to authenticated;
grant select on table public.recipe_coverage to authenticated;

-- A `anon` nada: sin sesión no hay despensa ni recetas que cruzar.
--
-- COMPROBADO CONTRA PRODUCCIÓN el 2026-11-09, después del `db push`, con la
-- clave anónima:
--
--   anon → recipe_coverage        42501 permission denied for view recipe_coverage
--   anon → recipe_line_coverage   42501 permission denied for view recipe_line_coverage


-- ── Sin índices nuevos ────────────────────────────────────────────────────
-- Mirado con `explain` como una persona con sus recetas, antes de decidirlo
-- (D6 del diseño). Con pocas filas el planificador recorre `recipe_ingredients`
-- entera filtrando por `perfil_id`, que no tiene índice propio. Pero no es que
-- le falte camino: con `enable_seqscan = off` llega a las líneas desde los
-- ingredientes de la persona por `recipe_ingredients_ingrediente_idx`, y a la
-- despensa por `pantry_pkey`. Las dos rutas solo tocan datos de esa persona, así
-- que el recorrido secuencial es la elección barata de una tabla diminuta, no
-- un índice que falte. Si con datos reales deja de serlo, se añade entonces.
