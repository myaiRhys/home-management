/**
 * BROWSER CONSOLE DIAGNOSTIC SCRIPT
 * Copy and paste this entire script into the browser console while on the app
 */

console.log('%c🔍 THIBAULT APP DIAGNOSTIC TOOL', 'background: #37C5AB; color: white; font-size: 16px; padding: 10px;');

// Test 1: Check Store
console.log('\n%c=== TEST 1: STORE ===', 'color: #529CCA; font-weight: bold');
if (window.store) {
  console.log('✅ window.store exists');
  const state = window.store.getState();
  console.log('Current state:', state);
  console.log('  - Current view:', state.currentView);
  console.log('  - User:', state.user?.email);
  console.log('  - Household:', state.household?.name);
} else {
  console.error('❌ window.store NOT FOUND');
}

// Test 2: Check UI
console.log('\n%c=== TEST 2: UI ELEMENTS ===', 'color: #529CCA; font-weight: bold');
const app = document.getElementById('app');
if (app) {
  console.log('✅ #app element exists');
} else {
  console.error('❌ #app element NOT FOUND');
}

const bottomNav = document.querySelector('.bottom-nav');
if (bottomNav) {
  console.log('✅ .bottom-nav exists');

  const tabs = document.querySelectorAll('.nav-tab');
  console.log(`Found ${tabs.length} navigation tabs:`);
  tabs.forEach((tab, i) => {
    console.log(`  ${i + 1}. ${tab.dataset.view} - action: ${tab.dataset.action}, active: ${tab.classList.contains('active')}`);
  });
} else {
  console.error('❌ .bottom-nav NOT FOUND');
}

// Test 3: Check Settings Tab
console.log('\n%c=== TEST 3: SETTINGS TAB ===', 'color: #529CCA; font-weight: bold');
const settingsTab = document.querySelector('[data-view="settings"]');
if (settingsTab) {
  console.log('✅ Settings tab found');
  console.log('  - data-action:', settingsTab.dataset.action);
  console.log('  - data-view:', settingsTab.dataset.view);
  console.log('  - classList:', settingsTab.classList.toString());
  console.log('  - Computed style display:', window.getComputedStyle(settingsTab).display);
  console.log('  - Computed style pointer-events:', window.getComputedStyle(settingsTab).pointerEvents);

  // Check for any overlays
  const overlays = document.querySelectorAll('.modal-overlay, [style*="z-index"]');
  if (overlays.length > 0) {
    console.warn(`⚠️  Found ${overlays.length} potential overlay elements that might block clicks:`);
    overlays.forEach((overlay, i) => {
      console.log(`    ${i + 1}.`, overlay);
      console.log('       z-index:', window.getComputedStyle(overlay).zIndex);
      console.log('       display:', window.getComputedStyle(overlay).display);
    });
  }
} else {
  console.error('❌ Settings tab NOT FOUND');
}

// Test 4: Event Listeners
console.log('\n%c=== TEST 4: EVENT LISTENERS ===', 'color: #529CCA; font-weight: bold');
let clickCount = 0;
const testClick = () => {
  clickCount++;
  console.log(`Click event ${clickCount} captured!`);
};

document.addEventListener('click', testClick);
console.log('✅ Added test click listener');
console.log('👆 Now click anywhere on the page...');

setTimeout(() => {
  document.removeEventListener('click', testClick);
  console.log(`✅ Captured ${clickCount} clicks in the last 5 seconds`);
  if (clickCount === 0) {
    console.error('❌ NO CLICKS DETECTED - Event listeners may not be working!');
  }
}, 5000);

// Test 5: Manual Navigation Test
console.log('\n%c=== TEST 5: MANUAL NAVIGATION ===', 'color: #529CCA; font-weight: bold');
if (window.store) {
  console.log('Testing programmatic navigation to settings...');
  const oldView = window.store.getCurrentView();
  console.log('Current view:', oldView);

  window.store.setCurrentView('settings');

  setTimeout(() => {
    const newView = window.store.getCurrentView();
    console.log('View after setCurrentView("settings"):', newView);

    if (newView === 'settings') {
      console.log('✅ Programmatic navigation WORKS');
      console.log('   This means the issue is with the click handler, not the navigation logic');
    } else {
      console.error('❌ Programmatic navigation FAILED');
      console.error('   The store.setCurrentView() is not working');
    }

    // Restore old view
    window.store.setCurrentView(oldView);
  }, 100);
}

// Test 6: Click Simulation
console.log('\n%c=== TEST 6: SIMULATED CLICK ===', 'color: #529CCA; font-weight: bold');
setTimeout(() => {
  if (settingsTab) {
    console.log('Simulating click on settings tab...');
    const beforeView = window.store?.getCurrentView();
    console.log('View before click:', beforeView);

    settingsTab.click();

    setTimeout(() => {
      const afterView = window.store?.getCurrentView();
      console.log('View after click:', afterView);

      if (afterView === 'settings') {
        console.log('✅ Simulated click WORKS!');
        console.log('   The button click handling works programmatically');
      } else {
        console.error('❌ Simulated click FAILED!');
        console.error('   The click handler is not responding');

        // Additional debugging
        console.log('Checking handleClick function...');
        const handlers = [];
        document.addEventListener('click', (e) => {
          console.log('Click event:', e.target);
          console.log('Closest [data-action]:', e.target.closest('[data-action]'));
        });
      }
    }, 200);
  }
}, 6000);

// Helper functions
console.log('\n%c=== HELPER FUNCTIONS ===', 'color: #37C5AB; font-weight: bold');
console.log('Available helper functions:');
console.log('  - testSettingsClick(): Test clicking the settings tab');
console.log('  - checkOverlays(): Check for blocking overlays');
console.log('  - debugNavigation(): Debug navigation system');

window.testSettingsClick = () => {
  const tab = document.querySelector('[data-view="settings"]');
  if (tab) {
    console.log('Clicking settings tab...');
    console.log('Before:', window.store.getCurrentView());
    tab.click();
    setTimeout(() => {
      console.log('After:', window.store.getCurrentView());
    }, 100);
  } else {
    console.error('Settings tab not found');
  }
};

window.checkOverlays = () => {
  const allElements = document.querySelectorAll('*');
  const highZIndex = [];

  allElements.forEach(el => {
    const zIndex = parseInt(window.getComputedStyle(el).zIndex);
    if (zIndex > 100) {
      const rect = el.getBoundingClientRect();
      highZIndex.push({
        element: el,
        zIndex: zIndex,
        visible: window.getComputedStyle(el).display !== 'none',
        bounds: rect
      });
    }
  });

  console.log('Elements with high z-index:', highZIndex);
  return highZIndex;
};

window.debugNavigation = () => {
  console.log('Navigation Debug:');
  console.log('  Current view:', window.store?.getCurrentView());
  console.log('  Store state:', window.store?.getState());

  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    const rect = tab.getBoundingClientRect();
    console.log(`  Tab "${tab.dataset.view}":`, {
      visible: rect.height > 0 && rect.width > 0,
      position: `(${rect.top}, ${rect.left})`,
      size: `${rect.width}x${rect.height}`,
      action: tab.dataset.action
    });
  });
};

console.log('\n%c✅ DIAGNOSTIC SCRIPT LOADED', 'background: #37C5AB; color: white; font-size: 14px; padding: 5px;');
console.log('Watch the console output above for test results...');
