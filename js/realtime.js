import { supabase, authManager } from './auth.js';
import { store } from './store.js';
import { Tables, RECONNECT_DELAY } from './config.js';

/**
 * Realtime Subscription Manager
 * Manages Supabase realtime subscriptions with error recovery
 */
class RealtimeManager {
  constructor() {
    this.channels = new Map();
    this.reconnectTimeouts = new Map();
    this.isReconnecting = false;

    // Debounce timers for reload operations
    this.reloadDebounceTimers = new Map();
    this.DEBOUNCE_DELAY = 500; // ms

    // Listen for reconnection events - wait for auth to refresh first
    window.addEventListener('connection:reconnect', async () => {
      // Wait for auth session to refresh before reconnecting realtime
      // This prevents race condition where realtime tries to connect with expired token
      const refreshPromise = authManager.getRefreshPromise();
      if (refreshPromise) {
        console.log('[Realtime] Waiting for auth refresh to complete...');
        await refreshPromise;
      }
      await this.reconnectAll();

      // CRITICAL FIX: Fetch fresh data on reconnect to catch any missed updates
      // This ensures devices that were sleeping/backgrounded get the latest state
      await this.refreshAllData();
    });
  }

  /**
   * Refresh all data from the server
   * Called on reconnect to ensure we have the latest state
   */
  async refreshAllData() {
    console.log('[Realtime] Refreshing all data from server...');
    try {
      const { db } = await import('./database.js');
      await Promise.all([
        db.loadShopping(),
        db.loadTasks(),
        db.loadClifford(),
        db.loadQuickAdd(),
        db.loadHouseholdMembers()
      ]);
      console.log('[Realtime] Data refresh complete');
    } catch (error) {
      console.error('[Realtime] Error refreshing data:', error);
    }
  }

  /**
   * Debounced reload for a specific table
   * Prevents multiple rapid reloads from causing race conditions
   */
  debouncedReload(key, reloadFn) {
    // Clear existing timer
    if (this.reloadDebounceTimers.has(key)) {
      clearTimeout(this.reloadDebounceTimers.get(key));
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.reloadDebounceTimers.delete(key);
      await reloadFn();
    }, this.DEBOUNCE_DELAY);

