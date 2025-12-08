-- Supabase Database Diagnostic Script
-- Run this in the Supabase SQL Editor to diagnose persistence issues
-- ======================================================================

-- 1. Check if RLS is enabled on all tables
-- ======================================================================
SELECT
  tablename,
  rowsecurity AS "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('households', 'household_members', 'shopping', 'tasks', 'clifford', 'quick_add', 'personal_tasks')
ORDER BY tablename;

-- 2. Check all existing policies
-- ======================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS "Operation",
  qual AS "USING clause",
  with_check AS "WITH CHECK clause"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Check if tables exist and their structure
-- ======================================================================
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('households', 'household_members', 'shopping', 'tasks', 'clifford', 'quick_add', 'personal_tasks')
ORDER BY table_name, ordinal_position;

-- 4. Check if helper function exists
-- ======================================================================
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_household_member';

-- 5. Check if profiles table exists
-- ======================================================================
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'profiles'
) AS "Profiles table exists";

-- 6. Count records in each table (you must be authenticated and be a household member to see data)
-- ======================================================================
SELECT
  'households' AS table_name,
  COUNT(*) AS record_count
FROM households
UNION ALL
SELECT
  'household_members',
  COUNT(*)
FROM household_members
UNION ALL
SELECT
  'shopping',
  COUNT(*)
FROM shopping
UNION ALL
SELECT
  'tasks',
  COUNT(*)
FROM tasks
UNION ALL
SELECT
  'clifford',
  COUNT(*)
FROM clifford
UNION ALL
SELECT
  'quick_add',
  COUNT(*)
FROM quick_add
UNION ALL
SELECT
  'personal_tasks',
  COUNT(*)
FROM personal_tasks;

-- 7. Check realtime publication
-- ======================================================================
SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
