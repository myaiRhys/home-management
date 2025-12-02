-- Backfill profiles for existing users
-- Run this AFTER running supabase-profiles-table.sql
-- This creates profiles for users who signed up before the profiles table existed

-- Insert profiles for all auth.users who don't have a profile yet
-- Uses the first part of their email (before @) as the display name
INSERT INTO public.profiles (id, display_name, created_at, updated_at)
SELECT
  au.id,
  SPLIT_PART(au.email, '@', 1) as display_name,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- Check how many profiles were created
SELECT COUNT(*) as profiles_created FROM public.profiles;
