-- Recetas: la receta, sus líneas de ingrediente, sus pasos, y qué usa cada paso.
--
-- El razonamiento completo está en openspec/changes/add-recipes/design.md. Lo
-- que hace falta saber aquí son las tres invariantes que estas tablas
-- garantizan y que ningún `loader` puede estropear:
--
--   · que una receta, sus líneas y sus pasos sean de la misma persona
--   · que un paso no pueda enlazar con una línea de OTRA receta
--   · que borrar una línea que algún paso usa falle, en vez de perder el dato
--
-- La tercera es la que menos se ve venir y la que más cuesta si se hace mal;
-- está explicada donde se declara.
--
-- Nota sobre privilegios: `20260829000000_privilegios_ingredients_pantry.sql`
-- cerró el `alter default privileges` de Supabase, así que estas cuatro tablas
-- YA nacen sin privilegios para `anon` ni `authenticated`. El `revoke` explícito
-- se mantiene igualmente porque la decisión D8 dice revocar antes de conceder
-- siempre: es lo que hace que el privilegio concedido y el pretendido coincidan
-- leyendo un solo fichero, sin tener que ir a comprobar qué hizo otra migración.


-- ── La receta ─────────────────────────────────────────────────────────────
-- Toda receta nace borrador, venga de donde venga, y un borrador tiene que
-- poder existir vacío: por eso `titulo` y `comensales` son nullables. El
-- esquema no se parte en dos tablas —borradores y recetas—, se APRIETA al
-- finalizar, con las exigencias condicionadas a que `finalizada_en` no sea nulo.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.profiles (id) on delete cascade,

  titulo text,
  comensales integer check (comensales is null or comensales > 0),

  -- Nulo = borrador. Es el ÚNICO indicador de estado: no hay columna de estado
  -- ni enum, porque la fecha ya responde a las dos preguntas («¿está
  -- terminada?» y «¿cuándo?») y un enum al lado admitiría contradecirla.
  finalizada_en timestamptz,

  -- La procedencia es cosa distinta del estado, y por eso son dos columnas.
  -- Una receta de vídeo ya terminada sigue siendo de origen vídeo para
  -- siempre, y eso es lo que permitirá preguntar «¿qué recetas salieron de la
  -- extracción antes de arreglar aquel fallo?».
  --
  -- La restricción admite hoy un solo valor a propósito. La fase 6 la ampliará
  -- a la vez que añade `origen_url` y `origen_datos`: un `origen_tipo` que
  -- valga 'video' sin columnas donde poner el vídeo no significaría nada.
  origen_tipo text not null default 'manual'
    check (origen_tipo in ('manual')),

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- Lo único que se puede exigir de una receta terminada desde la propia fila.
  -- «Al menos una línea» y «al menos un paso» viven en otras tablas y un check
  -- no las ve: de eso responde `finalizar_receta`, y es una convención de la
  -- aplicación y no una garantía de la base de datos (ver D9 del diseño).
  constraint recipes_terminada_con_titulo
    check (finalizada_en is null or length(btrim(coalesce(titulo, ''))) > 0)
);

comment on table public.recipes is
  'Una receta de una persona. finalizada_en nulo significa borrador.';

-- Para las claves ajenas compuestas de las tres tablas hijas. Redundante como
-- restricción —`id` ya es único—, pero es lo que permite exigir en la propia
-- base de datos que una línea o un paso sea de una receta DE LA MISMA PERSONA,
-- en vez de confiar en que la política RLS de la fila hija lo compruebe (que no
-- lo hace: comprueba el perfil de la fila que se inserta, no el de aquello a lo
-- que apunta). Es el mismo truco que `ingredients_id_perfil_key` en la fase 1.
alter table public.recipes
  add constraint recipes_id_perfil_key unique (id, perfil_id);

create index recipes_perfil_estado_idx
  on public.recipes (perfil_id, finalizada_en);

create trigger tocar_receta_actualizada
  before update on public.recipes
  for each row
  execute function public.tocar_actualizado_en();


