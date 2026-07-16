alter table public.trip_photos add column is_favorite boolean not null default false, add column is_cover boolean not null default false;
create unique index trip_photos_one_active_cover_idx on public.trip_photos (trip_id) where is_cover and archived_at is null;

create or replace function public.set_trip_photo_favorite(target_photo_id uuid, favorite boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); photo_record public.trip_photos;
begin
  select * into photo_record from public.trip_photos where id = target_photo_id and archived_at is null;
  if actor_id is null or photo_record.id is null or not private.has_workspace_role(photo_record.workspace_id) then raise exception 'photo_access_denied' using errcode = '42501'; end if;
  update public.trip_photos set is_favorite = favorite where id = target_photo_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata) values (photo_record.workspace_id, actor_id, case when favorite then 'photo.favorited' else 'photo.unfavorited' end, 'trip_photo', target_photo_id, jsonb_build_object('trip_id', photo_record.trip_id));
end; $$;

create or replace function public.set_trip_cover_photo(target_photo_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); photo_record public.trip_photos;
begin
  select * into photo_record from public.trip_photos where id = target_photo_id and archived_at is null;
  if actor_id is null or photo_record.id is null or not private.has_workspace_role(photo_record.workspace_id) then raise exception 'photo_access_denied' using errcode = '42501'; end if;
  update public.trip_photos set is_cover = false where trip_id = photo_record.trip_id and is_cover;
  update public.trip_photos set is_cover = true, is_favorite = true where id = target_photo_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata) values (photo_record.workspace_id, actor_id, 'photo.cover_selected', 'trip_photo', target_photo_id, jsonb_build_object('trip_id', photo_record.trip_id));
end; $$;

revoke all on function public.set_trip_photo_favorite(uuid, boolean) from public, anon;
grant execute on function public.set_trip_photo_favorite(uuid, boolean) to authenticated;
revoke all on function public.set_trip_cover_photo(uuid) from public, anon;
grant execute on function public.set_trip_cover_photo(uuid) to authenticated;
