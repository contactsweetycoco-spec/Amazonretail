-- Reproduit le minimum de l'environnement Supabase pour tester le schéma
-- sur un PostgreSQL ordinaire (schéma auth, auth.uid(), rôle, publication).
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create publication supabase_realtime;
grant usage on schema public, auth to authenticated;
