create or replace function public.update_trip_photo_metadata(
  target_photo_id uuid,
  photo_caption text,
  photo_taken_on date,
  photo_location_name text,
  photo_latitude numeric,
  photo_longitude numeric
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); photo_record public.trip_photos;
begin
  select * into photo_record from public.trip_photos where id = target_photo_id and archived_at is null;
  if actor_id is null or photo_record.id is null or not private.has_workspace_role(photo_record.workspace_id) then
    raise exception 'photo_access_denied' using errcode = '42501';
  end if;
  update public.trip_photos set
    caption = nullif(btrim(photo_caption), ''), taken_on = photo_taken_on,
    location_name = nullif(btrim(photo_location_name), ''),
    location_latitude = photo_latitude, location_longitude = photo_longitude
  where id = target_photo_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (photo_record.workspace_id, actor_id, 'photo.metadata_updated', 'trip_photo', target_photo_id,
    jsonb_build_object('trip_id', photo_record.trip_id, 'has_location', nullif(btrim(photo_location_name), '') is not null));
end; $$;

revoke all on function public.update_trip_photo_metadata(uuid, text, date, text, numeric, numeric) from public, anon;
grant execute on function public.update_trip_photo_metadata(uuid, text, date, text, numeric, numeric) to authenticated;

create or replace function public.update_trip_document(
  target_document_id uuid,
  document_title text,
  document_category text,
  document_holder_name text,
  document_issued_on date,
  document_expires_on date,
  document_notes text
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); document_record public.trip_documents;
begin
  select * into document_record from public.trip_documents where id = target_document_id and archived_at is null;
  if actor_id is null or document_record.id is null or not private.has_workspace_role(document_record.workspace_id) then
    raise exception 'document_access_denied' using errcode = '42501';
  end if;
  update public.trip_documents set
    title = btrim(document_title), category = document_category,
    holder_name = nullif(btrim(document_holder_name), ''), issued_on = document_issued_on,
    expires_on = document_expires_on, notes = nullif(btrim(document_notes), '')
  where id = target_document_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (document_record.workspace_id, actor_id, 'document.updated', 'trip_document', target_document_id,
    jsonb_build_object('trip_id', document_record.trip_id, 'category', document_category));
end; $$;

revoke all on function public.update_trip_document(uuid, text, text, text, date, date, text) from public, anon;
grant execute on function public.update_trip_document(uuid, text, text, text, date, date, text) to authenticated;