-- ── Las líneas de ingrediente ─────────────────────────────────────────────
-- Resuelven su ingrediente desde el primer momento, ya en borrador, con
-- `ingrediente_id` NOT NULL. La alternativa —guardar el texto y resolver al
-- finalizar— haría que una línea tuviera una forma mientras es borrador y otra
-- después. Se prefiere el desorden reparable (un catálogo con alguna errata) al
-- desorden estructural (dos formas de la misma fila).

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null,
  receta_id uuid not null,
  ingrediente_id uuid not null,

  orden integer not null,

  -- Texto libre las dos, y a propósito: «2 dientes», «un chorro», «al gusto».
  -- Un número más una unidad exigiría una tabla de unidades y sus conversiones,
  -- y obligaría a inventar una cifra donde la receta no la tiene. Ninguna fase
  -- calcula nada con esto: la cobertura de la fase 3 cruza ingredientes.
  cantidad text,
  nota text,

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- La línea es de una receta TUYA. Sin la pareja, una petición podría colgar
  -- una línea de la receta de otra persona.
  constraint recipe_ingredients_receta_del_perfil
    foreign key (receta_id, perfil_id)
    references public.recipes (id, perfil_id)
    on delete cascade,

  -- Y apunta a un ingrediente TUYO. Sin `on delete cascade` ni `restrict`, por
  -- lo mismo que en `pantry`: borrar un ingrediente que una receta usa DEBE
  -- fallar, y `no action` comprueba al final de la sentencia, de modo que
  -- borrar una cuenta entera sigue funcionando.
  constraint recipe_ingredients_ingrediente_del_perfil
    foreign key (ingrediente_id, perfil_id)
    references public.ingredients (id, perfil_id)
);

comment on table public.recipe_ingredients is
  'Una línea de ingrediente de una receta. La cantidad y la nota son de la '
  'línea, no del ingrediente: por eso una receta puede llevar dos del mismo.';

-- SIN unique (receta_id, ingrediente_id), y no es un olvido: «100 ml de aceite
-- para el sofrito, 50 para terminar» son dos líneas legítimas del mismo
-- ingrediente. Es además la razón entera de que los pasos apunten a la línea y
-- no al ingrediente. Y una fusión de ingredientes puede producir ese caso sin
-- previo aviso, así que la restricción rompería `fusionar_ingredientes`.

-- SIN unique (receta_id, orden) tampoco. Con ella, intercambiar dos filas
-- reventaría a mitad de sentencia salvo declarándola `deferrable`, y no hace
-- falta: el reordenado se manda entero y renumera por posición.
create index recipe_ingredients_receta_orden_idx
  on public.recipe_ingredients (receta_id, orden);

create index recipe_ingredients_ingrediente_idx
  on public.recipe_ingredients (ingrediente_id);

-- Para la clave ajena compuesta de `step_ingredients`: es lo que exige que un
-- paso solo pueda enlazar con líneas de SU MISMA receta.
alter table public.recipe_ingredients
  add constraint recipe_ingredients_id_receta_key unique (id, receta_id);

create trigger tocar_linea_actualizada
  before update on public.recipe_ingredients
  for each row
  execute function public.tocar_actualizado_en();


-- ── Los pasos ─────────────────────────────────────────────────────────────
-- Texto y posición, y nada más. Sin duración —«sofríe 10 minutos» ya está en el
-- texto, y una columna solo se ganaría el sitio si algo calculara con ella— y
-- sin marca de completado, porque el modo cocina de la fase 4 solo lee.

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null,
  receta_id uuid not null,

  orden integer not null,

  -- Con default vacío: añadir un paso y empezar a escribir dentro son dos
  -- gestos distintos, y entre uno y otro el paso existe sin texto. Un borrador
  -- admite huecos por definición.
  texto text not null default '',

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint steps_receta_del_perfil
    foreign key (receta_id, perfil_id)
    references public.recipes (id, perfil_id)
    on delete cascade
);

comment on table public.steps is
  'Un paso de una receta. Solo texto y posición: el modo cocina solo lee.';

create index steps_receta_orden_idx on public.steps (receta_id, orden);

