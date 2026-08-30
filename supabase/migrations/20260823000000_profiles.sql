-- Perfiles de usuario.
--
-- `auth.users` la gestiona GoTrue y no se toca. Todo lo que la aplicación
-- necesita saber de una persona vive aquí, empezando por el nombre con el que
-- dirigirse a ella. La despensa y las recetas colgarán de esta tabla más
-- adelante, así que la clave primaria es directamente el id del usuario.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.profiles is
  'Datos de la aplicación asociados a cada cuenta de auth.users.';

-- ── Aislamiento ───────────────────────────────────────────────────────────
-- El requisito dice que una persona no pueda leer ni escribir el perfil de
-- otra "con independencia de lo que solicite la aplicación". Eso significa que
-- la garantía tiene que estar en la base de datos, no en el código: si mañana
-- un loader se equivoca de filtro, la fila sigue sin salir.

alter table public.profiles enable row level security;

-- Las políticas RLS solo RESTRINGEN; no conceden nada. Sin estos GRANT, el rol
-- `authenticated` recibe "permission denied for table profiles" y no puede leer
-- ni siquiera su propia fila. Se conceden los dos verbos que la aplicación usa
-- y ninguno más: insertar es cosa del trigger, y borrar va en cascada con la
-- cuenta. A `anon` no se le concede nada: sin sesión no hay perfiles que ver.
grant select, update on public.profiles to authenticated;

create policy "Cada quien lee su perfil"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Cada quien modifica su perfil"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No hay política de INSERT ni de DELETE a propósito: el perfil lo crea el
-- trigger de abajo con privilegios elevados, y se borra en cascada al borrarse
-- la cuenta. Nadie inserta ni borra perfiles a mano.

-- ── Creación automática ───────────────────────────────────────────────────
-- El perfil existe desde el mismo momento que la cuenta, sin un segundo paso
-- que pueda fallar y dejar a alguien registrado y sin nombre. El nombre viaja
-- en los metadatos del alta (`options.data` en signUp).

create function public.crear_perfil_para_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nombre)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''), 'Cocinillas')
  );
  return new;
end;
$$;

comment on function public.crear_perfil_para_usuario_nuevo() is
  'Crea el perfil al dar de alta una cuenta. security definer porque el alta la '
  'ejecuta GoTrue, que no tiene permisos sobre public.profiles.';

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row
  execute function public.crear_perfil_para_usuario_nuevo();

-- ── Marca de tiempo ───────────────────────────────────────────────────────

create function public.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger tocar_perfil_actualizado
  before update on public.profiles
  for each row
  execute function public.tocar_actualizado_en();