    this.reloadDebounceTimers.set(key, timer);
  }

  /**
   * Subscribe to a table
   */
  subscribe(tableName, householdId, callback) {
    // Don't subscribe if already subscribed
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
            console.log(`[Realtime] ${tableName} change:`, payload);
            callback(payload);
          }
        )
        .subscribe((status, error) => {
          if (error) {
            console.error(`[Realtime] ${tableName} subscription error:`, error);
            this.handleSubscriptionError(tableName, householdId, callback);
          } else {
            console.log(`[Realtime] ${tableName} subscription status:`, status);
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

    // Clear reconnect timeout
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
    // Prevent multiple simultaneous reconnect attempts
    if (this.isReconnecting) {
      console.log('[Realtime] Already reconnecting, skipping...');
      return;
    }

    this.isReconnecting = true;
    console.log('[Realtime] Reconnecting all subscriptions...');

    try {
      // Unsubscribe from all
      await this.unsubscribeAll();

      // Brief wait for channel cleanup (reduced from 1000ms to 100ms)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Resubscribe based on current household
      const household = authManager.getCurrentHousehold();
      if (household) {
        console.log('[Realtime] Resubscribing to household:', household.id);
        this.subscribeToHousehold(household.id);
      } else {
        console.warn('[Realtime] No household found, cannot subscribe to realtime updates');
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Handle subscription error
   */
  handleSubscriptionError(tableName, householdId, callback) {
    console.error(`[Realtime] Error with ${tableName} subscription, will retry...`);

    // Unsubscribe first
    this.unsubscribe(tableName);

    // Schedule reconnect
    const timeout = setTimeout(() => {
      console.log(`[Realtime] Retrying ${tableName} subscription...`);
      this.subscribe(tableName, householdId, callback);
    }, RECONNECT_DELAY);

    this.reconnectTimeouts.set(tableName, timeout);
  }

  /**
   * Subscribe to all tables for a household
   */
  subscribeToHousehold(householdId) {
    console.log(`[Realtime] Subscribing to all tables for household ${householdId}`);

    // Shopping
    this.subscribe(Tables.SHOPPING, householdId, (payload) => {
      this.handleShoppingChange(payload);
    });

    // Tasks
    this.subscribe(Tables.TASKS, householdId, (payload) => {
      this.handleTasksChange(payload);
    });

    // Clifford
    this.subscribe(Tables.CLIFFORD, householdId, (payload) => {
      this.handleCliffordChange(payload);
    });

    // Quick Add
    this.subscribe(Tables.QUICK_ADD, householdId, (payload) => {
      this.handleQuickAddChange(payload);
    });

    // Household Members
    this.subscribe(Tables.HOUSEHOLD_MEMBERS, householdId, (payload) => {
      this.handleHouseholdMembersChange(payload);
    });
  }

  /**
   * Check if a record matches a temp (optimistic) item
   * Compares key fields since temp items have different IDs
   */
  isTempItemMatch(tempItem, serverRecord, compareFields = ['name', 'household_id']) {
    if (!tempItem || !serverRecord) return false;

    // Must be a temp item
    if (!tempItem.id?.toString().startsWith('temp_')) return false;

    // Compare key fields
    for (const field of compareFields) {
      if (tempItem[field] !== serverRecord[field]) return false;
    }

    // Check if created_at is within 30 seconds (allows for clock skew)
    if (tempItem.created_at && serverRecord.created_at) {
      const tempTime = new Date(tempItem.created_at).getTime();
      const serverTime = new Date(serverRecord.created_at).getTime();
      if (Math.abs(tempTime - serverTime) > 30000) return false;
    }

    return true;
  }

  /**
   * Handle shopping changes
   */
  handleShoppingChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const shopping = store.getShopping();

    switch (eventType) {
      case 'INSERT':
        // Check if this item already exists (by real ID)
        const existingById = shopping.find(item => item.id === newRecord.id);
        if (existingById) {
          // Already have this item, just update it to ensure fresh data
          store.setShopping(
            shopping.map(item => item.id === newRecord.id ? newRecord : item)
          );
          break;
        }

        // CRITICAL FIX: Check for matching temp (optimistic) item
        // This handles the race condition where realtime arrives before DB insert completes
        const tempItemIndex = shopping.findIndex(item =>
          this.isTempItemMatch(item, newRecord)
        );

        if (tempItemIndex !== -1) {
          // Found a matching temp item - replace it with the real one
          console.log('[Realtime] Replacing temp item with server record:', newRecord.id);
          const newShopping = [...shopping];
          newShopping[tempItemIndex] = newRecord;
          store.setShopping(newShopping);
        } else {
          // New item from another device - add it
          store.setShopping([newRecord, ...shopping]);
        }
        break;

      case 'UPDATE':
        // IMPROVEMENT: Timestamp-based conflict resolution
        // Only apply update if server record is newer than local
        const localItem = shopping.find(item => item.id === newRecord.id);
        if (localItem && localItem.updated_at && newRecord.updated_at) {
          const localTime = new Date(localItem.updated_at).getTime();
          const serverTime = new Date(newRecord.updated_at).getTime();
          if (localTime > serverTime) {
            console.log('[Realtime] Ignoring older update for:', newRecord.id);
            break;
          }
        }

        store.setShopping(
          shopping.map(item =>
            item.id === newRecord.id ? newRecord : item
          )
        );
        break;

      case 'DELETE':
        store.setShopping(
          shopping.filter(item => item.id !== oldRecord.id)
        );
        break;
    }
  }

  /**
   * Handle tasks changes
   */
  handleTasksChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const tasks = store.getTasks();

    switch (eventType) {
      case 'INSERT':
        // Check if this item already exists (by real ID)
        const existingById = tasks.find(task => task.id === newRecord.id);
        if (existingById) {
          store.setTasks(
            tasks.map(task => task.id === newRecord.id ? newRecord : task)
          );
          break;
        }

        // Check for matching temp (optimistic) item
        const tempItemIndex = tasks.findIndex(task =>
          this.isTempItemMatch(task, newRecord)
        );

        if (tempItemIndex !== -1) {
          console.log('[Realtime] Replacing temp task with server record:', newRecord.id);
          const newTasks = [...tasks];
          newTasks[tempItemIndex] = newRecord;
          store.setTasks(newTasks);
        } else {
          store.setTasks([newRecord, ...tasks]);
        }
        break;

      case 'UPDATE':
        // Timestamp-based conflict resolution
        const localTask = tasks.find(task => task.id === newRecord.id);
        if (localTask && localTask.updated_at && newRecord.updated_at) {
          const localTime = new Date(localTask.updated_at).getTime();
          const serverTime = new Date(newRecord.updated_at).getTime();
          if (localTime > serverTime) {
            console.log('[Realtime] Ignoring older task update for:', newRecord.id);
            break;
          }
        }

        store.setTasks(
          tasks.map(task =>
            task.id === newRecord.id ? newRecord : task
          )
        );
        break;

      case 'DELETE':
        store.setTasks(
          tasks.filter(task => task.id !== oldRecord.id)
        );
        break;
    }
  }

  /**
   * Handle clifford changes
   */
  handleCliffordChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const clifford = store.getClifford();

    switch (eventType) {
      case 'INSERT':
        // Check if this item already exists (by real ID)
        const existingById = clifford.find(item => item.id === newRecord.id);
        if (existingById) {
          store.setClifford(
            clifford.map(item => item.id === newRecord.id ? newRecord : item)
          );
          break;
        }

        // Check for matching temp (optimistic) item
        const tempItemIndex = clifford.findIndex(item =>
          this.isTempItemMatch(item, newRecord)
        );

        if (tempItemIndex !== -1) {
          console.log('[Realtime] Replacing temp clifford with server record:', newRecord.id);
          const newClifford = [...clifford];
          newClifford[tempItemIndex] = newRecord;
          store.setClifford(newClifford);
        } else {
          store.setClifford([newRecord, ...clifford]);
        }
        break;

      case 'UPDATE':
        // Timestamp-based conflict resolution
        const localItem = clifford.find(item => item.id === newRecord.id);
        if (localItem && localItem.updated_at && newRecord.updated_at) {
          const localTime = new Date(localItem.updated_at).getTime();
          const serverTime = new Date(newRecord.updated_at).getTime();
          if (localTime > serverTime) {
            console.log('[Realtime] Ignoring older clifford update for:', newRecord.id);
            break;
          }
        }

        store.setClifford(
          clifford.map(item =>
            item.id === newRecord.id ? newRecord : item
          )
        );
        break;

      case 'DELETE':
        store.setClifford(
          clifford.filter(item => item.id !== oldRecord.id)
        );
        break;
    }
  }

  /**
   * Handle quick add changes
   */
  handleQuickAddChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    const updateQuickAdd = (type) => {
      const items = store.getQuickAdd(type);

      switch (eventType) {
        case 'INSERT':
          if (!items.find(item => item.id === newRecord.id)) {
            store.setQuickAdd(type, [...items, newRecord]);
          }
          break;

        case 'UPDATE':
          store.setQuickAdd(
            type,
            items.map(item => item.id === newRecord.id ? newRecord : item)
          );
          break;

        case 'DELETE':
          store.setQuickAdd(
            type,
            items.filter(item => item.id !== oldRecord.id)
          );
          break;
      }
    };

    // Update the appropriate type
    if (newRecord) {
      updateQuickAdd(newRecord.type);
    } else if (oldRecord) {
      updateQuickAdd(oldRecord.type);
    }
  }

  /**
   * Handle household members changes
   */
  async handleHouseholdMembersChange(payload) {
    const { eventType } = payload;

    // CRITICAL FIX: Debounce member reloads to prevent race conditions
    // Multiple rapid events (e.g., bulk member changes) could cause data loss
    this.debouncedReload('household_members', async () => {
      console.log('[Realtime] Reloading household members (debounced)');
      const { db } = await import('./database.js');
      await db.loadHouseholdMembers();
    });
  }
}

// Singleton instance
export const realtimeManager = new RealtimeManager();
