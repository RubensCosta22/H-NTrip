-- H&NTrip: private document files with path-scoped Storage policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-documents',
  'trip-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.trip_documents
  add constraint trip_documents_id_trip_workspace_key unique (id, trip_id, workspace_id);

create table public.trip_document_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  document_id uuid not null references public.trip_documents (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint trip_document_files_name_length check (char_length(original_filename) between 1 and 180),
  constraint trip_document_files_path_length check (char_length(storage_path) between 1 and 500),
  constraint trip_document_files_mime_allowed check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  constraint trip_document_files_size_allowed check (size_bytes between 1 and 10485760),
  constraint trip_document_files_document_scope_fk
    foreign key (document_id, trip_id, workspace_id)
    references public.trip_documents (id, trip_id, workspace_id) on delete cascade
);

create index trip_document_files_document_idx
  on public.trip_document_files (document_id, created_at, id);

alter table public.trip_document_files enable row level security;
alter table public.trip_document_files force row level security;

create policy trip_document_files_select_member
on public.trip_document_files for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

revoke all on public.trip_document_files from anon, authenticated;
grant select on public.trip_document_files to authenticated;

create policy trip_document_objects_select
on storage.objects for select to authenticated
using (
  bucket_id = 'trip-documents'
  and exists (
    select 1 from public.trip_documents document
    where document.workspace_id::text = (storage.foldername(name))[1]
      and document.trip_id::text = (storage.foldername(name))[2]
      and document.id::text = (storage.foldername(name))[3]
      and document.archived_at is null
      and private.has_workspace_role(document.workspace_id)
  )
);

create policy trip_document_objects_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trip-documents'
  and exists (
    select 1 from public.trip_documents document
    where document.workspace_id::text = (storage.foldername(name))[1]
      and document.trip_id::text = (storage.foldername(name))[2]
      and document.id::text = (storage.foldername(name))[3]
      and document.archived_at is null
      and private.has_workspace_role(document.workspace_id)
  )
);

create policy trip_document_objects_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'trip-documents'
  and exists (
    select 1 from public.trip_documents document
    where document.workspace_id::text = (storage.foldername(name))[1]
      and document.trip_id::text = (storage.foldername(name))[2]
      and document.id::text = (storage.foldername(name))[3]
      and document.archived_at is null
      and private.has_workspace_role(document.workspace_id)
  )
);

create or replace function public.attach_trip_document_file(
  target_document_id uuid,
  object_path text,
  file_original_name text,
  file_mime_type text,
  file_size_bytes bigint
)
returns public.trip_document_files
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  document_record public.trip_documents;
  file_record public.trip_document_files;
  expected_prefix text;
begin
  select * into document_record from public.trip_documents
  where id = target_document_id and archived_at is null;
  if actor_id is null or document_record.id is null
    or not private.has_workspace_role(document_record.workspace_id) then
    raise exception 'document_file_access_denied' using errcode = '42501';
  end if;

  expected_prefix := document_record.workspace_id::text || '/'
    || document_record.trip_id::text || '/' || document_record.id::text || '/';
  if object_path not like expected_prefix || '%'
    or file_mime_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
    or file_size_bytes < 1 or file_size_bytes > 10485760
    or char_length(file_original_name) not between 1 and 180 then
    raise exception 'invalid_document_file' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'trip-documents' and name = object_path
  ) then
    raise exception 'document_file_not_uploaded' using errcode = '23503';
  end if;

  insert into public.trip_document_files (
    workspace_id, trip_id, document_id, storage_path, original_filename,
    mime_type, size_bytes, created_by
  ) values (
    document_record.workspace_id, document_record.trip_id, document_record.id,
    object_path, file_original_name, file_mime_type, file_size_bytes, actor_id
  ) returning * into file_record;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    document_record.workspace_id,
    actor_id,
    'document.file_attached',
    'trip_document_file',
    file_record.id,
    jsonb_build_object(
      'trip_id', document_record.trip_id,
      'document_id', document_record.id,
      'mime_type', file_mime_type,
      'size_bytes', file_size_bytes
    )
  );
  return file_record;
end;
$$;

revoke all on function public.attach_trip_document_file(uuid, text, text, text, bigint)
  from public, anon;
grant execute on function public.attach_trip_document_file(uuid, text, text, text, bigint)
  to authenticated;

comment on table public.trip_document_files is
  'Metadata for objects in the private trip-documents bucket; access uses short-lived signed URLs.';
