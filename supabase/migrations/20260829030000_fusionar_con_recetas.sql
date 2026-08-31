-- Que fusionar dos ingredientes se lleve también las líneas de receta.
--
-- `20260826000000_ingredients_pantry.sql` dejó el sitio señalado: «cuando
-- existan recetas, este es el sitio donde también se reasignarán sus líneas».
-- Ya existen.
--
-- Sin esto la fusión fallaría, y no en silencio: la clave ajena de
-- `recipe_ingredients` contra `ingredients` es `no action`, así que borrar el
-- ingrediente de origen mientras alguna línea lo usara daría un 23503. La
-- fusión pasaría de ser una reparación a ser algo que solo funciona si no has
-- escrito ninguna receta todavía.
--
-- `create or replace` y no `drop` + `create`: conserva los privilegios que la
-- migración de privilegios le concedió, que es exactamente el descuido que
-- costó dos migraciones correctivas en la fase 1.

create or replace function public.fusionar_ingredientes(id_origen uuid, id_destino uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_perfil uuid := (select auth.uid());
begin
  if id_origen = id_destino then
    raise exception 'No se puede fusionar un ingrediente consigo mismo'
      using errcode = '22023';
  end if;

  -- La RLS ya impide ver los ajenos, así que esto no es la garantía de
  -- aislamiento: es para dar un error comprensible en vez de un éxito que no
  -- hizo nada.
  if not exists (
    select 1 from public.ingredients
     where id in (id_origen, id_destino) and perfil_id = v_perfil
     having count(*) = 2
  ) then
    raise exception 'Los dos ingredientes tienen que existir y ser tuyos'
      using errcode = 'P0002';
  end if;

  -- Antes que nada: las líneas de receta pasan al superviviente.
  --
  -- Se reasignan y NO se funden entre sí. Dos líneas de la misma receta que
  -- acaben apuntando al mismo ingrediente siguen siendo dos, porque la cantidad
  -- y la nota son de la línea: «100 ml de aceite de oliva» y «50 ml de aceite»
  -- fusionados son «100 ml de aceite» y «50 ml de aceite», no 150. Unirlas
  -- exigiría decidir qué cantidad gana, y no hay respuesta correcta.
  --
  -- Por eso `recipe_ingredients` no lleva `unique (receta_id, ingrediente_id)`:
  -- con esa restricción, este update reventaría con un 23505 justo en el caso
  -- que la fusión existe para arreglar.
  --
  -- Los enlaces de `step_ingredients` no se tocan: apuntan a la línea, y la
  -- línea no cambia de identidad, solo de ingrediente.
  update public.recipe_ingredients
     set ingrediente_id = id_destino
   where ingrediente_id = id_origen;

  -- Si el destino ya estaba en la despensa, la entrada del origen sobra.
  insert into public.pantry (perfil_id, ingrediente_id)
  select perfil_id, id_destino
    from public.pantry
   where ingrediente_id = id_origen
  on conflict do nothing;

  -- Explícito y antes de borrar el ingrediente: la clave ajena de la despensa
  -- es `no action` a propósito, así que borrar un ingrediente que sigue dentro
  -- falla. Aquí eso es lo que queremos evitar; en un borrado a secas, no.
  delete from public.pantry where ingrediente_id = id_origen;

  delete from public.ingredients where id = id_origen;
end;
$$;

comment on function public.fusionar_ingredientes(uuid, uuid) is
  'Funde el ingrediente origen en el destino y borra el origen. Traslada antes '
  'lo que colgara de él: entradas de despensa y líneas de receta. Sin deshacer.';
