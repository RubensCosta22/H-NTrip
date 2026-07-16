-- H&NTrip: evaluate photo object access through one RLS-safe membership helper.

create or replace function private.can_access_trip_photo_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips trip
    join public.workspace_members member
      on member.workspace_id = trip.workspace_id
    where trip.workspace_id::text = (storage.foldername(object_name))[1]
      and trip.id::text = (storage.foldername(object_name))[2]
      and trip.status <> 'archived'
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  );
$$;

revoke all on function private.can_access_trip_photo_object(text) from public, anon;
grant execute on function private.can_access_trip_photo_object(text) to authenticated;

drop policy if exists trip_photo_objects_select on storage.objects;
drop policy if exists trip_photo_objects_insert on storage.objects;
drop policy if exists trip_photo_objects_delete on storage.objects;

create policy trip_photo_objects_select
on storage.objects for select to authenticated
using (
  bucket_id = 'trip-photos'
  and (select private.can_access_trip_photo_object(name))
);

create policy trip_photo_objects_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trip-photos'
  and (select private.can_access_trip_photo_object(name))
);

create policy trip_photo_objects_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'trip-photos'
  and (select private.can_access_trip_photo_object(name))
);

comment on function private.can_access_trip_photo_object(text) is
  'Checks the authenticated active membership for a workspace/trip object path.';
