-- Ingredientes y despensa.
--
-- El vocabulario de cada persona y lo que tiene en casa. Las dos tablas son
-- PRIVADAS: no hay ninguna tabla compartida entre cuentas en todo el sistema.
-- El razonamiento completo, con las alternativas descartadas, está en
-- openspec/changes/add-pantry/design.md.
--
-- Lo que estas tablas garantizan y que ningún `loader` puede estropear:
--   · que "cebolla" en una receta y "cebolla" en la despensa sean la misma fila
--   · que esa fila sea tuya y de nadie más
--   · que la despensa no pueda apuntar a un ingrediente ajeno


-- ── Normalización ─────────────────────────────────────────────────────────
-- Cuándo dos textos escritos son el mismo ingrediente. La respuesta es corta a
-- propósito: minúsculas, espacios colapsados y tildes retiradas. Nada más.
--
-- La `ñ` NO se toca. No es una `n` acentuada, es una letra del alfabeto: «año»
-- y «ano» son palabras distintas, y en la cocina «ñora» es un pimiento. Un
-- falso positivo funde dos ingredientes que no eran el mismo, y eso se repara
-- mucho peor que un duplicado.
--
-- El plural tampoco se toca. No hay forma segura de singularizar en español
-- —quitar la `s` final rompe «arroz», «anís» y «cuscús»—, así que «cebolla» y
-- «cebollas» van a convivir como dos filas legítimas. Es una decisión, no un
-- olvido: quien se canse de verlas las fusiona.
--
-- Se usa `translate` y no la extensión `unaccent` porque `unaccent` es STABLE,
-- no IMMUTABLE, y una columna generada exige IMMUTABLE. El apaño habitual es
-- envolverla en una función que MIENTA declarándose inmutable; para veinte
-- caracteres no compensa mentirle al planificador.

create function public.normalizar_ingrediente(texto text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select regexp_replace(
    translate(
      lower(btrim(texto)),
      'áéíóúüàèìòùäëïöâêîôû',
      'aeiouuaeiouaeioaeiou'
    ),
    '\s+', ' ', 'g'
  );
$$;

comment on function public.normalizar_ingrediente(text) is
  'Forma canónica de un nombre de ingrediente: minúsculas, sin tildes (la ñ se '
  'conserva), sin espacios sobrantes. La usan la columna generada de '
  'ingredients y la resolución de texto a ingrediente, para que la regla esté '
  'escrita una sola vez. Cambiarla obliga a recrear la columna generada.';


-- ── El vocabulario ────────────────────────────────────────────────────────
-- Escribir una palabra ES añadirla al catálogo: la resolución nunca falla por
-- que el texto no exista todavía. El desorden que eso produce —alguna errata
-- dentro— se repara renombrando, fusionando y retirando huérfanos, que son
-- operaciones seguras precisamente porque el catálogo es propio.

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),

  -- Generada y no calculada en la aplicación: si la normalización viviera en
  -- el código, un insert desde una consola, una migración o un script futuro
  -- la esquivaría y metería justo el duplicado que el índice de abajo existe
  -- para impedir. La invariante vive donde viven los datos.
  normalizado text generated always as (public.normalizar_ingrediente(nombre)) stored,

  -- Lo que se da por supuesto que hay en la cocina: no sale en la despensa y
  -- no contará en la cobertura de una receta. Nace en `true` para un puñado de
  -- nombres (ver resolver_ingrediente), y cada quien puede cambiarlo.
  se_asume boolean not null default false,

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.ingredients is
  'El vocabulario de ingredientes de una persona. Privado: nadie ve el de nadie.';

create unique index ingredients_perfil_normalizado_idx
  on public.ingredients (perfil_id, normalizado);

-- Para la clave ajena compuesta de `pantry`. Redundante como restricción —`id`
-- ya es único—, pero es lo que permite que la despensa exija en la propia base
-- de datos que el ingrediente sea del mismo perfil.
alter table public.ingredients
  add constraint ingredients_id_perfil_key unique (id, perfil_id);

create trigger tocar_ingrediente_actualizado
  before update on public.ingredients
  for each row
  execute function public.tocar_actualizado_en();


