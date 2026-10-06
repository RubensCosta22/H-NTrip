create or replace function public.update_trip_place(
  target_place_id uuid,
  place_name text,
  place_category text,
  place_address text default '',
  place_phone text default '',
  place_website text default '',
  place_reservation_code text default '',
  place_starts_on date default null,
  place_ends_on date default null,
  place_planned_cost numeric default null,
  place_actual_cost numeric default null,
  place_rating integer default null,
  place_notes text default ''
) returns public.trip_places
language plpgsql security definer set search_path=''
as $$
declare actor_id uuid := (select auth.uid()); r public.trip_places;
begin
  select * into r from public.trip_places where id=target_place_id and archived_at is null;
  if actor_id is null or r.id is null or not private.has_workspace_role(r.workspace_id) then raise exception 'place_access_denied' using errcode='42501'; end if;
  if char_length(trim(place_name)) < 1 or place_planned_cost < 0 or place_actual_cost < 0 or (place_starts_on is not null and place_ends_on is not null and place_ends_on < place_starts_on) then raise exception 'invalid_place' using errcode='22023'; end if;
  update public.trip_places set name=trim(place_name), category=place_category, address=nullif(trim(place_address),''), phone=nullif(trim(place_phone),''), website=nullif(trim(place_website),''), reservation_code=nullif(trim(place_reservation_code),''), starts_on=place_starts_on, ends_on=place_ends_on, planned_cost=place_planned_cost, actual_cost=place_actual_cost, rating=place_rating, notes=nullif(trim(place_notes),''), updated_by=actor_id where id=target_place_id returning * into r;
  return r;
end; $$;
revoke all on function public.update_trip_place(uuid,text,text,text,text,text,text,date,date,numeric,numeric,integer,text) from public,anon;
grant execute on function public.update_trip_place(uuid,text,text,text,text,text,text,date,date,numeric,numeric,integer,text) to authenticated;