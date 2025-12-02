-- Supabase Database Functions
-- Run these in the Supabase SQL Editor to enable proper user data fetching

-- Function to get household members with user emails
-- This function can access auth.users because it runs server-side
CREATE OR REPLACE FUNCTION get_household_members_with_users(household_id_param UUID)
RETURNS TABLE (
  id UUID,
  household_id UUID,
  user_id UUID,
  role TEXT,
  created_at TIMESTAMPTZ,
  user_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    hm.id,
    hm.household_id,
    hm.user_id,
    hm.role,
    hm.created_at,
    au.email as user_email
  FROM household_members hm
  LEFT JOIN auth.users au ON au.id = hm.user_id
  WHERE hm.household_id = household_id_param
  ORDER BY hm.created_at ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_household_members_with_users(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_household_members_with_users IS 'Returns household members with their email addresses from auth.users table';
