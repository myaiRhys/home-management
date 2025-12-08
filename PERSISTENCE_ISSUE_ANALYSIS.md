# Persistence Issue Analysis

## Problem
New items are not persisting after closing and reopening the app.

## Root Cause Analysis

Based on the codebase review, there are **three primary reasons** why items might not persist:

### 1. Row Level Security (RLS) Policies Not Set Up
**Severity: CRITICAL**

The app requires RLS policies to be configured in Supabase for users to insert, update, and delete items. Without these policies, all write operations will fail with a "permission denied" error.

**Files involved:**
- `supabase-rls-policies.sql` - Main RLS policies for household tables
- `supabase-personal-tasks.sql` - RLS policies for personal tasks table

**What happens when RLS is missing:**
- Items appear to save (optimistic update in UI)
- Background database operation fails silently
- Items disappear when app is reloaded
- Browser console shows policy/permission errors (error code 42501)

### 2. User Not a Household Member
**Severity: HIGH**

All household-related operations (shopping, tasks, clifford, quick_add) require the user to be a member of a household. If the user isn't properly added to the `household_members` table, they cannot:
- View items in the household
- Create new items
- Update or delete existing items

**database.js:18-33** - The helper function `is_household_member()` checks membership for every operation.

### 3. Authentication Session Expired
**Severity: MEDIUM**

If the JWT session expires, the user loses access to perform database operations. The app checks for this in `database.js:104,149,188`.

**What happens:**
- User can interact with UI (optimistic updates work)
- Background database operations fail with auth/JWT errors
- Items don't persist to database

## How the App Works

### Optimistic Updates
The app uses "optimistic updates" for better UX:

1. **User adds item** → Item appears immediately in UI (with temporary ID)
2. **App saves to database** → Happens in background
3. **If successful** → Temporary item replaced with real item from database
4. **If failed** → Item marked as "pending" and queued for retry

This means items **appear** to save even when the database operation fails!

See: `database.js:541-558` for shopping example.

### Error Handling
The app has comprehensive error detection in `database.js:96-108`:
- Policy errors (RLS) → "Unable to save - permission denied"
- Timeout errors → "Save timed out"
- Auth errors → "Session expired"
- Offline → "You are offline"

Check the browser console for these messages.

## Diagnostic Steps

### Method 1: Console Script (EASIEST - RECOMMENDED)

1. Open `index.html` in your browser and **log in**
2. Press **F12** (or **Cmd+Opt+J** on Mac) to open the console
3. Open the file `console-test.js` in your text editor
4. **Copy the entire contents** of the file
5. **Paste into the browser console** and press Enter
6. Read the diagnostic results

This will immediately tell you what's wrong and how to fix it!

### Method 2: Test Page

1. Open the app in your browser and **log in**
2. In a new tab, open: `test-simple.html` (from your project folder)
3. Click **"1. Check Authentication"**
4. Click **"2. Check Household Membership"**
5. Click **"3. Test RLS Policies"**

**What to look for:**
- ❌ "INSERT is blocked by RLS policy" → RLS policies not set up
- ❌ "User is not a member of any household" → Need to create/join household
- ❌ "Not authenticated" → Session expired, need to log in
- ✅ All tests pass → The issue is elsewhere

### Step 2: Check Browser Console
1. Open the app: `http://localhost:8000/index.html`
2. Open browser console (F12 or Cmd+Opt+J on Mac)
3. Try to add an item
4. Look for errors in console:
   - Red error messages with "policy" or "42501" → RLS issue
   - "JWT" or "auth" errors → Authentication issue
   - Network errors → Connection issue

### Step 3: Run Database Diagnostic (Optional)
I've created a diagnostic SQL script to check your Supabase setup:

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy contents of `supabase-diagnostic.sql`
4. Run the query
5. Check the results:
   - All tables should have `RLS Enabled = true`
   - Should see multiple policies per table
   - Record counts should show your data

## Solutions

### Solution 1: Set Up RLS Policies (Most Common Fix)

If RLS policies are not set up or incomplete:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open a new query
3. Copy the contents of `supabase-rls-policies.sql`
4. Run the script (Cmd+Enter or Ctrl+Enter)
5. Wait for "Success. No rows returned"
6. **ALSO** run `supabase-personal-tasks.sql` if you use personal tasks

**Verify it worked:**
- Run `test.html` again
- Click "5. Check RLS Policies"
- All tests should pass with ✅

### Solution 2: Join or Create a Household

If you're not a household member:

1. Open the app
2. If you don't have a household:
   - Go to Settings
   - Enter a household name
   - Click "Create Household"
3. If joining an existing household:
   - Get the invite code from another member
   - Go to Settings
   - Enter the invite code
   - Click "Join Household"

### Solution 3: Refresh Authentication

If session expired:

1. Refresh the page (Cmd+Shift+R or Ctrl+Shift+F5)
2. Log in again if prompted
3. Try adding items again

### Solution 4: Check Database Tables Exist

If tables don't exist in Supabase:

1. Go to Supabase Dashboard → Table Editor
2. Verify these tables exist:
   - households
   - household_members
   - shopping
   - tasks
   - clifford
   - quick_add
   - personal_tasks (optional)
   - profiles (optional, for display names)

If tables are missing, you need to create them. The app doesn't auto-create tables.

## Prevention

To avoid this issue in the future:

1. **Always check browser console** when things don't work
2. **Run test.html** periodically to verify database connectivity
3. **Keep sessions active** - the app auto-refreshes but occasionally needs manual refresh
4. **Verify RLS policies** are set up correctly in new environments

## Technical Details

### RLS Policy Structure

For household-related tables (shopping, tasks, clifford, quick_add):
- **SELECT**: User must be a household member
- **INSERT**: User must be a household member
- **UPDATE**: User must be a household member
- **DELETE**: User must be a household member

For personal_tasks table:
- **SELECT**: User can only see their own tasks (user_id = auth.uid())
- **INSERT**: User can only create their own tasks
- **UPDATE**: User can only update their own tasks
- **DELETE**: User can only delete their own tasks

### Helper Function

The RLS policies use a helper function `is_household_member()` defined in `supabase-rls-policies.sql:22-31`:

```sql
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
```

This function is called by every policy to verify membership.

## Files Reference

**Diagnostic Tools:**
- `console-test.js` - **EASIEST** - Paste into browser console for instant diagnosis
- `test-simple.html` - Interactive test page with step-by-step diagnostics
- `test.html` - Original test page (has CDN loading issues, use test-simple.html instead)
- `supabase-diagnostic.sql` - SQL queries to check database setup

**Database Setup:**
- `supabase-rls-policies.sql` - RLS policies for all household tables (REQUIRED)
- `supabase-personal-tasks.sql` - RLS policies for personal tasks
- `SUPABASE_SETUP.md` - Setup instructions

**App Code:**
- `js/database.js` - All database operations
- `js/app.js` - App initialization and data loading
- `js/auth.js` - Authentication management

## Next Steps

1. **Run the console diagnostic** (Method 1 above) - This is the fastest way!
2. **Apply the appropriate solution** based on the diagnostic results
3. **Verify the fix** by:
   - Adding an item through the app UI
   - Closing the browser tab completely
   - Reopening the app in a new tab
   - Checking if the item is still there
4. **Report back** if the issue persists with console logs
