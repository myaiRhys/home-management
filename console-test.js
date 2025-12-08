// ============================================
// QUICK DIAGNOSTIC SCRIPT
// ============================================
// Copy this entire file and paste it into the browser console
// while you have the main app (index.html) open and logged in
//
// HOW TO USE:
// 1. Open index.html and log in
// 2. Press F12 (or Cmd+Opt+J on Mac) to open console
// 3. Copy and paste this entire file
// 4. Press Enter
// 5. Read the results
// ============================================

(async function() {
  console.log('%c=== HOME MANAGEMENT DIAGNOSTIC ===', 'color: #37C5AB; font-size: 16px; font-weight: bold');
  console.log('');

  // Check if window objects are available
  if (!window.db || !window.auth || !window.store) {
    console.error('❌ App not fully loaded. Please wait for the app to finish loading and try again.');
    return;
  }

  console.log('%c1. CHECKING AUTHENTICATION...', 'color: #E9B949; font-weight: bold');

  const user = window.auth.getCurrentUser();
  const household = window.auth.getCurrentHousehold();

  if (!user) {
    console.error('❌ Not logged in');
    console.log('%c💡 Solution: Log in first', 'color: #E9B949');
    return;
  }

  console.log('✅ Logged in as:', user.email);
  console.log('   User ID:', user.id);

  if (!household) {
    console.error('❌ No household found');
    console.log('%c💡 Solution: Go to Settings and create or join a household', 'color: #E9B949');
    return;
  }

  console.log('✅ Household:', household.name);
  console.log('   Household ID:', household.id);
  console.log('   Your role:', household.userRole);
  console.log('');

  // Check Supabase session
  console.log('%c2. CHECKING SUPABASE SESSION...', 'color: #E9B949; font-weight: bold');

  try {
    const { data: { session }, error } = await window.auth.supabase.auth.getSession();

    if (error) {
      console.error('❌ Session error:', error.message);
      console.log('%c💡 Solution: Refresh the page', 'color: #E9B949');
      return;
    }

    if (!session) {
      console.error('❌ No active Supabase session');
      console.log('%c💡 Solution: Refresh the page and log in again', 'color: #E9B949');
      return;
    }

    const expiresAt = new Date(session.expires_at * 1000);
    const timeLeft = Math.floor((expiresAt - Date.now()) / 1000 / 60);

    console.log('✅ Supabase session active');
    console.log('   Token expires in:', timeLeft, 'minutes');
    console.log('');
  } catch (err) {
    console.error('❌ Error checking session:', err);
    return;
  }

  // Test database INSERT
  console.log('%c3. TESTING DATABASE INSERT...', 'color: #E9B949; font-weight: bold');
  console.log('Adding a test item to shopping list...');

  try {
    const testName = 'DIAGNOSTIC_TEST_' + Date.now();
    const result = await window.db.addShoppingItem(testName, 'Created by diagnostic script', 1);

    if (result.error) {
      console.error('❌ INSERT FAILED:', result.error.message);
      console.error('   Error code:', result.error.code);
      console.error('   Full error:', result.error);

      if (result.error.message.includes('policy') || result.error.code === '42501') {
        console.log('');
        console.log('%c🔒 RLS POLICY ERROR!', 'color: #E16259; font-weight: bold');
        console.log('%cThis is the problem! Your database is blocking writes.', 'color: #E16259');
        console.log('');
        console.log('%c💡 SOLUTION:', 'color: #E9B949; font-weight: bold');
        console.log('1. Go to: https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Click SQL Editor in sidebar');
        console.log('4. Open the file: supabase-rls-policies.sql (in your project folder)');
        console.log('5. Copy the entire contents');
        console.log('6. Paste into SQL Editor');
        console.log('7. Click Run or press Cmd/Ctrl + Enter');
        console.log('8. Wait for "Success. No rows returned"');
        console.log('9. Refresh this page and try again');
      } else if (result.error.message.includes('JWT') || result.error.message.includes('auth')) {
        console.log('');
        console.log('%c💡 SOLUTION: Your session expired', 'color: #E9B949');
        console.log('Refresh the page and log in again');
      } else {
        console.log('');
        console.log('%c💡 SOLUTION: Unknown error', 'color: #E9B949');
        console.log('Check the error message above for clues');
      }
      return;
    }

    console.log('✅ INSERT SUCCESS! Created item:', result.data.id);
    console.log('   Name:', result.data.name);
    console.log('');

    // Try to delete the test item
    console.log('%c4. TESTING DATABASE DELETE...', 'color: #E9B949; font-weight: bold');
    console.log('Deleting test item...');

    const deleteResult = await window.db.deleteShoppingItem(result.data.id);

    if (deleteResult.error) {
      console.error('❌ DELETE FAILED:', deleteResult.error.message);
      console.log('%c⚠️ Test item was not cleaned up. You may want to delete it manually.', 'color: #E9B949');
    } else {
      console.log('✅ DELETE SUCCESS! Test item cleaned up');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    return;
  }

  // Check current data in store
  console.log('');
  console.log('%c5. CHECKING CURRENT DATA...', 'color: #E9B949; font-weight: bold');

  const shopping = window.store.getShopping();
  const tasks = window.store.getTasks();
  const clifford = window.store.getClifford();

  console.log('Shopping items:', shopping.length);
  console.log('Tasks:', tasks.length);
  console.log('Clifford items:', clifford.length);

  if (shopping.length > 0) {
    console.log('');
    console.log('Recent shopping items:');
    shopping.slice(0, 3).forEach(item => {
      console.log(`  - ${item.name} ${item.pending ? '(pending)' : ''}`);
    });
  }

  // Final summary
  console.log('');
  console.log('%c=== DIAGNOSTIC COMPLETE ===', 'color: #37C5AB; font-size: 16px; font-weight: bold');
  console.log('');
  console.log('%c✅ If all tests passed:', 'color: #37C5AB; font-weight: bold');
  console.log('Your database is configured correctly!');
  console.log('');
  console.log('%c❌ If INSERT or DELETE failed:', 'color: #E16259; font-weight: bold');
  console.log('Follow the solution steps shown above.');
  console.log('');
  console.log('%cℹ️ To test item persistence:', 'color: #6BA4E7; font-weight: bold');
  console.log('1. Add an item through the app UI');
  console.log('2. Check browser console for any errors');
  console.log('3. Close and reopen the app');
  console.log('4. Check if the item is still there');

})();
