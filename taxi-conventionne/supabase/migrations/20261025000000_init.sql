-- =====================================================================
-- Taxi Conventionné — Bourse de courses entre chauffeurs
-- Schéma Supabase (PostgreSQL). Installé par `npm run supabase:setup`,
-- ou à coller tel quel dans l'éditeur SQL de Supabase.
--
-- RÈGLE IMPORTANTE : aucune donnée de santé n'est stockée ici.
-- Pas de nom de patient, pas de motif médical, pas de bon de transport.
-- Les bons de transport (PMT) sont envoyés par mail, hors application.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profils chauffeurs
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null,
  phone             text not null,
  email             text not null,
  company           text,
  ads_number        text not null,           -- n° d'autorisation de stationnement
  pro_card_number   text not null,           -- n° de carte professionnelle
  cpam_conventionne boolean not null default false,
  verified          boolean not null default false,  -- validé par un admin
  is_admin          boolean not null default false,
  push_token        text,
  notify_radius_km  integer not null default 30,
  created_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Un utilisateur est "membre actif" s'il est validé par un admin.
create or replace function public.is_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select verified from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "profil: lecture" on public.profiles;
create policy "profil: lecture" on public.profiles for select
  using (id = auth.uid() or public.is_verified());

drop policy if exists "profil: création" on public.profiles;
create policy "profil: création" on public.profiles for insert
  with check (id = auth.uid() and verified = false and is_admin = false);

