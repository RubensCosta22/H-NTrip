-- H&NTrip: secure document metadata before private file storage is enabled.

create table public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  category text not null,
  holder_name text,
  issued_on date,
  expires_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  archived_by uuid references public.profiles (id),
  constraint trip_documents_title_length check (char_length(title) between 1 and 140),
  constraint trip_documents_category_allowed check (
    category in ('identity', 'reservation', 'insurance', 'transport', 'health', 'other')
  ),
  constraint trip_documents_holder_length check (
    holder_name is null or char_length(holder_name) <= 120
  ),
  constraint trip_documents_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint trip_documents_date_order check (
    issued_on is null or expires_on is null or expires_on >= issued_on
  ),
  constraint trip_documents_trip_workspace_fk foreign key (trip_id, workspace_id)
    references public.trips (id, workspace_id) on delete cascade
);

create index trip_documents_trip_category_idx
  on public.trip_documents (trip_id, category, created_at, id)
  where archived_at is null;
create index trip_documents_expiration_idx
  on public.trip_documents (trip_id, expires_on, id)
  where archived_at is null and expires_on is not null;

create trigger trip_documents_set_updated_at
before update on public.trip_documents
for each row execute function private.set_updated_at();

alter table public.trip_documents enable row level security;
alter table public.trip_documents force row level security;

create policy trip_documents_select_member
on public.trip_documents for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

revoke all on public.trip_documents from anon, authenticated;
grant select on public.trip_documents to authenticated;

create or replace function public.add_trip_document(
  target_trip_id uuid,
  document_title text,
  document_category text,
  document_holder_name text,
  document_issued_on date,
  document_expires_on date,
  document_notes text
)
returns public.trip_documents
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trip_record public.trips;
  document_record public.trip_documents;
begin
  select * into trip_record from public.trips
  where id = target_trip_id and status <> 'archived';
  if actor_id is null or trip_record.id is null
    or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'document_access_denied' using errcode = '42501';
  end if;

  insert into public.trip_documents (
    workspace_id, trip_id, title, category, holder_name, issued_on, expires_on,
    notes, created_by, updated_by
  ) values (
    trip_record.workspace_id,
    target_trip_id,
    nullif(btrim(document_title), ''),
    document_category,
    nullif(btrim(document_holder_name), ''),
    document_issued_on,
    document_expires_on,
    nullif(btrim(document_notes), ''),
    actor_id,
    actor_id
  ) returning * into document_record;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    trip_record.workspace_id,
    actor_id,
    'document.created',
    'trip_document',
    document_record.id,
    jsonb_build_object('trip_id', target_trip_id, 'category', document_category)
  );
  return document_record;
end;
$$;

create or replace function public.archive_trip_document(target_document_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  document_record public.trip_documents;
begin
  select * into document_record from public.trip_documents
  where id = target_document_id and archived_at is null;
  if actor_id is null or document_record.id is null
    or not private.has_workspace_role(document_record.workspace_id) then
    raise exception 'document_access_denied' using errcode = '42501';
  end if;

  update public.trip_documents
  set archived_at = now(), archived_by = actor_id, updated_by = actor_id
  where id = target_document_id;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    document_record.workspace_id,
    actor_id,
    'document.archived',
    'trip_document',
    target_document_id,
    jsonb_build_object('trip_id', document_record.trip_id)
  );
end;
$$;

revoke all on function public.add_trip_document(uuid, text, text, text, date, date, text)
  from public, anon;
grant execute on function public.add_trip_document(uuid, text, text, text, date, date, text)
  to authenticated;
revoke all on function public.archive_trip_document(uuid) from public, anon;
grant execute on function public.archive_trip_document(uuid) to authenticated;

comment on table public.trip_documents is
  'Private trip document metadata. File objects must use a separate private Storage bucket.';
comment on column public.trip_documents.holder_name is
  'Informational holder label only; never grants workspace access.';
