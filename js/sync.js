import { store } from './store.js';
import { connectionManager } from './connection.js';
import { authManager } from './auth.js';
import { STORAGE_KEYS } from './config.js';

/**
 * Delta Sync Manager
 *
 * ARCHITECTURE PRINCIPLES:
 * 1. Timestamp-based delta fetching (only get what changed since last sync)
 * 2. Merge, don't overwrite (preserve local optimistic updates)
 * 3. Short polling when visible, stop when backgrounded
 * 4. Full resync on visibility restore (assume stale after background)
 * 5. Realtime is OPTIONAL enhancement, not required for correctness
 */
class SyncManager {
  constructor() {
    // Polling configuration - shorter intervals for better UX
    this.POLL_INTERVAL_ACTIVE = 5000;      // 5 seconds when visible
    this.POLL_INTERVAL_IDLE = 15000;       // 15 seconds if idle but visible
    this.VISIBILITY_SYNC_DELAY = 200;      // Quick sync after visibility change
    this.IDLE_THRESHOLD = 30000;           // 30 seconds without interaction = idle

    // State
    this.pollTimer = null;
    this.isPolling = false;
    this.syncInProgress = false;
    this.enabled = true;
    this.isPaused = false;
    this.lastUserInteraction = Date.now();

    // Sync timestamps - persisted to localStorage
    this.syncState = this.loadSyncState();

    // Listeners for sync events
    this.listeners = new Set();

    // Bind methods
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleUserInteraction = this.handleUserInteraction.bind(this);
  }

