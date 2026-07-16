alter table public.trip_photos
  add column location_name text,
  add column location_latitude numeric(9, 6),
  add column location_longitude numeric(9, 6),
  add constraint trip_photos_location_name_length check (location_name is null or char_length(location_name) <= 180),
  add constraint trip_photos_coordinates_paired check ((location_latitude is null) = (location_longitude is null)),
  add constraint trip_photos_latitude_range check (location_latitude is null or location_latitude between -90 and 90),
  add constraint trip_photos_longitude_range check (location_longitude is null or location_longitude between -180 and 180);

create or replace function public.set_trip_photo_location(target_photo_id uuid, photo_location_name text, photo_latitude numeric, photo_longitude numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); photo_record public.trip_photos;
begin
  select * into photo_record from public.trip_photos where id = target_photo_id and archived_at is null;
  if actor_id is null or photo_record.id is null or not private.has_workspace_role(photo_record.workspace_id) then raise exception 'photo_access_denied' using errcode = '42501'; end if;
  update public.trip_photos set location_name = nullif(btrim(photo_location_name), ''), location_latitude = photo_latitude, location_longitude = photo_longitude where id = target_photo_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata) values (photo_record.workspace_id, actor_id, 'photo.location_updated', 'trip_photo', target_photo_id, jsonb_build_object('trip_id', photo_record.trip_id, 'has_coordinates', photo_latitude is not null));
end; $$;

revoke all on function public.set_trip_photo_location(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.set_trip_photo_location(uuid, text, numeric, numeric) to authenticated;
comment on column public.trip_photos.location_latitude is 'Optional user-entered coordinate; never inferred from device geolocation.';
