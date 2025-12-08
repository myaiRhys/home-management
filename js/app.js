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
    this.pullToRefresh = {
      startY: 0,
      currentY: 0,
      isDragging: false,
      threshold: 80
    };
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

      // Setup pull-to-refresh
      this.setupPullToRefresh();

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
      db.loadPersonalTasks(),
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
        const registration = await navigator.serviceWorker.register('./sw.js');
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

  /**
   * Setup pull-to-refresh functionality
   */
  setupPullToRefresh() {
    console.log('[App] Setting up pull-to-refresh...');

    const appContent = document.getElementById('app-content');
    const indicator = document.getElementById('pull-indicator');

    if (!appContent || !indicator) {
      console.log('[App] Pull-to-refresh elements not found, retrying in 100ms');
      setTimeout(() => this.setupPullToRefresh(), 100);
      return;
    }

    // Touch start
    appContent.addEventListener('touchstart', (e) => {
      // Only trigger if scrolled to top
      if (appContent.scrollTop === 0) {
        this.pullToRefresh.startY = e.touches[0].clientY;
        this.pullToRefresh.isDragging = true;
      }
    });

    // Touch move
    appContent.addEventListener('touchmove', (e) => {
      if (!this.pullToRefresh.isDragging) return;

      this.pullToRefresh.currentY = e.touches[0].clientY;
      const pullDistance = this.pullToRefresh.currentY - this.pullToRefresh.startY;

      // Show indicator when pulling down
      if (pullDistance > 0 && appContent.scrollTop === 0) {
        indicator.classList.add('visible');
      } else {
        indicator.classList.remove('visible');
      }
    });

    // Touch end
    appContent.addEventListener('touchend', async (e) => {
      if (!this.pullToRefresh.isDragging) return;

      const pullDistance = this.pullToRefresh.currentY - this.pullToRefresh.startY;

      // Trigger refresh if pulled beyond threshold
      if (pullDistance > this.pullToRefresh.threshold && appContent.scrollTop === 0) {
        console.log('[App] Pull-to-refresh triggered');

        // Vibrate if supported
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        // Refresh data
        await authManager.refreshSession();
        await queueManager.processQueue();
        await this.reload();
      }

      // Reset
      this.pullToRefresh.isDragging = false;
      this.pullToRefresh.startY = 0;
      this.pullToRefresh.currentY = 0;
      indicator.classList.remove('visible');
    });

    console.log('[App] Pull-to-refresh setup complete');
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

// Listen for database error events and show toast notifications
window.addEventListener('db:error', (event) => {
  const { message, details } = event.detail;
  console.error('[App] Database error:', message, details);
  ui.showToast(message, 'error');
});

// Listen for database success events
window.addEventListener('db:success', (event) => {
  const { message } = event.detail;
  ui.showToast(message, 'success');
});

// Export for debugging
window.app = app;
window.store = store;
window.db = db;
window.auth = authManager;
