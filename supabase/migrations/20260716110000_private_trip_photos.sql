-- H&NTrip: private trip photo album with audited metadata.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-photos',
  'trip-photos',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  caption text,
  taken_on date,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  archived_by uuid references public.profiles (id),
  constraint trip_photos_filename_length check (char_length(original_filename) between 1 and 180),
  constraint trip_photos_path_length check (char_length(storage_path) between 1 and 500),
  constraint trip_photos_caption_length check (caption is null or char_length(caption) <= 500),
  constraint trip_photos_mime_allowed check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint trip_photos_size_allowed check (size_bytes between 1 and 15728640),
  constraint trip_photos_trip_workspace_fk foreign key (trip_id, workspace_id)
    references public.trips (id, workspace_id) on delete cascade
);

create index trip_photos_trip_taken_idx
  on public.trip_photos (trip_id, taken_on desc, created_at desc, id desc)
  where archived_at is null;

alter table public.trip_photos enable row level security;
alter table public.trip_photos force row level security;
create policy trip_photos_select_member on public.trip_photos for select to authenticated
using ((select private.has_workspace_role(workspace_id)));
revoke all on public.trip_photos from anon, authenticated;
grant select on public.trip_photos to authenticated;

create policy trip_photo_objects_select
on storage.objects for select to authenticated
using (
  bucket_id = 'trip-photos'
  and exists (
    select 1 from public.trips trip
    where trip.workspace_id::text = (storage.foldername(name))[1]
      and trip.id::text = (storage.foldername(name))[2]
      and trip.status <> 'archived'
      and private.has_workspace_role(trip.workspace_id)
  )
);

create policy trip_photo_objects_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trip-photos'
  and exists (
    select 1 from public.trips trip
    where trip.workspace_id::text = (storage.foldername(name))[1]
      and trip.id::text = (storage.foldername(name))[2]
      and trip.status <> 'archived'
      and private.has_workspace_role(trip.workspace_id)
  )
);

create policy trip_photo_objects_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'trip-photos'
  and exists (
    select 1 from public.trips trip
    where trip.workspace_id::text = (storage.foldername(name))[1]
      and trip.id::text = (storage.foldername(name))[2]
      and trip.status <> 'archived'
      and private.has_workspace_role(trip.workspace_id)
  )
);

create or replace function public.attach_trip_photo(
  target_trip_id uuid,
  object_path text,
  photo_original_name text,
  photo_mime_type text,
  photo_size_bytes bigint,
  photo_caption text,
  photo_taken_on date
)
returns public.trip_photos
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trip_record public.trips;
  photo_record public.trip_photos;
  expected_prefix text;
begin
  select * into trip_record from public.trips
  where id = target_trip_id and status <> 'archived';
  if actor_id is null or trip_record.id is null
    or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'photo_access_denied' using errcode = '42501';
  end if;

  expected_prefix := trip_record.workspace_id::text || '/' || trip_record.id::text || '/';
  if object_path not like expected_prefix || '%'
    or photo_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or photo_size_bytes < 1 or photo_size_bytes > 15728640
    or char_length(photo_original_name) not between 1 and 180
    or (photo_caption is not null and char_length(photo_caption) > 500) then
    raise exception 'invalid_trip_photo' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects where bucket_id = 'trip-photos' and name = object_path
  ) then
    raise exception 'photo_not_uploaded' using errcode = '23503';
  end if;

  insert into public.trip_photos (
    workspace_id, trip_id, storage_path, original_filename, mime_type, size_bytes,
    caption, taken_on, created_by
  ) values (
    trip_record.workspace_id, trip_record.id, object_path, photo_original_name,
    photo_mime_type, photo_size_bytes, nullif(btrim(photo_caption), ''),
    photo_taken_on, actor_id
  ) returning * into photo_record;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    trip_record.workspace_id, actor_id, 'photo.attached', 'trip_photo', photo_record.id,
    jsonb_build_object('trip_id', trip_record.id, 'mime_type', photo_mime_type, 'size_bytes', photo_size_bytes)
  );
  return photo_record;
end;
$$;

create or replace function public.archive_trip_photo(target_photo_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  photo_record public.trip_photos;
begin
  select * into photo_record from public.trip_photos
  where id = target_photo_id and archived_at is null;
  if actor_id is null or photo_record.id is null
    or not private.has_workspace_role(photo_record.workspace_id) then
    raise exception 'photo_access_denied' using errcode = '42501';
  end if;

  update public.trip_photos set archived_at = now(), archived_by = actor_id
  where id = target_photo_id;
  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    photo_record.workspace_id, actor_id, 'photo.archived', 'trip_photo', target_photo_id,
    jsonb_build_object('trip_id', photo_record.trip_id)
  );
end;
$$;

revoke all on function public.attach_trip_photo(uuid, text, text, text, bigint, text, date)
  from public, anon;
grant execute on function public.attach_trip_photo(uuid, text, text, text, bigint, text, date)
  to authenticated;
revoke all on function public.archive_trip_photo(uuid) from public, anon;
grant execute on function public.archive_trip_photo(uuid) to authenticated;

comment on table public.trip_photos is
  'Private album metadata. Objects are never public and previews use short-lived signed URLs.';
