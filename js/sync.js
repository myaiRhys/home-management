import { store } from './store.js';
import { connectionManager } from './connection.js';
import { authManager } from './auth.js';

/**
 * Sync Manager - Periodic Polling Fallback
 *
 * Supabase Realtime is great when it works, but can miss events due to:
 * - Silent WebSocket disconnections
 * - Events missed during reconnection gaps
 * - Network instability on mobile
 *
 * This manager adds a polling fallback to ensure all household members
 * stay in sync even when realtime fails silently.
 */
class SyncManager {
  constructor() {
    // Polling configuration
    this.POLL_INTERVAL_ACTIVE = 15000;    // 15 seconds when app is visible
    this.POLL_INTERVAL_BACKGROUND = 60000; // 60 seconds when backgrounded (for PWA)
    this.VISIBILITY_SYNC_DELAY = 500;      // Small delay after visibility change

    // State
    this.pollTimer = null;
    this.isPolling = false;
    this.lastSyncTime = null;
    this.syncInProgress = false;
    this.enabled = true;
    this.isPaused = false;

    // Track what's changed for smarter polling
    this.lastKnownCounts = {
      shopping: 0,
      tasks: 0,
      clifford: 0
    };

    // Listeners for sync events
    this.listeners = new Set();

    // Bind methods
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
  }

  /**
   * Initialize sync manager
   */
  initialize() {
    console.log('[Sync] Initializing sync manager');

    // Listen for visibility changes - sync immediately when app becomes visible
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Listen for online events - sync when connection restored
    window.addEventListener('online', this.handleOnline);

    // Start polling
    this.startPolling();

    // Initial sync
    this.syncNow();
  }

  /**
   * Clean up
   */
  destroy() {
    console.log('[Sync] Destroying sync manager');
    this.stopPolling();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    this.listeners.clear();
  }

  /**
   * Subscribe to sync events
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of sync status
   */
  notifyListeners(event, data = {}) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('[Sync] Listener error:', error);
      }
    });
  }

  /**
   * Start periodic polling
   */
  startPolling() {
    if (this.pollTimer || !this.enabled) return;

    const interval = document.hidden ? this.POLL_INTERVAL_BACKGROUND : this.POLL_INTERVAL_ACTIVE;
    console.log(`[Sync] Starting polling (interval: ${interval}ms)`);

    this.pollTimer = setInterval(() => {
      if (!this.isPaused && this.enabled) {
        this.syncNow();
      }
    }, interval);

    this.isPolling = true;
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
  }

  /**
   * Pause polling temporarily (e.g., during user input)
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Resume polling
   */
  resume() {
    this.isPaused = false;
  }

  /**
   * Handle visibility change - sync immediately when app becomes visible
   */
  handleVisibilityChange() {
    if (!document.hidden) {
      console.log('[Sync] App became visible - syncing immediately');

      // Restart polling with active interval
      this.stopPolling();
      this.startPolling();

      // Sync after a small delay (let other systems initialize)
      setTimeout(() => {
        this.syncNow();
      }, this.VISIBILITY_SYNC_DELAY);
    } else {
      // App went to background - use longer interval
      this.stopPolling();
      this.startPolling();
    }
  }

  /**
   * Handle online event - sync when connection restored
   */
  handleOnline() {
    console.log('[Sync] Connection restored - syncing');
    // Give the connection manager time to establish connection
    setTimeout(() => {
      this.syncNow();
    }, 1000);
  }

  /**
   * Perform sync now
   */
  async syncNow() {
    // Don't sync if already syncing, offline, or no household
    if (this.syncInProgress) {
      console.log('[Sync] Sync already in progress, skipping');
      return;
    }

    if (!connectionManager.isConnected()) {
      console.log('[Sync] Offline, skipping sync');
      return;
    }

    const household = authManager.getCurrentHousehold();
    if (!household) {
      console.log('[Sync] No household, skipping sync');
      return;
    }

    this.syncInProgress = true;
    this.notifyListeners('sync:start');

    const startTime = Date.now();
    console.log('[Sync] Starting sync...');

    try {
      // Import database manager dynamically to avoid circular dependency
      const { db } = await import('./database.js');

      // Sync all data in parallel
      const [shoppingResult, tasksResult, cliffordResult, quickAddResult] = await Promise.all([
        db.loadShopping(),
        db.loadTasks(),
        db.loadClifford(),
        db.loadQuickAdd()
      ]);

      // Track if anything changed
      let changesDetected = false;

      // Check for changes
      const newCounts = {
        shopping: store.getShopping().length,
        tasks: store.getTasks().length,
        clifford: store.getClifford().length
      };

      if (newCounts.shopping !== this.lastKnownCounts.shopping ||
          newCounts.tasks !== this.lastKnownCounts.tasks ||
          newCounts.clifford !== this.lastKnownCounts.clifford) {
        changesDetected = true;
        console.log('[Sync] Changes detected:', {
          shopping: `${this.lastKnownCounts.shopping} → ${newCounts.shopping}`,
          tasks: `${this.lastKnownCounts.tasks} → ${newCounts.tasks}`,
          clifford: `${this.lastKnownCounts.clifford} → ${newCounts.clifford}`
        });
      }

      this.lastKnownCounts = newCounts;
      this.lastSyncTime = Date.now();

      const duration = Date.now() - startTime;
      console.log(`[Sync] Sync complete (${duration}ms)${changesDetected ? ' - changes detected' : ''}`);

      this.notifyListeners('sync:complete', {
        duration,
        changesDetected,
        lastSyncTime: this.lastSyncTime
      });

    } catch (error) {
      console.error('[Sync] Sync failed:', error);
      this.notifyListeners('sync:error', { error });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Force an immediate sync (user-triggered)
   */
  async forceSync() {
    console.log('[Sync] Force sync requested');
    this.syncInProgress = false; // Reset in case stuck
    await this.syncNow();
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      isPolling: this.isPolling,
      isPaused: this.isPaused,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      timeSinceLastSync: this.lastSyncTime ? Date.now() - this.lastSyncTime : null
    };
  }

  /**
   * Enable/disable sync
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }
}

// Singleton instance
export const syncManager = new SyncManager();
