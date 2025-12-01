import { authManager } from './auth.js';
import { db } from './database.js';
import { realtimeManager } from './realtime.js';
import { queueManager } from './queue.js';
import { connectionManager } from './connection.js';
import { store } from './store.js';
import { ui } from './ui.js';

/**
 * Main App
 * Entry point and initialization
 */
class App {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the app
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    console.log('[App] Initializing...');

    try {
      // Show loading state
      store.setLoading(true);

      // Initialize UI first (to show splash screen)
      ui.initialize();

      // Initialize auth
      await authManager.initialize();

      // Check if we have a user and household
      const user = authManager.getCurrentUser();
      const household = authManager.getCurrentHousehold();

      if (user && household) {
        // Load all data
        await this.loadData(household.id);

        // Subscribe to realtime updates
        realtimeManager.subscribeToHousehold(household.id);

        // Process any queued operations
        queueManager.processQueue();

        // Set initial view
        store.setCurrentView('dashboard');
      } else {
        // Show auth screen
        store.setCurrentView('auth');
      }

      // Hide loading
      store.setLoading(false);

      // Register service worker
      this.registerServiceWorker();

      this.initialized = true;
      console.log('[App] Initialized successfully');

    } catch (error) {
      console.error('[App] Initialization error:', error);
      store.setLoading(false);
      ui.showToast('Failed to initialize app', 'error');
    }
  }

  /**
   * Load all data for household
   */
  async loadData(householdId) {
    console.log('[App] Loading data for household:', householdId);

    // Load in parallel
    await Promise.all([
      db.loadShopping(),
      db.loadTasks(),
      db.loadClifford(),
      db.loadQuickAdd(),
      db.loadHouseholdMembers()
    ]);

    console.log('[App] Data loaded');
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[App] Service worker registered:', registration);
      } catch (error) {
        console.error('[App] Service worker registration failed:', error);
      }
    }
  }

  /**
   * Reload data (called after reconnection)
   */
  async reload() {
    const household = authManager.getCurrentHousehold();
    if (household) {
      await this.loadData(household.id);
      ui.showToast('Data refreshed', 'success');
    }
  }
}

// Create app instance
const app = new App();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
  app.initialize();
}

// Listen for connection events and reload data
window.addEventListener('connection:reconnect', async () => {
  console.log('[App] Reconnection detected, refreshing data...');

  // Refresh auth session first
  await authManager.refreshSession();

  // Process queue
  await queueManager.processQueue();

  // Reload data
  await app.reload();
});

// Export for debugging
window.app = app;
window.store = store;
window.db = db;
window.auth = authManager;
