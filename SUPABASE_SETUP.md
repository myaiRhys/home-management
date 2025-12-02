# Supabase Setup Instructions

## Profiles Table Setup

To enable display names for household members, you need to create a `profiles` table in Supabase.

### Steps:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Profiles Table Script**
   - Copy the contents of `supabase-profiles-table.sql`
   - Paste into the SQL Editor
   - Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)

4. **Verify the Table**
   - You should see: "Success. No rows returned"
   - This means the table and triggers were created successfully

### What This Does

The `profiles` table allows users to:
- Set custom display names (like "Mom", "Dad", "John", etc.)
- Have these names appear instead of user IDs or emails
- Auto-creates profiles for new users (using first part of email as default name)

### After Setup

Once the table is created:
1. Refresh the app (Cmd+Shift+R or Ctrl+Shift+F5)
2. Navigate to Settings
3. You'll see a "Display Name" section at the top
4. Enter your name (e.g., "Mom", "Dad", or your actual name)
5. Click "Update Name"
6. Your name will now appear in the Household Members list
7. When assigning tasks, you'll see member names in the dropdown

### Setting Names for Existing Users

Each household member needs to:
1. Open the app and log in
2. Go to Settings
3. Enter their desired display name
4. Click "Update Name"

Once everyone sets their names, all household members will see friendly names instead of emails or IDs.

### Troubleshooting

If you still see "Member 1", "Member 2" after running the script:
1. Check the Supabase SQL Editor for any error messages
2. Make sure you ran the script in the correct project
3. Make sure each user has set their display name in Settings
4. Clear browser cache and refresh
5. Check browser console (F12) for any error messages

### Note About RPC Functions

The `supabase-functions.sql` file is no longer needed and can be ignored. We're using the profiles table approach instead.