-- ── La despensa ───────────────────────────────────────────────────────────
-- Una marca, no un inventario. La fila existe: lo tienes. No existe: no lo
-- tienes. Sin cantidades, porque «¿qué puedo cocinar ahora?» solo necesita
-- presencia, y un inventario obligaría a descontar al cocinar — cosa que nadie
-- hace, y una despensa que se desactualiza en silencio responde peor que una
-- que solo dice sí o no.

create table public.pantry (
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  ingrediente_id uuid not null,
  creado_en timestamptz not null default now(),

  primary key (perfil_id, ingrediente_id),

  -- El ingrediente tiene que ser TUYO, y lo dice la base de datos. Con una
  -- clave ajena contra `id` a secas, una petición podría meter en su despensa
  -- el id de un ingrediente ajeno: la política RLS comprueba el perfil de la
  -- fila que se inserta, no el del ingrediente al que apunta. Con la clave
  -- compuesta, el par (ingrediente, perfil) tiene que existir tal cual.
  --
  -- Sin `on delete cascade` a propósito: borrar un ingrediente que sigue en la
  -- despensa DEBE fallar, no llevarse la entrada por delante en silencio. Y sin
  -- `restrict` tampoco: `no action` comprueba al final de la sentencia, así que
  -- al borrar una cuenta la cascada desde `profiles` vacía la despensa antes de
  -- que se compruebe. Con `restrict` la comprobación es inmediata y borrar una
  -- cuenta fallaría.
  constraint pantry_ingrediente_del_perfil
    foreign key (ingrediente_id, perfil_id)
    references public.ingredients (id, perfil_id)
);

comment on table public.pantry is
  'Lo que una persona tiene en casa. Presencia, no cantidad.';


-- ── Aislamiento ───────────────────────────────────────────────────────────
-- La misma frase que en profiles, repetida: perfil_id = auth.uid().
--
-- Y los privilegios se REVOCAN antes de concederse. Supabase trae en el
-- esquema `public` un `alter default privileges` que concede todo sobre
-- cualquier tabla nueva a anon, authenticated y service_role; a `profiles` le
-- pasó y hizo falta una segunda migración para corregirlo. Aquí se hace a
-- tiempo: el privilegio concedido y el pretendido coinciden desde el principio.

alter table public.ingredients enable row level security;
alter table public.pantry enable row level security;

revoke all on table public.ingredients from anon, authenticated;
revoke all on table public.pantry from anon, authenticated;

-- Los cuatro verbos, porque el catálogo propio se repara: se renombra
-- (update), se fusiona y se retiran huérfanos (delete).
grant select, insert, update, delete on table public.ingredients to authenticated;

-- La despensa no tiene nada que actualizar: se añade o se quita. Sin `update`.
grant select, insert, delete on table public.pantry to authenticated;

-- A `anon` nada en ninguna de las dos: sin sesión no hay cocina que ver.

create policy "Cada quien lee sus ingredientes"
  on public.ingredients for select
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien crea sus ingredientes"
  on public.ingredients for insert
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien modifica sus ingredientes"
  on public.ingredients for update
  using ((select auth.uid()) = perfil_id)
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien borra sus ingredientes"
  on public.ingredients for delete
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien lee su despensa"
  on public.pantry for select
  using ((select auth.uid()) = perfil_id);

create policy "Cada quien llena su despensa"
  on public.pantry for insert
  with check ((select auth.uid()) = perfil_id);

create policy "Cada quien vacía su despensa"
  on public.pantry for delete
  using ((select auth.uid()) = perfil_id);


-- ── Una sola puerta: buscar-o-crear ───────────────────────────────────────
-- Toda resolución de un texto a un ingrediente pasa por aquí. En una sola
-- sentencia, porque hacerlo en dos viajes desde la aplicación —consultar, y si
-- no está, insertar— deja entre ambos una ventana en la que dos peticiones
-- simultáneas crean el mismo ingrediente: el índice único convertiría esa
-- carrera en un error 500, que es mejor que un duplicado pero sigue sin ser
-- bueno.
--
-- `security invoker`, a diferencia de crear_perfil_para_usuario_nuevo. Aquella
-- necesita elevarse porque el alta la ejecuta GoTrue, que no tiene permisos
-- sobre public.profiles. Aquí la fila es de quien la pide, la RLS se aplica con
-- normalidad, y elevar privilegios sin necesitarlo es regalar superficie.