alter table public.steps
  add constraint steps_id_receta_key unique (id, receta_id);

create trigger tocar_paso_actualizado
  before update on public.steps
  for each row
  execute function public.tocar_actualizado_en();


-- ── Qué líneas usa cada paso ──────────────────────────────────────────────
-- Apunta a la LÍNEA y no al ingrediente. Con dos líneas del mismo ingrediente
-- en una receta, apuntando al ingrediente el paso no sabría a cuál se refiere.
--
-- Lleva `receta_id` para poder exigir que el paso y la línea sean de la misma
-- receta. Que las dos filas sean tuyas NO basta: la RLS dejaría pasar que el
-- paso 3 de la receta A enlace con la línea 2 de la receta B si ambas son de la
-- misma persona. Es la trampa que `pantry` resolvió con la clave compuesta, un
-- nivel más adentro.

create table public.step_ingredients (
  perfil_id uuid not null,
  receta_id uuid not null,
  paso_id uuid not null,
  linea_id uuid not null,

  creado_en timestamptz not null default now(),

  primary key (paso_id, linea_id),

  -- El paso es el DUEÑO de la anotación: si el paso se va, lo que decía sobre
  -- qué ingredientes usaba deja de significar nada.
  constraint step_ingredients_paso_de_la_receta
    foreign key (paso_id, receta_id)
    references public.steps (id, receta_id)
    on delete cascade,

  -- La línea es lo REFERENCIADO, y aquí está la asimetría deliberada: borrar
  -- una línea que algún paso usa tiene que FALLAR. Borrarla en silencio
  -- perdería la única constancia de que ese paso llevaba ese ingrediente.
  --
  -- `no action` y NO `restrict`, que es la lección literal de `pantry` un nivel
  -- más adentro: `restrict` comprueba al instante, así que borrar una receta
  -- entera fallaría —la cascada desde `recipes` intentaría vaciar
  -- `recipe_ingredients` y saltaría antes de que estos enlaces estuviesen
  -- limpios—. `no action` comprueba al final de la sentencia y la cascada
  -- ordena el destrozo sola.
  constraint step_ingredients_linea_de_la_receta
    foreign key (linea_id, receta_id)
    references public.recipe_ingredients (id, receta_id),

  -- Ata `perfil_id` a la receta, para que no pueda quedar descolgado de la
  -- cadena que lo demás ya garantiza. Es lo que hace que la política RLS de
  -- abajo, que solo mira `perfil_id`, diga la verdad.
  constraint step_ingredients_receta_del_perfil
    foreign key (receta_id, perfil_id)
    references public.recipes (id, perfil_id)
    on delete cascade
);

comment on table public.step_ingredients is
  'Qué líneas de la receta usa cada paso. Apunta a la línea, no al ingrediente.';

create index step_ingredients_linea_idx on public.step_ingredients (linea_id);


-- ── Aislamiento ───────────────────────────────────────────────────────────
-- La misma frase de siempre: perfil_id = auth.uid(). Y los privilegios se
-- revocan antes de concederse (D8), aunque el `alter default privileges` ya
-- no conceda nada: así el fichero se lee entero sin depender de otro.

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.steps enable row level security;
alter table public.step_ingredients enable row level security;

revoke all on table public.recipes from anon, authenticated;
revoke all on table public.recipe_ingredients from anon, authenticated;
revoke all on table public.steps from anon, authenticated;
revoke all on table public.step_ingredients from anon, authenticated;

grant select, insert, update, delete on table public.recipes to authenticated;
grant select, insert, update, delete on table public.recipe_ingredients to authenticated;
grant select, insert, update, delete on table public.steps to authenticated;

-- Un enlace no tiene nada que actualizar: se marca o se desmarca. Sin `update`,
-- igual que `pantry`.
grant select, insert, delete on table public.step_ingredients to authenticated;

-- A `anon` nada en ninguna: sin sesión no hay recetario que ver.

