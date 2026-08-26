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
