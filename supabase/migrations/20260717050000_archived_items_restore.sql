create or replace function public.restore_trip(target_trip_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); trip_record public.trips;
begin
  select * into trip_record from public.trips where id = target_trip_id and archived_at is not null;
  if actor_id is null or trip_record.id is null or not private.has_workspace_role(trip_record.workspace_id) then raise exception 'trip_access_denied' using errcode = '42501'; end if;
  update public.trips set status = 'draft', archived_at = null, updated_by = actor_id where id = target_trip_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (trip_record.workspace_id, actor_id, 'trip.restored', 'trip', target_trip_id, jsonb_build_object('restored_status', 'draft'));
end; $$;

create or replace function public.restore_trip_document(target_document_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); item public.trip_documents;
begin
  select * into item from public.trip_documents where id = target_document_id and archived_at is not null;
  if actor_id is null or item.id is null or not private.has_workspace_role(item.workspace_id) then raise exception 'document_access_denied' using errcode = '42501'; end if;
  update public.trip_documents set archived_at = null, archived_by = null, updated_by = actor_id where id = target_document_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (item.workspace_id, actor_id, 'document.restored', 'trip_document', target_document_id, jsonb_build_object('trip_id', item.trip_id));
end; $$;

create or replace function public.restore_trip_photo(target_photo_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); item public.trip_photos;
begin
  select * into item from public.trip_photos where id = target_photo_id and archived_at is not null;
  if actor_id is null or item.id is null or not private.has_workspace_role(item.workspace_id) then raise exception 'photo_access_denied' using errcode = '42501'; end if;
  update public.trip_photos set archived_at = null, archived_by = null, is_cover = false where id = target_photo_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (item.workspace_id, actor_id, 'photo.restored', 'trip_photo', target_photo_id, jsonb_build_object('trip_id', item.trip_id));
end; $$;

create or replace function public.restore_trip_place(target_place_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); item public.trip_places;
begin
  select * into item from public.trip_places where id = target_place_id and archived_at is not null;
  if actor_id is null or item.id is null or not private.has_workspace_role(item.workspace_id) then raise exception 'place_access_denied' using errcode = '42501'; end if;
  update public.trip_places set archived_at = null, archived_by = null, updated_by = actor_id where id = target_place_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (item.workspace_id, actor_id, 'place.restored', 'trip_place', target_place_id, jsonb_build_object('trip_id', item.trip_id));
end; $$;

revoke all on function public.restore_trip(uuid) from public, anon;
revoke all on function public.restore_trip_document(uuid) from public, anon;
revoke all on function public.restore_trip_photo(uuid) from public, anon;
revoke all on function public.restore_trip_place(uuid) from public, anon;
grant execute on function public.restore_trip(uuid) to authenticated;
grant execute on function public.restore_trip_document(uuid) to authenticated;
grant execute on function public.restore_trip_photo(uuid) to authenticated;
grant execute on function public.restore_trip_place(uuid) to authenticated;