create policy "Cada quien lee sus recetas"
  on public.recipes for select
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien crea sus recetas"
  on public.recipes for insert
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien modifica sus recetas"
  on public.recipes for update
  using ((select auth.uid()) = perfil_id)
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien borra sus recetas"
  on public.recipes for delete
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien lee sus líneas"
  on public.recipe_ingredients for select
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien crea sus líneas"
  on public.recipe_ingredients for insert
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien modifica sus líneas"
  on public.recipe_ingredients for update
  using ((select auth.uid()) = perfil_id)
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien borra sus líneas"
  on public.recipe_ingredients for delete
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien lee sus pasos"
  on public.steps for select
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien crea sus pasos"
  on public.steps for insert
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien modifica sus pasos"
  on public.steps for update
  using ((select auth.uid()) = perfil_id)
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien borra sus pasos"
  on public.steps for delete
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien lee sus enlaces"
  on public.step_ingredients for select
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien crea sus enlaces"
  on public.step_ingredients for insert
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien borra sus enlaces"
  on public.step_ingredients for delete
  using ((select auth.uid()) = perfil_id);


-- ── Reordenar ─────────────────────────────────────────────────────────────
-- Se manda el orden ENTERO, no un intercambio de dos filas. Es lo que permite
-- prescindir del `unique (receta_id, orden)` y lo que hace que arrastrar sea un
-- solo viaje en vez de uno por empujón.
--
-- Exigen que el array sea exactamente el conjunto de elementos de la receta. Si
-- llegara incompleto, los que faltasen conservarían su posición vieja y
-- acabaría habiendo dos en la misma: justo el resultado intermedio que la spec
-- prohíbe. Fallar es la única forma de que «entera o nada» sea cierto.

create function public.reordenar_pasos(p_receta_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_esperados integer;
begin
  select count(*) into v_esperados
    from public.steps where receta_id = p_receta_id;

  if v_esperados <> coalesce(array_length(p_ids, 1), 0) then
    raise exception 'El orden tiene que traer todos los pasos de la receta'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(p_ids) as pedido(id)
    where not exists (
      select 1 from public.steps s
       where s.id = pedido.id and s.receta_id = p_receta_id
    )
  ) then
    raise exception 'El orden trae un paso que no es de esta receta'
      using errcode = '22023';
  end if;

  update public.steps s
     set orden = nuevo.pos
    from unnest(p_ids) with ordinality as nuevo(id, pos)
   where s.id = nuevo.id and s.receta_id = p_receta_id;
end;
$$;

comment on function public.reordenar_pasos(uuid, uuid[]) is
  'Renumera los pasos de una receta por su posición en el array. Entera o nada.';

create function public.reordenar_lineas(p_receta_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_esperados integer;
begin
  select count(*) into v_esperados
    from public.recipe_ingredients where receta_id = p_receta_id;

  if v_esperados <> coalesce(array_length(p_ids, 1), 0) then
    raise exception 'El orden tiene que traer todas las líneas de la receta'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(p_ids) as pedido(id)
    where not exists (
      select 1 from public.recipe_ingredients l
       where l.id = pedido.id and l.receta_id = p_receta_id
    )
  ) then
    raise exception 'El orden trae una línea que no es de esta receta'
      using errcode = '22023';
  end if;

  update public.recipe_ingredients l
     set orden = nuevo.pos
    from unnest(p_ids) with ordinality as nuevo(id, pos)
   where l.id = nuevo.id and l.receta_id = p_receta_id;
end;
$$;

comment on function public.reordenar_lineas(uuid, uuid[]) is
  'Renumera las líneas de una receta por su posición en el array. Entera o nada.';


-- ── Finalizar ─────────────────────────────────────────────────────────────
-- Comprueba y sella en la misma llamada, para que no exista un instante en que
-- una receta figure terminada sin cumplir las condiciones.
--
-- Se justifica por atomicidad, no por privilegio: la aplicación conserva
-- `update` sobre `finalizada_en`, así que esta función es donde vive la regla,
-- no lo que la impone. Cerrarla de verdad exigiría privilegios por columna y
-- `security definer`, y se descartó por desproporcionado (D9 del diseño).
--
-- Los tres mensajes son distintos a propósito: «no se puede finalizar» sin
-- decir qué falta obliga a adivinar.