  /**
   * Load persisted sync state
   */
  loadSyncState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYNC_STATE);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('[Sync] Error loading sync state:', error);
    }

    // Default state with epoch timestamps (fetch everything on first run)
    return {
      shopping: { lastSyncedAt: '1970-01-01T00:00:00.000Z', lastFullSync: null },
      tasks: { lastSyncedAt: '1970-01-01T00:00:00.000Z', lastFullSync: null },
      clifford: { lastSyncedAt: '1970-01-01T00:00:00.000Z', lastFullSync: null },
      quick_add: { lastSyncedAt: '1970-01-01T00:00:00.000Z', lastFullSync: null }
    };
  }

  /**
   * Save sync state to localStorage
   */
  saveSyncState() {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify(this.syncState));
    } catch (error) {
      console.error('[Sync] Error saving sync state:', error);
    }
  }

  /**
   * Initialize sync manager
   */
  initialize() {
    console.log('[Sync] Initializing delta sync manager');

    // Listen for visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Listen for online events
    window.addEventListener('online', this.handleOnline);

    // Track user interaction for idle detection
    ['click', 'touchstart', 'keydown', 'scroll'].forEach(event => {
      document.addEventListener(event, this.handleUserInteraction, { passive: true });
    });

    // Start polling
    this.startPolling();

    // Do a full sync on initialization
    this.fullSync();
  }

  /**
   * Clean up
   */
  destroy() {
    console.log('[Sync] Destroying sync manager');
    this.stopPolling();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    ['click', 'touchstart', 'keydown', 'scroll'].forEach(event => {
      document.removeEventListener(event, this.handleUserInteraction);
    });
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
   * Track user interaction for idle detection
   */
  handleUserInteraction() {
    this.lastUserInteraction = Date.now();
  }

  /**
   * Check if user is idle
   */
  isUserIdle() {
    return Date.now() - this.lastUserInteraction > this.IDLE_THRESHOLD;
  }

  /**
   * Get current polling interval based on activity
   */
  getCurrentInterval() {
    if (document.hidden) {
      return null; // Don't poll when backgrounded
    }
    return this.isUserIdle() ? this.POLL_INTERVAL_IDLE : this.POLL_INTERVAL_ACTIVE;
  }

  /**
   * Start periodic polling
   */
  startPolling() {
    if (this.pollTimer || !this.enabled) return;

    const interval = this.getCurrentInterval();
    if (!interval) {
      console.log('[Sync] Not starting polling (app backgrounded)');
      return;
    }

    console.log(`[Sync] Starting polling (interval: ${interval}ms)`);

    this.pollTimer = setInterval(() => {
      if (!this.isPaused && this.enabled && !document.hidden) {
        this.deltaSync();
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
   * Restart polling with new interval
   */
  restartPolling() {
    this.stopPolling();
    this.startPolling();
  }

  /**
   * Pause polling temporarily
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
   * Handle visibility change
   * CRITICAL: Always do full sync when coming back from background
   */
  handleVisibilityChange() {
    if (!document.hidden) {
      console.log('[Sync] App became visible - doing full sync');

      // Restart polling
      this.restartPolling();

      // Always do full sync after backgrounding (assume stale)
      setTimeout(() => {
        this.fullSync();
      }, this.VISIBILITY_SYNC_DELAY);
    } else {
      console.log('[Sync] App backgrounded - stopping polling');
      // Stop polling when backgrounded to save battery
      this.stopPolling();
    }
  }

  /**
   * Handle online event
   */
  handleOnline() {
    console.log('[Sync] Connection restored - doing full sync');
    setTimeout(() => {
      this.fullSync();
    }, 1000);
  }

  /**
   * Perform a DELTA sync (only fetch changed records)
   * This is the fast, frequent sync
   */
  async deltaSync() {
    if (this.syncInProgress) {
      return;
    }

    if (!connectionManager.isConnected()) {
      return;
    }

    const household = authManager.getCurrentHousehold();
    if (!household) {
      return;
    }

    this.syncInProgress = true;

    try {
      const { db } = await import('./database.js');

      // Fetch deltas for each table in parallel
      const [shoppingDelta, tasksDelta, cliffordDelta] = await Promise.all([
        db.fetchDelta('shopping', household.id, this.syncState.shopping.lastSyncedAt),
        db.fetchDelta('tasks', household.id, this.syncState.tasks.lastSyncedAt),
        db.fetchDelta('clifford', household.id, this.syncState.clifford.lastSyncedAt)
      ]);

      // Process deltas
      let changesDetected = false;

      if (shoppingDelta.updated.length > 0 || shoppingDelta.maxUpdatedAt) {
        store.mergeShopping(shoppingDelta.updated);
        if (shoppingDelta.maxUpdatedAt) {
          this.syncState.shopping.lastSyncedAt = shoppingDelta.maxUpdatedAt;
        }
        changesDetected = true;
      }

      if (tasksDelta.updated.length > 0 || tasksDelta.maxUpdatedAt) {
        store.mergeTasks(tasksDelta.updated);
        if (tasksDelta.maxUpdatedAt) {
          this.syncState.tasks.lastSyncedAt = tasksDelta.maxUpdatedAt;
        }
        changesDetected = true;
      }

      if (cliffordDelta.updated.length > 0 || cliffordDelta.maxUpdatedAt) {
        store.mergeClifford(cliffordDelta.updated);
        if (cliffordDelta.maxUpdatedAt) {
          this.syncState.clifford.lastSyncedAt = cliffordDelta.maxUpdatedAt;
        }
        changesDetected = true;
      }

      if (changesDetected) {
        this.saveSyncState();
        this.notifyListeners('sync:delta', { changesDetected: true });
      }

    } catch (error) {
      console.error('[Sync] Delta sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Perform a FULL sync (fetch all records, detect deletions)
   * This is the complete, less frequent sync
   */
  async fullSync() {
    if (this.syncInProgress) {
      console.log('[Sync] Sync already in progress, queueing full sync');
      // Queue a full sync for after current one completes
      setTimeout(() => this.fullSync(), 1000);
      return;
    }

    if (!connectionManager.isConnected()) {
      console.log('[Sync] Offline, skipping full sync');
      return;
    }

    const household = authManager.getCurrentHousehold();
    if (!household) {
      console.log('[Sync] No household, skipping full sync');
      return;
    }

    this.syncInProgress = true;
    this.notifyListeners('sync:start');

    const startTime = Date.now();
    console.log('[Sync] Starting full sync...');

    try {
      const { db } = await import('./database.js');

      // Fetch all data in parallel
      const [shoppingResult, tasksResult, cliffordResult, quickAddResult] = await Promise.all([
        db.fetchAll('shopping', household.id),
        db.fetchAll('tasks', household.id),
        db.fetchAll('clifford', household.id),
        db.loadQuickAdd()
      ]);

      // Full merge with deletion detection
      if (shoppingResult.data) {
        store.fullMergeShopping(shoppingResult.data);
        this.syncState.shopping.lastSyncedAt = this.getMaxUpdatedAt(shoppingResult.data);
        this.syncState.shopping.lastFullSync = new Date().toISOString();
      }

      if (tasksResult.data) {
        store.fullMergeTasks(tasksResult.data);
        this.syncState.tasks.lastSyncedAt = this.getMaxUpdatedAt(tasksResult.data);
        this.syncState.tasks.lastFullSync = new Date().toISOString();
      }

      if (cliffordResult.data) {
        store.fullMergeClifford(cliffordResult.data);
        this.syncState.clifford.lastSyncedAt = this.getMaxUpdatedAt(cliffordResult.data);
        this.syncState.clifford.lastFullSync = new Date().toISOString();
      }

      this.saveSyncState();

      const duration = Date.now() - startTime;
      console.log(`[Sync] Full sync complete (${duration}ms)`);

      this.notifyListeners('sync:complete', {
        duration,
        type: 'full',
        lastSyncTime: Date.now()
      });

    } catch (error) {
      console.error('[Sync] Full sync failed:', error);
      this.notifyListeners('sync:error', { error });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get max updated_at from array of items
   */
  getMaxUpdatedAt(items) {
    if (!items || items.length === 0) {
      return new Date().toISOString();
    }

    let max = '1970-01-01T00:00:00.000Z';
    for (const item of items) {
      const updatedAt = item.updated_at || item.created_at;
      if (updatedAt && updatedAt > max) {
        max = updatedAt;
      }
    }
    return max;
  }

  /**
   * Force an immediate full sync (user-triggered)
   */
  async forceSync() {
    console.log('[Sync] Force sync requested');
    this.syncInProgress = false; // Reset in case stuck
    await this.fullSync();
  }

  /**
   * Sync a specific table immediately (after local change)
   */
  async syncTable(tableName) {
    const household = authManager.getCurrentHousehold();
    if (!household) return;

    try {
      const { db } = await import('./database.js');
      const result = await db.fetchAll(tableName, household.id);

      if (result.data) {
        switch (tableName) {
          case 'shopping':
            store.fullMergeShopping(result.data);
            break;
          case 'tasks':
            store.fullMergeTasks(result.data);
            break;
          case 'clifford':
            store.fullMergeClifford(result.data);
            break;
        }
      }
    } catch (error) {
      console.error(`[Sync] Failed to sync ${tableName}:`, error);
    }
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
      syncState: this.syncState,
      isIdle: this.isUserIdle()
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

  /**
   * Reset sync state (force full refresh)
   */
  resetSyncState() {
    this.syncState = {
      shopping: { lastSyncedAt: '1970-01-01T00:00:00.000Z', lastFullSync: null },
      tasks: { lastSyncedAt: '1970-01-01T00:00:00.000Z', lastFullSync: null },
      clifford: { lastSyncedAt: '1970-01-01T00:00:00.000Z', lastFullSync: null },
      quick_add: { lastSyncedAt: '1970-01-01T00:00:00.000Z', lastFullSync: null }
    };
    this.saveSyncState();
  }
}

// Singleton instance
export const syncManager = new SyncManager();
