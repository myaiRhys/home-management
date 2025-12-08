# 🔍 Quick Diagnostic Guide

## Problem: Items not persisting after closing/reopening the app?

Use this **5-minute diagnostic** to find and fix the issue.

---

## ⚡ FASTEST METHOD (Console Script)

1. **Open your app** (index.html) and **log in**
2. Press **F12** (Windows/Linux) or **Cmd+Opt+J** (Mac) to open console
3. Open the file **`console-test.js`** in a text editor
4. **Copy everything** from that file
5. **Paste into the browser console** and press Enter
6. **Read the results** - it will tell you exactly what's wrong!

### What the console script checks:
- ✓ Authentication status
- ✓ Household membership
- ✓ Database write permissions (INSERT/DELETE)
- ✓ Current data in your app

### Expected results:
- **If all tests pass (✅)**: Your database is working! Check browser console when adding items to see other errors.
- **If INSERT fails with "policy error"**: You need to set up RLS policies (see Solution 1 below)
- **If "not a member of household"**: Create or join a household (see Solution 2 below)

---

## 📄 ALTERNATIVE METHOD (Test Page)

If you prefer clicking buttons instead of console:

1. **Open your app** (index.html) and **log in**
2. Open **`test-simple.html`** in a new browser tab
3. Click the three test buttons in order
4. Follow the instructions shown

---

## 🔧 Common Solutions

### Solution 1: Set Up RLS Policies (Most Common Fix)

**If you see: "policy error" or "permission denied"**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open the file **`supabase-rls-policies.sql`** from your project folder
6. **Copy the entire contents**
7. **Paste into SQL Editor**
8. Click **Run** (or press Cmd+Enter / Ctrl+Enter)
9. Wait for "Success. No rows returned"
10. **Refresh your app** and test again

### Solution 2: Create/Join a Household

**If you see: "not a member of any household"**

**To create a new household:**
1. Open the app
2. Go to **Settings** (⚙️ tab)
3. Enter a household name
4. Click **"Create Household"**

**To join an existing household:**
1. Get an invite code from another household member
2. Go to **Settings** (⚙️ tab)
3. Enter the invite code
4. Click **"Join Household"**

### Solution 3: Refresh Authentication

**If you see: "session expired" or "JWT error"**

1. Close all browser tabs with the app
2. Reopen the app
3. Log in again
4. Try adding items

---

## 📊 Understanding the Results

### ✅ All tests pass but items still disappear?

Check these:
1. Open browser console (F12) when adding items
2. Look for red error messages
3. Check your internet connection
4. Try in incognito/private mode to rule out extensions

### ❌ Tests fail with database errors?

The diagnostic will show you:
- Exact error message
- Error code
- Step-by-step solution

### ⚠️ Other issues?

See `PERSISTENCE_ISSUE_ANALYSIS.md` for detailed technical analysis.

---

## 📝 Files Overview

**Diagnostic Tools** (use these first):
- `console-test.js` ← **START HERE**
- `test-simple.html` ← Alternative if you prefer a UI
- `DIAGNOSTIC_QUICKSTART.md` ← You are here!

**Setup Scripts** (run these in Supabase if tests fail):
- `supabase-rls-policies.sql` ← Fix permission errors
- `supabase-personal-tasks.sql` ← If you use personal tasks

**Documentation:**
- `PERSISTENCE_ISSUE_ANALYSIS.md` ← Full technical analysis
- `SUPABASE_SETUP.md` ← General setup instructions

---

## 💡 Quick Tips

- Always test with browser console open (F12) to see errors in real-time
- The app uses "optimistic updates" - items appear to save even when they fail
- Most persistence issues are caused by missing RLS policies
- If unsure, just run the console diagnostic - it's fast and tells you everything!

---

## 🆘 Still Having Issues?

1. Run the console diagnostic script
2. Copy the entire console output
3. Share it along with:
   - What you were trying to do
   - What happened vs. what you expected
   - Any error messages you see
