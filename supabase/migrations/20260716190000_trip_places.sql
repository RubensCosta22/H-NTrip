-- H&NTrip: private catalog of useful trip places and reservations.

create table public.trip_places (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  category text not null,
  address text,
  phone text,
  website text,
  reservation_code text,
  starts_on date,
  ends_on date,
  planned_cost numeric(14, 2),
  actual_cost numeric(14, 2),
  rating smallint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  archived_by uuid references public.profiles (id),
  constraint trip_places_name_length check (char_length(name) between 1 and 140),
  constraint trip_places_category_allowed check (category in ('lodging', 'restaurant', 'cafe', 'attraction', 'event', 'parking', 'other')),
  constraint trip_places_address_length check (address is null or char_length(address) <= 300),
  constraint trip_places_phone_length check (phone is null or char_length(phone) <= 40),
  constraint trip_places_website_length check (website is null or char_length(website) <= 500),
  constraint trip_places_reservation_length check (reservation_code is null or char_length(reservation_code) <= 100),
  constraint trip_places_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint trip_places_date_order check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint trip_places_costs_nonnegative check ((planned_cost is null or planned_cost >= 0) and (actual_cost is null or actual_cost >= 0)),
  constraint trip_places_rating_range check (rating is null or rating between 1 and 5),
  constraint trip_places_trip_workspace_fk foreign key (trip_id, workspace_id) references public.trips (id, workspace_id) on delete cascade
);

create index trip_places_trip_category_idx on public.trip_places (trip_id, category, starts_on, name, id) where archived_at is null;
create trigger trip_places_set_updated_at before update on public.trip_places for each row execute function private.set_updated_at();
alter table public.trip_places enable row level security;
alter table public.trip_places force row level security;
create policy trip_places_select_member on public.trip_places for select to authenticated using ((select private.has_workspace_role(workspace_id)));
revoke all on public.trip_places from anon, authenticated;
grant select on public.trip_places to authenticated;

create or replace function public.add_trip_place(
  target_trip_id uuid, place_name text, place_category text, place_address text,
  place_phone text, place_website text, place_reservation_code text,
  place_starts_on date, place_ends_on date, place_planned_cost numeric,
  place_actual_cost numeric, place_rating smallint, place_notes text
) returns public.trip_places
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trip_record public.trips;
  place_record public.trip_places;
begin
  select * into trip_record from public.trips where id = target_trip_id and status <> 'archived';
  if actor_id is null or trip_record.id is null or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'place_access_denied' using errcode = '42501';
  end if;
  insert into public.trip_places (
    workspace_id, trip_id, name, category, address, phone, website, reservation_code,
    starts_on, ends_on, planned_cost, actual_cost, rating, notes, created_by, updated_by
  ) values (
    trip_record.workspace_id, target_trip_id, nullif(btrim(place_name), ''), place_category,
    nullif(btrim(place_address), ''), nullif(btrim(place_phone), ''), nullif(btrim(place_website), ''),
    nullif(btrim(place_reservation_code), ''), place_starts_on, place_ends_on, place_planned_cost,
    place_actual_cost, place_rating, nullif(btrim(place_notes), ''), actor_id, actor_id
  ) returning * into place_record;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (trip_record.workspace_id, actor_id, 'place.created', 'trip_place', place_record.id,
    jsonb_build_object('trip_id', target_trip_id, 'category', place_category));
  return place_record;
end;
$$;

create or replace function public.archive_trip_place(target_place_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  place_record public.trip_places;
begin
  select * into place_record from public.trip_places where id = target_place_id and archived_at is null;
  if actor_id is null or place_record.id is null or not private.has_workspace_role(place_record.workspace_id) then
    raise exception 'place_access_denied' using errcode = '42501';
  end if;
  update public.trip_places set archived_at = now(), archived_by = actor_id, updated_by = actor_id where id = target_place_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (place_record.workspace_id, actor_id, 'place.archived', 'trip_place', target_place_id,
    jsonb_build_object('trip_id', place_record.trip_id));
end;
$$;

revoke all on function public.add_trip_place(uuid, text, text, text, text, text, text, date, date, numeric, numeric, smallint, text) from public, anon;
grant execute on function public.add_trip_place(uuid, text, text, text, text, text, text, date, date, numeric, numeric, smallint, text) to authenticated;
revoke all on function public.archive_trip_place(uuid) from public, anon;
grant execute on function public.archive_trip_place(uuid) to authenticated;

comment on table public.trip_places is 'Private workspace-scoped guide of trip places and reservation references.';
comment on column public.trip_places.reservation_code is 'Reference label only. Never store passwords or payment credentials.';
