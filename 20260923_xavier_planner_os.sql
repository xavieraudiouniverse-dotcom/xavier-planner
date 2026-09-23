-- Xavier Planner OS: additive migration for the existing xavier-planner project.
-- Preserves existing planner_tasks rows and owner isolation.
create extension if not exists pgcrypto;

alter table public.planner_tasks
  add column if not exists start_date date,
  add column if not exists start_time time without time zone,
  add column if not exists end_time time without time zone,
  add column if not exists priority text not null default 'medium',
  add column if not exists status text not null default 'planned',
  add column if not exists recurrence text not null default 'none',
  add column if not exists estimate_minutes integer not null default 30,
  add column if not exists tags text[] not null default '{}',
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.planner_tasks set status = 'done' where done and status <> 'done';
update public.planner_tasks set start_date = due where start_date is null;

alter table public.planner_tasks drop constraint if exists planner_tasks_priority_check;
alter table public.planner_tasks add constraint planner_tasks_priority_check check (priority in ('low','medium','high','urgent'));
alter table public.planner_tasks drop constraint if exists planner_tasks_status_check;
alter table public.planner_tasks add constraint planner_tasks_status_check check (status in ('planned','active','blocked','done'));
alter table public.planner_tasks drop constraint if exists planner_tasks_recurrence_check;
alter table public.planner_tasks add constraint planner_tasks_recurrence_check check (recurrence in ('none','daily','weekly','monthly','yearly'));
alter table public.planner_tasks drop constraint if exists planner_tasks_estimate_minutes_check;
alter table public.planner_tasks add constraint planner_tasks_estimate_minutes_check check (estimate_minutes between 0 and 100800);
alter table public.planner_tasks drop constraint if exists planner_tasks_self_parent_check;
alter table public.planner_tasks add constraint planner_tasks_self_parent_check check (parent_id is null or parent_id <> id);
alter table public.planner_tasks drop constraint if exists planner_tasks_dates_check;
alter table public.planner_tasks add constraint planner_tasks_dates_check check (start_date is null or start_date <= due);

create index if not exists planner_tasks_owner_due_idx on public.planner_tasks(user_id, due);
create index if not exists planner_tasks_owner_parent_idx on public.planner_tasks(user_id, parent_id);

create table if not exists public.planner_attachments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 task_id uuid not null,
 name text not null check (length(name) between 1 and 255),
 storage_path text not null unique,
 mime_type text not null default 'application/octet-stream',
 file_size bigint not null check (file_size between 0 and 20971520),
 created_at timestamptz not null default now(),
 constraint planner_attachments_task_owner_fk foreign key(task_id,user_id)
   references public.planner_tasks(id,user_id) on delete cascade
);
create index if not exists planner_attachments_owner_task_idx on public.planner_attachments(user_id,task_id);

create table if not exists public.planner_links (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 source_id uuid not null,
 target_id uuid not null,
 created_at timestamptz not null default now(),
 constraint planner_links_source_owner_fk foreign key(source_id,user_id) references public.planner_tasks(id,user_id) on delete cascade,
 constraint planner_links_target_owner_fk foreign key(target_id,user_id) references public.planner_tasks(id,user_id) on delete cascade,
 constraint planner_links_not_self check(source_id <> target_id),
 constraint planner_links_unique unique(user_id,source_id,target_id)
);
create index if not exists planner_links_owner_target_idx on public.planner_links(user_id,target_id);

alter table public.planner_tasks enable row level security;
alter table public.planner_attachments enable row level security;
alter table public.planner_links enable row level security;
-- Original own_tasks policy has both owner USAGE and CHECK predicates: keep it.
drop policy if exists "attachments_owner_select" on public.planner_attachments;
create policy "attachments_owner_select" on public.planner_attachments for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "attachments_owner_insert" on public.planner_attachments;
create policy "attachments_owner_insert" on public.planner_attachments for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "attachments_owner_delete" on public.planner_attachments;
create policy "attachments_owner_delete" on public.planner_attachments for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists "links_owner_all" on public.planner_links;
create policy "links_owner_all" on public.planner_links for all to authenticated
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select,insert,update,delete on public.planner_tasks to authenticated;
grant select,insert,delete on public.planner_attachments to authenticated;
grant select,insert,update,delete on public.planner_links to authenticated;
revoke all on public.planner_tasks, public.planner_attachments, public.planner_links from anon;

insert into storage.buckets (id,name,public,file_size_limit)
values ('planner-attachments','planner-attachments',false,20971520)
on conflict (id) do update set public=false, file_size_limit=20971520;

drop policy if exists "planner_files_read" on storage.objects;
create policy "planner_files_read" on storage.objects for select to authenticated
using (bucket_id='planner-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "planner_files_insert" on storage.objects;
create policy "planner_files_insert" on storage.objects for insert to authenticated
with check (bucket_id='planner-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "planner_files_delete" on storage.objects;
create policy "planner_files_delete" on storage.objects for delete to authenticated
using (bucket_id='planner-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