create function public.resolver_ingrediente(texto text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_perfil uuid := (select auth.uid());
  v_nombre text := btrim(texto);
  v_normalizado text := public.normalizar_ingrediente(texto);
  v_id uuid;
begin
  if v_perfil is null then
    raise exception 'Hace falta sesión para resolver un ingrediente'
      using errcode = '42501';
  end if;

  if v_nombre = '' then
    raise exception 'El nombre del ingrediente no puede estar vacío'
      using errcode = '23514';
  end if;

  insert into public.ingredients (perfil_id, nombre, se_asume)
  values (
    v_perfil,
    v_nombre,
    -- Semilla de comportamiento, no de filas: no se inserta nada por
    -- adelantado, solo se le da un valor inicial distinto a lo que la persona
    -- cree. Así «el catálogo empieza vacío» se cumple al pie de la letra y aun
    -- así el «4/7» de las recetas es honesto desde la primera.
    --
    -- La lista vive aquí, en código versionado, no en datos. Consecuencia
    -- conocida: si mañana entra «azúcar», las filas ya creadas no se re-marcan
    -- solas. Se arregla desde la interfaz, que permite poner la marca a mano.
    v_normalizado in ('sal', 'aceite', 'pimienta', 'agua')
  )
  on conflict (perfil_id, normalizado) do nothing
  returning id into v_id;

  -- `do nothing` no devuelve nada cuando el ingrediente ya existía.
  if v_id is null then
    select id into v_id
      from public.ingredients
     where perfil_id = v_perfil
       and normalizado = v_normalizado;
  end if;

  return v_id;
end;
$$;

comment on function public.resolver_ingrediente(text) is
  'Texto → ingrediente del catálogo de quien llama: el que ya coincida, o uno '
  'nuevo. No falla porque la palabra no exista todavía. Es la única puerta de '
  'entrada al catálogo.';


-- ── Fusionar ──────────────────────────────────────────────────────────────
-- Declarar que dos ingredientes eran en realidad el mismo. Destructivo: no
-- queda tumba ni redirección. Es seguro porque lo que se destruye es propio —
-- en un catálogo compartido esto sería inaceptable, y de ahí venía la idea de
-- una tabla de alias que aquí no hace falta.
--
-- En una sola transacción porque son varios pasos que no pueden quedarse a
-- medias. Cuando existan recetas, este es el sitio donde también se reasignarán
-- sus líneas.

create function public.fusionar_ingredientes(id_origen uuid, id_destino uuid)
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
  'lo que colgara de él. Sin deshacer.';


-- ── Añadir a la despensa ──────────────────────────────────────────────────
-- Resolver y añadir en un solo paso, y sobre todo: rechazar en el mismo paso
-- lo que se da por supuesto.
--
-- Hacerlo en dos viajes desde la aplicación —resolver primero, comprobar la
-- marca después— dejaría el ingrediente CREADO cuando el intento se rechaza:
-- alguien escribe «sal», se le dice que no hace falta, y aun así se le queda
-- «sal» dentro del catálogo ensuciando el autocompletado. Aquí la excepción
-- deshace también la creación.

create function public.anadir_a_despensa(texto text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := public.resolver_ingrediente(texto);
  v_nombre text;
begin
  select nombre into v_nombre from public.ingredients where id = v_id;

  if exists (select 1 from public.ingredients where id = v_id and se_asume) then
    -- Sin concordancia de género a propósito: la lista tiene «sal» y «agua»
    -- (femeninas) junto a «aceite» (masculino), y cualquiera puede marcar lo
    -- que quiera. «ya se da por supuesta … tenerla» canta con «aceite».
    raise exception 'Con «%» ya contamos: no hace falta que esté en tu despensa', v_nombre
      using errcode = 'P0001';
  end if;

  insert into public.pantry (perfil_id, ingrediente_id)
  values ((select auth.uid()), v_id)
  on conflict do nothing;

  return v_id;
end;
$$;

comment on function public.anadir_a_despensa(text) is
  'Texto → ingrediente en la despensa. Rechaza los que se dan por supuestos, y '
  'lo hace antes de dejar rastro: la excepción deshace también la creación.';
