# Supabase Setup Instructions

## Database Function Setup

To enable proper display of household member names/emails, you need to create a database function in Supabase.

### Steps:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Function Creation Script**
   - Copy the contents of `supabase-functions.sql`
   - Paste into the SQL Editor
   - Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)

4. **Verify the Function**
   - You should see: "Success. No rows returned"
   - This means the function was created successfully

### What This Does

The function `get_household_members_with_users()` allows the app to:
- Fetch household members WITH their email addresses
- Access the `auth.users` table (which can't be accessed directly from the client)
- Display actual names/emails instead of user IDs

### After Setup

Once the function is created:
1. Refresh the app (Cmd+Shift+R or Ctrl+Shift+F5)
2. Navigate to Settings
3. You should now see email addresses instead of user IDs in the Household Members section
4. When assigning tasks, you'll see member emails in the assignee field

### Troubleshooting

If you still see user IDs after running the script:
1. Check the Supabase SQL Editor for any error messages
2. Make sure you ran the script in the correct project
3. Clear browser cache and refresh
4. Check browser console (F12) for any error messages