drop policy if exists "profil: modification" on public.profiles;
create policy "profil: modification" on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- Création automatique du profil à l'inscription, à partir des infos
-- saisies dans l'app (fonctionne aussi si la confirmation par mail est activée).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, company, ads_number, pro_card_number, cpam_conventionne)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    new.raw_user_meta_data ->> 'company',
    coalesce(new.raw_user_meta_data ->> 'ads_number', ''),
    coalesce(new.raw_user_meta_data ->> 'pro_card_number', ''),
    coalesce((new.raw_user_meta_data ->> 'cpam_conventionne')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Empêche un chauffeur de s'auto-valider ou de se nommer admin.
-- (Les modifications faites depuis le tableau de bord Supabase n'ont pas
-- d'utilisateur connecté : elles restent autorisées.)
create or replace function public.protect_profile_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.verified := old.verified;
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_flags on public.profiles;
create trigger protect_profile_flags before update on public.profiles
  for each row execute function public.protect_profile_flags();

-- ---------------------------------------------------------------------
-- Positions des chauffeurs (uniquement quand ils sont "disponibles")
-- ---------------------------------------------------------------------
create table if not exists public.driver_locations (
  driver_id  uuid primary key references public.profiles (id) on delete cascade,
  latitude   double precision not null,
  longitude  double precision not null,
  available  boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.driver_locations enable row level security;

-- On ne voit que les chauffeurs disponibles avec une position récente (< 15 min).
drop policy if exists "position: lecture" on public.driver_locations;
create policy "position: lecture" on public.driver_locations for select
  using (
    driver_id = auth.uid()
    or (public.is_verified() and available and updated_at > now() - interval '15 minutes')
  );

drop policy if exists "position: écriture" on public.driver_locations;
create policy "position: écriture" on public.driver_locations for insert
  with check (driver_id = auth.uid() and public.is_verified());

drop policy if exists "position: mise à jour" on public.driver_locations;
create policy "position: mise à jour" on public.driver_locations for update
  using (driver_id = auth.uid());

drop policy if exists "position: suppression" on public.driver_locations;
create policy "position: suppression" on public.driver_locations for delete
  using (driver_id = auth.uid());

-- ---------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------
do $$ begin
  create type public.ride_status as enum
    ('open', 'accepted', 'en_route', 'on_board', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ride_type as enum
    ('assis', 'aller_retour', 'consultation', 'hospitalisation', 'dialyse', 'autre');
exception when duplicate_object then null; end $$;

create table if not exists public.rides (
  id               uuid primary key default gen_random_uuid(),
  created_by       uuid not null references public.profiles (id) on delete cascade,
  -- Lieux : ville / quartier / établissement. PAS de nom de patient.
  pickup_label     text not null,
  pickup_latitude  double precision,
  pickup_longitude double precision,
  dropoff_label    text not null,
  dropoff_latitude  double precision,
  dropoff_longitude double precision,
  scheduled_at     timestamptz not null,
  ride_type        public.ride_type not null default 'assis',
  round_trip       boolean not null default false,
  notes            text check (char_length(notes) <= 300),
  status           public.ride_status not null default 'open',
  accepted_by      uuid references public.profiles (id) on delete set null,
  accepted_at      timestamptz,
  voucher_sent_at  timestamptz,                -- bon envoyé par mail (date seulement)
  notified_at      timestamptz,                -- notifications déjà envoyées
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists rides_status_idx on public.rides (status, scheduled_at);

alter table public.rides enable row level security;

-- Courses ouvertes : visibles par tous les membres validés.
-- Courses attribuées : visibles par le donneur d'ordre et le chauffeur.
drop policy if exists "course: lecture" on public.rides;
create policy "course: lecture" on public.rides for select
  using (
    public.is_verified() and (
      status = 'open' or created_by = auth.uid() or accepted_by = auth.uid()
    )
  );

drop policy if exists "course: création" on public.rides;
create policy "course: création" on public.rides for insert
  with check (
    created_by = auth.uid() and public.is_verified()
    and status = 'open' and accepted_by is null
  );

-- Les changements de statut passent par les fonctions ci-dessous
-- (pas d'UPDATE direct), pour garantir les règles métier.

-- ---------------------------------------------------------------------
-- Accepter une course : le premier qui accepte l'obtient (verrou atomique)
-- ---------------------------------------------------------------------
create or replace function public.accept_ride(p_ride_id uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare r public.rides;
begin
  if not public.is_verified() then
    raise exception 'Compte non validé';
  end if;

  update public.rides
     set status = 'accepted', accepted_by = auth.uid(),
         accepted_at = now(), updated_at = now()
   where id = p_ride_id and status = 'open' and created_by <> auth.uid()
  returning * into r;

  if r.id is null then
    raise exception 'Course déjà prise ou indisponible';
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Faire avancer une course
--   chauffeur       : en_route -> on_board -> completed, ou se désister (open)
--   donneur d'ordre : annuler, marquer le bon comme envoyé
-- ---------------------------------------------------------------------
create or replace function public.update_ride_status(p_ride_id uuid, p_status public.ride_status)
returns public.rides language plpgsql security definer set search_path = public as $$
declare r public.rides;
begin
  select * into r from public.rides where id = p_ride_id for update;
  if r.id is null then raise exception 'Course introuvable'; end if;

  if p_status = 'cancelled' then
    if r.created_by <> auth.uid() then raise exception 'Seul le donneur d''ordre peut annuler'; end if;
    if r.status in ('completed', 'cancelled') then raise exception 'Course déjà terminée'; end if;

  elsif p_status = 'open' then
    -- Le chauffeur se désiste : la course redevient disponible.
    if r.accepted_by is distinct from auth.uid() then raise exception 'Non autorisé'; end if;
    if r.status not in ('accepted', 'en_route') then raise exception 'Trop tard pour se désister'; end if;
    update public.rides set status = 'open', accepted_by = null, accepted_at = null,
           voucher_sent_at = null, updated_at = now()
     where id = p_ride_id returning * into r;
    return r;

  elsif p_status in ('en_route', 'on_board', 'completed') then
    if r.accepted_by is distinct from auth.uid() then raise exception 'Non autorisé'; end if;
    if not (
      (r.status = 'accepted' and p_status = 'en_route') or
      (r.status = 'en_route' and p_status = 'on_board') or
      (r.status = 'on_board' and p_status = 'completed')
    ) then
      raise exception 'Étape invalide';
    end if;

  else
    raise exception 'Statut non autorisé';
  end if;

  update public.rides set status = p_status, updated_at = now()
   where id = p_ride_id returning * into r;
  return r;
end $$;

create or replace function public.mark_voucher_sent(p_ride_id uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare r public.rides;
begin
  update public.rides set voucher_sent_at = now(), updated_at = now()
   where id = p_ride_id and created_by = auth.uid() and accepted_by is not null
  returning * into r;
  if r.id is null then raise exception 'Non autorisé'; end if;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Temps réel (carte et liste des courses mises à jour en direct)
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.rides;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.driver_locations;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- RGPD : purge automatique, chaque nuit à 3 h (planifiée en fin de fichier)
-- ---------------------------------------------------------------------
create or replace function public.purge_old_data()
returns void language sql security definer set search_path = public as $$
  delete from public.rides
   where (status in ('completed', 'cancelled') and updated_at < now() - interval '90 days')
      or (status = 'open' and scheduled_at < now() - interval '2 days');
  delete from public.driver_locations where updated_at < now() - interval '1 day';
$$;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('purge-courses', '0 3 * * *', 'select public.purge_old_data()');
exception when others then
  raise notice 'pg_cron indisponible : planifiez public.purge_old_data() manuellement';
end $$;
