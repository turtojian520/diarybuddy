-- DiaryBuddy Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================================
-- STEP 1: Add user_id column to both tables
-- (Skip if already exists)
-- ============================================================

alter table diary_fragments
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table diary_entries
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ============================================================
-- STEP 2: Remove old permissive policies
-- ============================================================

drop policy if exists "Allow all on diary_fragments" on diary_fragments;
drop policy if exists "Allow all on diary_entries" on diary_entries;

-- ============================================================
-- STEP 3: Set default user_id on insert to current auth user
-- ============================================================

alter table diary_fragments
  alter column user_id set default auth.uid();

alter table diary_entries
  alter column user_id set default auth.uid();

-- ============================================================
-- STEP 4: Create strict RLS policies
--   Only the owner of each row can read/write it.
-- ============================================================

-- diary_fragments
create policy "Users can insert their own fragments"
  on diary_fragments for insert
  with check (auth.uid() = user_id);

create policy "Users can select their own fragments"
  on diary_fragments for select
  using (auth.uid() = user_id);

create policy "Users can delete their own fragments"
  on diary_fragments for delete
  using (auth.uid() = user_id);

-- diary_entries
create policy "Users can insert their own entries"
  on diary_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can select their own entries"
  on diary_entries for select
  using (auth.uid() = user_id);

create policy "Users can update their own entries"
  on diary_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own entries"
  on diary_entries for delete
  using (auth.uid() = user_id);

-- ============================================================
-- STEP 6: diary_templates table
--   Stores user-defined AI prompt templates.
-- ============================================================

create table if not exists diary_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null default auth.uid(),
  name        text not null,
  description text not null default '',
  prompt      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table diary_templates enable row level security;

create policy "Users can select their own templates"
  on diary_templates for select
  using (auth.uid() = user_id);

create policy "Users can insert their own templates"
  on diary_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own templates"
  on diary_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own templates"
  on diary_templates for delete
  using (auth.uid() = user_id);

-- ============================================================
-- STEP 7: notion_connections table
--   Stores each user's Notion OAuth access token + selected
--   database. access_token is stored encrypted (AES-256-GCM).
-- ============================================================

create table if not exists notion_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null unique default auth.uid(),
  access_token_enc  text not null,
  bot_id            text,
  workspace_id      text,
  workspace_name    text,
  workspace_icon    text,
  data_source_id    text,
  data_source_title text,
  title_prop_name   text,
  date_prop_name    text,
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table notion_connections enable row level security;

create policy "Users can select their own notion connection"
  on notion_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notion connection"
  on notion_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notion connection"
  on notion_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own notion connection"
  on notion_connections for delete
  using (auth.uid() = user_id);
