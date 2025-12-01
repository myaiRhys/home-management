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

    // Listen for reconnection events
    window.addEventListener('connection:reconnect', () => this.reconnectAll());
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
    console.log('[Realtime] Reconnecting all subscriptions...');

    // Unsubscribe from all
    await this.unsubscribeAll();

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));

    // Resubscribe based on current household
    const household = authManager.getCurrentHousehold();
    if (household) {
      this.subscribeToHousehold(household.id);
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
   * Handle shopping changes
   */
  handleShoppingChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const shopping = store.getShopping();

    switch (eventType) {
      case 'INSERT':
        // Add if not already present (avoid duplicates from optimistic updates)
        if (!shopping.find(item => item.id === newRecord.id)) {
          store.setShopping([newRecord, ...shopping]);
        }
        break;

      case 'UPDATE':
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
        if (!tasks.find(task => task.id === newRecord.id)) {
          store.setTasks([newRecord, ...tasks]);
        }
        break;

      case 'UPDATE':
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
        if (!clifford.find(item => item.id === newRecord.id)) {
          store.setClifford([newRecord, ...clifford]);
        }
        break;

      case 'UPDATE':
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
  handleHouseholdMembersChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const members = store.getState().householdMembers;

    switch (eventType) {
      case 'INSERT':
        if (!members.find(member => member.id === newRecord.id)) {
          store.setHouseholdMembers([...members, newRecord]);
        }
        break;

      case 'DELETE':
        store.setHouseholdMembers(
          members.filter(member => member.id !== oldRecord.id)
        );
        break;
    }
  }
}

// Singleton instance
export const realtimeManager = new RealtimeManager();
