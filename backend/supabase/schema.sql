-- Full database setup for Avora: tables, RLS policies, storage bucket and AI quota.
-- Paste into Supabase Dashboard -> SQL Editor and run. Safe to run again on an existing project.

create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  brand text,
  color text,
  pattern text,
  material text,
  style text,
  description text,
  season text default 'All',
  image_path text,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.clothing_items add column if not exists pattern text;
alter table public.clothing_items add column if not exists material text;
alter table public.clothing_items add column if not exists style text;
alter table public.clothing_items add column if not exists description text;

create index if not exists clothing_items_user_id_idx
  on public.clothing_items(user_id);

alter table public.clothing_items enable row level security;

drop policy if exists "Users can view their own clothing" on public.clothing_items;
create policy "Users can view their own clothing"
  on public.clothing_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own clothing" on public.clothing_items;
create policy "Users can add their own clothing"
  on public.clothing_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own clothing" on public.clothing_items;
create policy "Users can update their own clothing"
  on public.clothing_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own clothing" on public.clothing_items;
create policy "Users can delete their own clothing"
  on public.clothing_items for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('wardrobe-images', 'wardrobe-images', false)
on conflict (id) do nothing;

drop policy if exists "Users can view their own wardrobe images" on storage.objects;
create policy "Users can view their own wardrobe images"
  on storage.objects for select
  using (
    bucket_id = 'wardrobe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload their own wardrobe images" on storage.objects;
create policy "Users can upload their own wardrobe images"
  on storage.objects for insert
  with check (
    bucket_id = 'wardrobe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own wardrobe images" on storage.objects;
create policy "Users can update their own wardrobe images"
  on storage.objects for update
  using (
    bucket_id = 'wardrobe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own wardrobe images" on storage.objects;
create policy "Users can delete their own wardrobe images"
  on storage.objects for delete
  using (
    bucket_id = 'wardrobe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Daily AI quota per user, used by the edge functions (functions/_shared/rate-limit.ts).

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  function_name text not null,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, function_name, day)
);

-- Only the edge functions (service role) touch this table; the app has no access.
alter table public.ai_usage enable row level security;

-- Adds one call and returns false if the user is already at the limit for today.
create or replace function public.consume_ai_quota(p_user_id uuid, p_function text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  insert into public.ai_usage (user_id, function_name, day, count)
  values (p_user_id, p_function, current_date, 1)
  on conflict (user_id, function_name, day)
    do update set count = ai_usage.count + 1
    where ai_usage.count < p_limit
  returning count into used;

  return used is not null;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer) to service_role;
