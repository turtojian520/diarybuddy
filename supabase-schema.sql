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
-- STEP 5 (optional): Backfill existing rows if you have data
--   Replace '<your-user-id>' with your actual auth.users UUID.
--   Find it in: Supabase Dashboard → Authentication → Users
-- ============================================================

-- update diary_fragments set user_id = '<your-user-id>' where user_id is null;
-- update diary_entries  set user_id = '<your-user-id>' where user_id is null;
