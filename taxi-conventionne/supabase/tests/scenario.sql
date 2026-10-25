-- Scénario complet : 3 chauffeurs validés (A admin, B, C) et 1 non validé (D).
-- Chaque vérification lève une erreur si une règle n'est pas respectée.

create function pg_temp.must_fail(stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'AURAIT DÛ ÉCHOUER : %', stmt using errcode = 'P0099';
exception
  when sqlstate 'P0099' then raise;
  when others then null;
end $$;

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'ÉCHEC : %', what; end if;
  raise notice 'ok - %', what;
end $$;

grant select, insert, update, delete on all tables in schema public to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'a@x.fr', '{"full_name":"Alice","phone":"1","ads_number":"A1","pro_card_number":"P1","cpam_conventionne":true}'),
 ('00000000-0000-0000-0000-00000000000b', 'b@x.fr', '{"full_name":"Bob","phone":"2","ads_number":"A2","pro_card_number":"P2"}'),
 ('00000000-0000-0000-0000-00000000000c', 'c@x.fr', '{"full_name":"Chloé","phone":"3","ads_number":"A3","pro_card_number":"P3"}'),
 ('00000000-0000-0000-0000-00000000000d', 'd@x.fr', '{"full_name":"Dan","phone":"4","ads_number":"A4","pro_card_number":"P4"}');

select pg_temp.check((select count(*) = 4 from profiles where not verified), 'profils créés à l''inscription, non validés');
select pg_temp.check((select cpam_conventionne from profiles where email = 'a@x.fr'), 'infos d''inscription recopiées');

-- Validation depuis le tableau de bord (sans utilisateur connecté).
update profiles set verified = true where email in ('a@x.fr', 'b@x.fr', 'c@x.fr');
update profiles set is_admin = true where email = 'a@x.fr';
select pg_temp.check((select count(*) = 3 from profiles where verified), 'validation depuis le tableau de bord');

set role authenticated;

-- D : non validé
set test.uid = '00000000-0000-0000-0000-00000000000d';
update profiles set verified = true, is_admin = true where id = auth.uid();
select pg_temp.check((select not verified and not is_admin from profiles where id = auth.uid()), 'un chauffeur ne peut pas se valider lui-même');
select pg_temp.must_fail($$insert into rides (created_by, pickup_label, dropoff_label, scheduled_at) values (auth.uid(), 'X', 'Y', now() + interval '1 day')$$);
select pg_temp.check(true, 'un non validé ne peut pas publier');

-- A publie
set test.uid = '00000000-0000-0000-0000-00000000000a';
insert into rides (id, created_by, pickup_label, dropoff_label, scheduled_at)
values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'Montreuil', 'Hôpital, Paris 13e', now() + interval '1 day');
select pg_temp.must_fail($$select accept_ride('11111111-1111-1111-1111-111111111111')$$);
select pg_temp.check(true, 'on ne peut pas accepter sa propre course');
select pg_temp.must_fail($$insert into rides (created_by, pickup_label, dropoff_label, scheduled_at) values ('00000000-0000-0000-0000-00000000000b', 'X', 'Y', now())$$);
select pg_temp.check(true, 'on ne peut pas publier au nom d''un autre');

set test.uid = '00000000-0000-0000-0000-00000000000d';
select pg_temp.check((select count(*) = 0 from rides), 'un non validé ne voit aucune course');

-- B accepte, C arrive trop tard
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select status = 'accepted' from accept_ride('11111111-1111-1111-1111-111111111111')), 'B accepte la course');
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.must_fail($$select accept_ride('11111111-1111-1111-1111-111111111111')$$);
select pg_temp.check(true, 'C ne peut pas prendre une course déjà acceptée');
select pg_temp.check((select count(*) = 0 from rides), 'C ne voit plus la course attribuée à B');
update rides set accepted_by = auth.uid() where id = '11111111-1111-1111-1111-111111111111';
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select accepted_by = auth.uid() from rides where id = '11111111-1111-1111-1111-111111111111'), 'une modification directe est sans effet');

-- A : bon envoyé, mais ne peut pas faire avancer la course à la place du chauffeur
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select voucher_sent_at is not null from mark_voucher_sent('11111111-1111-1111-1111-111111111111')), 'le donneur d''ordre marque le bon envoyé');
select pg_temp.must_fail($$select update_ride_status('11111111-1111-1111-1111-111111111111', 'en_route')$$);
select pg_temp.check(true, 'le donneur d''ordre ne fait pas avancer la course');

-- B : étapes
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.must_fail($$select update_ride_status('11111111-1111-1111-1111-111111111111', 'completed')$$);
select pg_temp.check(true, 'on ne peut pas sauter d''étape');
select pg_temp.check((select status = 'en_route' from update_ride_status('11111111-1111-1111-1111-111111111111', 'en_route')), 'B en route');
select pg_temp.check((select status = 'open' and accepted_by is null and voucher_sent_at is null
  from update_ride_status('11111111-1111-1111-1111-111111111111', 'open')), 'B se désiste : la course redevient disponible');

-- C reprend et termine
set test.uid = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select status = 'accepted' from accept_ride('11111111-1111-1111-1111-111111111111')), 'C reprend la course');
select update_ride_status('11111111-1111-1111-1111-111111111111', 'en_route');
select update_ride_status('11111111-1111-1111-1111-111111111111', 'on_board');
select pg_temp.check((select status = 'completed' from update_ride_status('11111111-1111-1111-1111-111111111111', 'completed')), 'C termine la course');
select pg_temp.must_fail($$select update_ride_status('11111111-1111-1111-1111-111111111111', 'open')$$);
select pg_temp.check(true, 'trop tard pour se désister');

set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.must_fail($$select update_ride_status('11111111-1111-1111-1111-111111111111', 'cancelled')$$);
select pg_temp.check(true, 'une course terminée ne peut pas être annulée');

-- Positions
set test.uid = '00000000-0000-0000-0000-00000000000b';
insert into driver_locations (driver_id, latitude, longitude) values (auth.uid(), 48.86, 2.44);
set test.uid = '00000000-0000-0000-0000-00000000000c';
insert into driver_locations (driver_id, latitude, longitude, updated_at) values (auth.uid(), 48.85, 2.35, now() - interval '1 hour');
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) = 1 from driver_locations), 'seules les positions récentes sont visibles');
set test.uid = '00000000-0000-0000-0000-00000000000d';
select pg_temp.check((select count(*) = 0 from driver_locations), 'un non validé ne voit aucune position');
select pg_temp.must_fail($$insert into driver_locations (driver_id, latitude, longitude) values (auth.uid(), 1, 1)$$);
select pg_temp.check(true, 'un non validé ne partage pas sa position');

-- Admin valide D
set test.uid = '00000000-0000-0000-0000-00000000000a';
update profiles set verified = true where email = 'd@x.fr';
select pg_temp.check((select verified from profiles where email = 'd@x.fr'), 'l''admin valide un chauffeur dans l''app');

reset role;
select public.purge_old_data();
select pg_temp.check(true, 'purge RGPD');
