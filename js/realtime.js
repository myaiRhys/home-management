import { db } from './auth.js';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { store } from './store.js';
import { Tables } from './config.js';

/**
 * Realtime Subscription Manager
 * Manages Firestore realtime subscriptions with onSnapshot
 */
class RealtimeManager {
  constructor() {
    this.unsubscribers = new Map();
  }

  /**
   * Subscribe to all tables for a household
   */
  subscribeToHousehold(householdId) {
    console.log(`[Realtime] Subscribing to all tables for household ${householdId}`);

    // Shopping
    this.subscribeToCollection(Tables.SHOPPING, householdId, (items) => {
      store.setShopping(items);
    });

    // Tasks
    this.subscribeToCollection(Tables.TASKS, householdId, (items) => {
      store.setTasks(items);
    });

    // Clifford
    this.subscribeToCollection(Tables.CLIFFORD, householdId, (items) => {
      store.setClifford(items);
    });

    // Quick Add
    this.subscribeToCollection(Tables.QUICK_ADD, householdId, (items) => {
      // Group by type
      const shopping = items.filter(item => item.type === 'shopping');
      const tasks = items.filter(item => item.type === 'tasks');
      const clifford = items.filter(item => item.type === 'clifford');

      store.setQuickAdd('shopping', shopping);
      store.setQuickAdd('tasks', tasks);
      store.setQuickAdd('clifford', clifford);
    });

    // Household Members
    this.subscribeToCollection(Tables.HOUSEHOLD_MEMBERS, householdId, async (members) => {
      // Import db manager to handle member updates
      const { db: dbManager } = await import('./database.js');
      await dbManager.loadHouseholdMembers();
    });
  }

  /**
   * Subscribe to a collection with realtime updates
   */
  subscribeToCollection(collectionName, householdId, callback) {
    // Don't subscribe if already subscribed
    if (this.unsubscribers.has(collectionName)) {
      console.log(`[Realtime] Already subscribed to ${collectionName}`);
      return;
    }

    console.log(`[Realtime] Subscribing to ${collectionName}`);

    try {
      const q = query(
        collection(db, collectionName),
        where('household_id', '==', householdId),
        orderBy('created_at', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          console.log(`[Realtime] ${collectionName} update:`, snapshot.docs.length, 'items');

          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          callback(items);
        },
        (error) => {
          console.error(`[Realtime] ${collectionName} subscription error:`, error);

          // Firestore automatically reconnects, so we don't need manual retry logic
          // Just log the error and let Firestore handle it
        }
      );

      this.unsubscribers.set(collectionName, unsubscribe);

    } catch (error) {
      console.error(`[Realtime] Failed to subscribe to ${collectionName}:`, error);
    }
  }

  /**
   * Unsubscribe from all collections
   */
  unsubscribeAll() {
    console.log('[Realtime] Unsubscribing from all collections');

    this.unsubscribers.forEach((unsubscribe, collectionName) => {
      console.log(`[Realtime] Unsubscribing from ${collectionName}`);
      unsubscribe();
    });

    this.unsubscribers.clear();
  }
}

// Singleton instance
export const realtimeManager = new RealtimeManager();