create function public.finalizar_receta(p_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_titulo text;
  v_finalizada timestamptz;
begin
  select titulo, finalizada_en into v_titulo, v_finalizada
    from public.recipes where id = p_id;

  if not found then
    raise exception 'Esa receta no existe o no es tuya'
      using errcode = 'P0002';
  end if;

  if length(btrim(coalesce(v_titulo, ''))) = 0 then
    raise exception 'Ponle un título antes de darla por terminada'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.recipe_ingredients where receta_id = p_id
  ) then
    raise exception 'Una receta terminada necesita al menos un ingrediente'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.steps where receta_id = p_id) then
    raise exception 'Una receta terminada necesita al menos un paso'
      using errcode = 'P0001';
  end if;

  -- Si ya estaba terminada se respeta la fecha original: volver a llamar no es
  -- un error, pero tampoco tiene por qué mover nada.
  if v_finalizada is not null then
    return v_finalizada;
  end if;

  update public.recipes set finalizada_en = now() where id = p_id
    returning finalizada_en into v_finalizada;

  return v_finalizada;
end;
$$;

comment on function public.finalizar_receta(uuid) is
  'Comprueba que la receta cumple lo mínimo y la sella, en una sola llamada. '
  'Dice en español qué falta cuando no puede.';


-- ── Privilegios de las funciones ──────────────────────────────────────────
--
-- CUIDADO: el `alter default privileges` de
-- `20260829000000_privilegios_ingredients_pantry.sql` NO cubre esto, aunque
-- aquella migración diera a entender que sí («que nazcan limpias»). Cubre las
-- TABLAS —comprobado: una tabla nueva nace sin un solo privilegio para `anon`
-- ni `authenticated`— pero NO las funciones.
--
-- Medido en PostgreSQL 17.6, que es lo que sirve Supabase:
--
--   pg_default_acl para (postgres, public, funciones)  →  {postgres=X/postgres}
--   una función creada acto seguido                    →  proacl NULA
--   y proacl nula significa el default de PostgreSQL   →  PUBLIC = EXECUTE
--
-- La parte `grant` de los privilegios por defecto SÍ cuaja: añadiendo al
-- default un `grant execute ... to service_role`, la función nueva sale
-- `{=X/postgres, postgres=X/postgres, service_role=X/postgres}` — con el
-- `=X/postgres` de PUBLIC todavía dentro. Es decir, los defaults se SUMAN al
-- built-in de PostgreSQL en vez de sustituirlo, y `revoke execute on functions
-- from public` queda anotado en el catálogo sin efecto sobre lo que se cree
-- después. Reemitirlo no cambia nada.
--
-- Consecuencia práctica, y va para la fase 6, que añade funciones: **toda
-- migración que cree una función tiene que revocarle `execute` a PUBLIC a
-- mano**. No se puede confiar en el default. Es la tercera vez que este
-- proyecto se encuentra el mismo tipo de trampa y la segunda con PUBLIC de por
-- medio; la diferencia es que esta vez se descubrió antes de subirla.
--
-- COMPROBADO CONTRA PRODUCCIÓN el 2026-08-30, después del `db push`, que es lo
-- único que demuestra algo sobre privilegios. Con la clave anónima:
--
--   anon → recipes            42501 permission denied for table recipes
--   anon → finalizar_receta   42501 permission denied for function finalizar_receta
--
-- Y no es «función no encontrada» ni el aviso que redacta el propio cuerpo: es
-- el privilegio negándose antes de ejecutar nada. En la fase 1, `anon` sí podía
-- llamar a las funciones y recibía la comprobación interna —una barandilla, no
-- un muro, según sus propias palabras—. Aquí es un muro.

revoke execute on function public.reordenar_pasos(uuid, uuid[]) from public;
revoke execute on function public.reordenar_lineas(uuid, uuid[]) from public;
revoke execute on function public.finalizar_receta(uuid) from public;

grant execute on function public.reordenar_pasos(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reordenar_lineas(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.finalizar_receta(uuid) to authenticated, service_role;
