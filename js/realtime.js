import { supabase, authManager } from './auth.js';
import { store } from './store.js';
import { Tables, RECONNECT_DELAY } from './config.js';

/**
 * Realtime Subscription Manager
 * SIMPLIFIED: On any change, just reload from the database
 * This ensures all household members always see the same data
 */
class RealtimeManager {
  constructor() {
    this.channels = new Map();
    this.reconnectTimeouts = new Map();
    this.isReconnecting = false;

    // Debounce timers - prevents multiple rapid reloads
    this.reloadTimers = new Map();
    this.RELOAD_DELAY = 300; // ms

    // Listen for reconnection events
    window.addEventListener('connection:reconnect', async () => {
      const refreshPromise = authManager.getRefreshPromise();
      if (refreshPromise) {
        console.log('[Realtime] Waiting for auth refresh...');
        await refreshPromise;
      }
      await this.reconnectAll();
      await this.reloadAllData();
    });
  }

  /**
   * Reload all data from the server
   */
  async reloadAllData() {
    console.log('[Realtime] Reloading all data from server...');
    try {
      const { db } = await import('./database.js');
      await Promise.all([
        db.loadShopping(),
        db.loadTasks(),
        db.loadClifford(),
        db.loadQuickAdd(),
        db.loadHouseholdMembers()
      ]);
      console.log('[Realtime] Data reload complete');
    } catch (error) {
      console.error('[Realtime] Error reloading data:', error);
    }
  }

  /**
   * Debounced reload for a specific table
   * Prevents hammering the server with rapid changes
   */
  debouncedReload(tableName, reloadFn) {
    if (this.reloadTimers.has(tableName)) {
      clearTimeout(this.reloadTimers.get(tableName));
    }

    const timer = setTimeout(async () => {
      this.reloadTimers.delete(tableName);
      try {
        await reloadFn();
      } catch (error) {
        console.error(`[Realtime] Error reloading ${tableName}:`, error);
      }
    }, this.RELOAD_DELAY);

    this.reloadTimers.set(tableName, timer);
  }

  /**
   * Subscribe to a table
   */
  subscribe(tableName, householdId, callback) {
    if (this.channels.has(tableName)) {
      console.log(`[Realtime] Already subscribed to ${tableName}`);
      return;
    }

    console.log(`[Realtime] Subscribing to ${tableName} for household ${householdId}`);

    try {
      const channel = supabase
        .channel(`${tableName}_${householdId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
            filter: `household_id=eq.${householdId}`
          },
          (payload) => {
            console.log(`[Realtime] ${tableName} change:`, payload.eventType);
            callback(payload);
          }
        )
        .subscribe((status, error) => {
          if (error) {
            console.error(`[Realtime] ${tableName} subscription error:`, error);
            this.handleSubscriptionError(tableName, householdId, callback);
          } else {
            console.log(`[Realtime] ${tableName} status:`, status);
          }
        });

      this.channels.set(tableName, channel);
    } catch (error) {
      console.error(`[Realtime] Failed to subscribe to ${tableName}:`, error);
      this.handleSubscriptionError(tableName, householdId, callback);
    }
  }

  /**
   * Unsubscribe from a table
   */
  async unsubscribe(tableName) {
    const channel = this.channels.get(tableName);
    if (channel) {
      console.log(`[Realtime] Unsubscribing from ${tableName}`);
      await supabase.removeChannel(channel);
      this.channels.delete(tableName);
    }

    const timeout = this.reconnectTimeouts.get(tableName);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(tableName);
    }
  }

  /**
   * Unsubscribe from all tables
   */
  async unsubscribeAll() {
    console.log('[Realtime] Unsubscribing from all channels');
    for (const [tableName, channel] of this.channels) {
      await supabase.removeChannel(channel);
    }
    this.channels.clear();
    this.reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
    this.reconnectTimeouts.clear();
  }

  /**
   * Reconnect all subscriptions
   */
  async reconnectAll() {
    if (this.isReconnecting) {
      console.log('[Realtime] Already reconnecting, skipping...');
      return;
    }

    this.isReconnecting = true;
    console.log('[Realtime] Reconnecting all subscriptions...');

    try {
      await this.unsubscribeAll();
      await new Promise(resolve => setTimeout(resolve, 100));

      const household = authManager.getCurrentHousehold();
      if (household) {
        console.log('[Realtime] Resubscribing to household:', household.id);
        this.subscribeToHousehold(household.id);
      } else {
        console.warn('[Realtime] No household found');
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Handle subscription error
   */
  handleSubscriptionError(tableName, householdId, callback) {
    console.error(`[Realtime] Error with ${tableName}, will retry...`);
    this.unsubscribe(tableName);

    const timeout = setTimeout(() => {
      console.log(`[Realtime] Retrying ${tableName}...`);
      this.subscribe(tableName, householdId, callback);
    }, RECONNECT_DELAY);

    this.reconnectTimeouts.set(tableName, timeout);
  }

  /**
   * Subscribe to all tables for a household
   */
  subscribeToHousehold(householdId) {
    console.log(`[Realtime] Subscribing to household ${householdId}`);

    // Shopping - on any change, reload from server
    this.subscribe(Tables.SHOPPING, householdId, () => {
      this.debouncedReload('shopping', async () => {
        const { db } = await import('./database.js');
        await db.loadShopping();
      });
    });

    // Tasks
    this.subscribe(Tables.TASKS, householdId, () => {
      this.debouncedReload('tasks', async () => {
        const { db } = await import('./database.js');
        await db.loadTasks();
      });
    });

    // Clifford
    this.subscribe(Tables.CLIFFORD, householdId, () => {
      this.debouncedReload('clifford', async () => {
        const { db } = await import('./database.js');
        await db.loadClifford();
      });
    });

    // Quick Add
    this.subscribe(Tables.QUICK_ADD, householdId, () => {
      this.debouncedReload('quick_add', async () => {
        const { db } = await import('./database.js');
        await db.loadQuickAdd();
      });
    });

    // Household Members
    this.subscribe(Tables.HOUSEHOLD_MEMBERS, householdId, () => {
      this.debouncedReload('household_members', async () => {
        const { db } = await import('./database.js');
        await db.loadHouseholdMembers();
      });
    });
  }
}

// Singleton instance
export const realtimeManager = new RealtimeManager();
