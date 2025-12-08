-- Supabase RLS (Row Level Security) Policies
-- Run this script in the Supabase SQL Editor to fix sync issues between household members
--
-- IMPORTANT: Run this AFTER creating the tables
-- This script enables RLS and creates policies for all household-related tables

-- =============================================
-- STEP 1: Enable RLS on all tables
-- =============================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clifford ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_add ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 2: Helper function to check household membership
-- =============================================

CREATE OR REPLACE FUNCTION is_household_member(check_household_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM household_members
    WHERE household_members.household_id = check_household_id
    AND household_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 3: Households table policies
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view households they belong to" ON households;
DROP POLICY IF EXISTS "Users can create households" ON households;
DROP POLICY IF EXISTS "Admins can update their household" ON households;

-- SELECT: Users can only see households they're members of
CREATE POLICY "Users can view households they belong to"
ON households FOR SELECT
USING (is_household_member(id));

-- INSERT: Any authenticated user can create a household
CREATE POLICY "Users can create households"
ON households FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Only household admins can update
CREATE POLICY "Admins can update their household"
ON households FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM household_members
    WHERE household_members.household_id = households.id
    AND household_members.user_id = auth.uid()
    AND household_members.role = 'admin'
  )
);

-- =============================================
-- STEP 4: Household Members table policies
-- =============================================

DROP POLICY IF EXISTS "Users can view members of their household" ON household_members;
DROP POLICY IF EXISTS "Users can join households" ON household_members;
DROP POLICY IF EXISTS "Admins can remove members" ON household_members;

-- SELECT: Users can see members of households they belong to
CREATE POLICY "Users can view members of their household"
ON household_members FOR SELECT
USING (is_household_member(household_id));

-- INSERT: Users can add themselves to a household (joining)
CREATE POLICY "Users can join households"
ON household_members FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR
  -- Or they're the creator of a new household (admin adding themselves)
  EXISTS (
    SELECT 1 FROM households
    WHERE households.id = household_id
    AND households.created_by = auth.uid()
  )
);

-- DELETE: Admins can remove members, or users can remove themselves
CREATE POLICY "Admins can remove members"
ON household_members FOR DELETE
USING (
  -- User can remove themselves
  user_id = auth.uid()
  OR
  -- Or admin of the household can remove others
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = household_members.household_id
    AND hm.user_id = auth.uid()
    AND hm.role = 'admin'
  )
);

-- =============================================
-- STEP 5: Shopping table policies
-- =============================================

DROP POLICY IF EXISTS "Users can view shopping items in their household" ON shopping;
DROP POLICY IF EXISTS "Users can insert shopping items in their household" ON shopping;
DROP POLICY IF EXISTS "Users can update shopping items in their household" ON shopping;
DROP POLICY IF EXISTS "Users can delete shopping items in their household" ON shopping;

-- SELECT
CREATE POLICY "Users can view shopping items in their household"
ON shopping FOR SELECT
USING (is_household_member(household_id));

-- INSERT
CREATE POLICY "Users can insert shopping items in their household"
ON shopping FOR INSERT
WITH CHECK (is_household_member(household_id));

-- UPDATE
CREATE POLICY "Users can update shopping items in their household"
ON shopping FOR UPDATE
USING (is_household_member(household_id));

-- DELETE
CREATE POLICY "Users can delete shopping items in their household"
ON shopping FOR DELETE
USING (is_household_member(household_id));

-- =============================================
-- STEP 6: Tasks table policies
-- =============================================

DROP POLICY IF EXISTS "Users can view tasks in their household" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their household" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their household" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their household" ON tasks;

-- SELECT
CREATE POLICY "Users can view tasks in their household"
ON tasks FOR SELECT
USING (is_household_member(household_id));

-- INSERT
CREATE POLICY "Users can insert tasks in their household"
ON tasks FOR INSERT
WITH CHECK (is_household_member(household_id));

-- UPDATE
CREATE POLICY "Users can update tasks in their household"
ON tasks FOR UPDATE
USING (is_household_member(household_id));

-- DELETE
CREATE POLICY "Users can delete tasks in their household"
ON tasks FOR DELETE
USING (is_household_member(household_id));

-- =============================================
-- STEP 7: Clifford table policies
-- =============================================

DROP POLICY IF EXISTS "Users can view clifford items in their household" ON clifford;
DROP POLICY IF EXISTS "Users can insert clifford items in their household" ON clifford;
DROP POLICY IF EXISTS "Users can update clifford items in their household" ON clifford;
DROP POLICY IF EXISTS "Users can delete clifford items in their household" ON clifford;

-- SELECT
CREATE POLICY "Users can view clifford items in their household"
ON clifford FOR SELECT
USING (is_household_member(household_id));

-- INSERT
CREATE POLICY "Users can insert clifford items in their household"
ON clifford FOR INSERT
WITH CHECK (is_household_member(household_id));

-- UPDATE
CREATE POLICY "Users can update clifford items in their household"
ON clifford FOR UPDATE
USING (is_household_member(household_id));

-- DELETE
CREATE POLICY "Users can delete clifford items in their household"
ON clifford FOR DELETE
USING (is_household_member(household_id));

-- =============================================
-- STEP 8: Quick Add table policies
-- =============================================

DROP POLICY IF EXISTS "Users can view quick_add items in their household" ON quick_add;
DROP POLICY IF EXISTS "Users can insert quick_add items in their household" ON quick_add;
DROP POLICY IF EXISTS "Users can update quick_add items in their household" ON quick_add;
DROP POLICY IF EXISTS "Users can delete quick_add items in their household" ON quick_add;

-- SELECT
CREATE POLICY "Users can view quick_add items in their household"
ON quick_add FOR SELECT
USING (is_household_member(household_id));

-- INSERT
CREATE POLICY "Users can insert quick_add items in their household"
ON quick_add FOR INSERT
WITH CHECK (is_household_member(household_id));

-- UPDATE
CREATE POLICY "Users can update quick_add items in their household"
ON quick_add FOR UPDATE
USING (is_household_member(household_id));

-- DELETE
CREATE POLICY "Users can delete quick_add items in their household"
ON quick_add FOR DELETE
USING (is_household_member(household_id));

-- =============================================
-- STEP 9: Enable Realtime for all tables
-- =============================================

-- This ensures realtime subscriptions work properly
ALTER PUBLICATION supabase_realtime ADD TABLE shopping;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE clifford;
ALTER PUBLICATION supabase_realtime ADD TABLE quick_add;
ALTER PUBLICATION supabase_realtime ADD TABLE household_members;

-- =============================================
-- VERIFICATION
-- =============================================

-- Run this to verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Run this to see all policies:
-- SELECT * FROM pg_policies WHERE schemaname = 'public';
