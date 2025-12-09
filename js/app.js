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
      isRefreshing: false,
      threshold: 60,
      maxPull: 120
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
   * Switch to a new household (called after joining/creating)
   * Loads data and sets up realtime subscriptions
   */
  async switchHousehold(householdId) {
    console.log('[App] Switching to household:', householdId);

    try {
      // Reconnect realtime subscriptions for the new household
      // This unsubscribes from old channels and subscribes to new ones
      await realtimeManager.reconnectAll();

      // Load all data for the new household
      await this.loadData(householdId);

      // Process any queued operations
      queueManager.processQueue();

      console.log('[App] Switched to household successfully');
    } catch (error) {
      console.error('[App] Error switching household:', error);
      ui.showToast('Error loading household data', 'error');
    }
  }

  /**
   * Setup pull-to-refresh functionality
   */
  setupPullToRefresh() {
    console.log('[App] Setting up pull-to-refresh...');

    const appContent = document.getElementById('app-content');
    const indicator = document.getElementById('pull-indicator');
    const pullText = document.getElementById('pull-text');

    if (!appContent || !indicator || !pullText) {
      console.log('[App] Pull-to-refresh elements not found, retrying in 100ms');
      setTimeout(() => this.setupPullToRefresh(), 100);
      return;
    }

    const updateIndicatorState = (state, text) => {
      indicator.classList.remove('pulling', 'ready', 'refreshing');
      if (state) {
        indicator.classList.add(state);
      }
      if (text) {
        pullText.textContent = text;
      }
    };

    // Touch start
    appContent.addEventListener('touchstart', (e) => {
      // Don't trigger if already refreshing or not at top
      if (this.pullToRefresh.isRefreshing) return;
      if (appContent.scrollTop <= 0) {
        this.pullToRefresh.startY = e.touches[0].clientY;
        this.pullToRefresh.isDragging = true;
      }
    }, { passive: true });

    // Touch move
    appContent.addEventListener('touchmove', (e) => {
      if (!this.pullToRefresh.isDragging || this.pullToRefresh.isRefreshing) return;

      this.pullToRefresh.currentY = e.touches[0].clientY;
      const pullDistance = this.pullToRefresh.currentY - this.pullToRefresh.startY;

      // Only show indicator when pulling down from top
      if (pullDistance > 10 && appContent.scrollTop <= 0) {
        const progress = Math.min(pullDistance / this.pullToRefresh.maxPull, 1);

        if (pullDistance >= this.pullToRefresh.threshold) {
          updateIndicatorState('ready', ui.t('releaseToRefresh'));
        } else {
          updateIndicatorState('pulling', ui.t('pullToRefresh'));
        }

        // Apply transform based on pull distance
        indicator.style.transform = `translateX(-50%) translateY(${Math.min(pullDistance * 0.5, 40)}px)`;
        indicator.style.opacity = Math.min(progress * 1.5, 1);
      } else {
        updateIndicatorState(null);
        indicator.style.transform = '';
        indicator.style.opacity = '';
      }
    }, { passive: true });

    // Touch end
    appContent.addEventListener('touchend', async () => {
      if (!this.pullToRefresh.isDragging || this.pullToRefresh.isRefreshing) return;

      const pullDistance = this.pullToRefresh.currentY - this.pullToRefresh.startY;

      // Trigger refresh if pulled beyond threshold
      if (pullDistance >= this.pullToRefresh.threshold && appContent.scrollTop <= 0) {
        console.log('[App] Pull-to-refresh triggered');

        // Set refreshing state
        this.pullToRefresh.isRefreshing = true;
        updateIndicatorState('refreshing', ui.t('refreshing'));
        indicator.style.transform = 'translateX(-50%) translateY(20px)';
        indicator.style.opacity = '1';

        // Vibrate if supported
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        try {
          // Full refresh: session, realtime, queue, and data
          await authManager.refreshSession();
          await realtimeManager.reconnectAll();
          await queueManager.processQueue();
          await this.reload();

          updateIndicatorState('refreshing', ui.t('refreshDone'));

          // Brief delay to show success
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('[App] Pull-to-refresh error:', error);
          ui.showToast('Refresh failed', 'error');
        }
      }

      // Reset
      this.pullToRefresh.isDragging = false;
      this.pullToRefresh.isRefreshing = false;
      this.pullToRefresh.startY = 0;
      this.pullToRefresh.currentY = 0;
      updateIndicatorState(null, ui.t('pullToRefresh'));
      indicator.style.transform = '';
      indicator.style.opacity = '';
    });

    // Touch cancel
    appContent.addEventListener('touchcancel', () => {
      if (this.pullToRefresh.isRefreshing) return;

      this.pullToRefresh.isDragging = false;
      this.pullToRefresh.startY = 0;
      this.pullToRefresh.currentY = 0;
      updateIndicatorState(null, ui.t('pullToRefresh'));
      indicator.style.transform = '';
      indicator.style.opacity = '';
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
