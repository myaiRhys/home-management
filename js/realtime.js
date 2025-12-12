import { supabase, authManager } from './auth.js';
import { store } from './store.js';
import { Tables } from './config.js';
import { ui } from './ui.js';

/**
 * Realtime Subscription Manager
 *
 * ARCHITECTURE PRINCIPLE: Realtime is an ENHANCEMENT, not a requirement.
 * The app MUST work correctly with just polling (sync.js).
 * Realtime provides instant updates when the WebSocket is healthy.
 *
 * ON MOBILE/PWA:
 * - WebSocket connections are unreliable (killed on background)
 * - We DON'T try to maintain persistent connections
 * - We DON'T auto-reconnect aggressively
 * - We let syncManager handle correctness via polling
 * - Realtime is "nice to have" for instant updates when it works
 */
class RealtimeManager {
  constructor() {
    this.channels = new Map();
    this.isSubscribed = false;
    this.householdId = null;

    // Simple debounce for rapid events
    this.debounceTimers = new Map();
    this.DEBOUNCE_MS = 300;

    // Don't try to be clever with reconnection - let sync handle it
    this.enabled = true;

    // Mobile/iOS detection - these platforms kill WebSockets on background
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Connection stability tracking - only reconnect if was stable before
    this.lastStableConnection = null;
    this.connectionStableThreshold = 30000; // 30 seconds to be considered "stable"
    this.lastMessageReceived = null;
  }

  /**
   * Subscribe to all tables for a household
   * Call this once on login, don't worry about reconnection
   */
  async subscribeToHousehold(householdId) {
    if (!this.enabled) {
      console.log('[Realtime] Disabled, skipping subscription');
      return;
    }

    if (this.isSubscribed && this.householdId === householdId) {
      console.log('[Realtime] Already subscribed to this household');
      return;
    }

    // Clean up any existing subscriptions
    await this.unsubscribeAll();

    this.householdId = householdId;
    console.log(`[Realtime] Subscribing to household ${householdId}`);

    try {
      // Subscribe to each table
      this.subscribeToTable(Tables.SHOPPING, householdId);
      this.subscribeToTable(Tables.TASKS, householdId);
      this.subscribeToTable(Tables.CLIFFORD, householdId);
      this.subscribeToTable(Tables.QUICK_ADD, householdId);
      this.subscribeToTable(Tables.HOUSEHOLD_MEMBERS, householdId);
      this.subscribeToNotifications(householdId);

      this.isSubscribed = true;
      // Mark connection as stable after successful subscription
      this.lastStableConnection = Date.now();
      console.log('[Realtime] Subscriptions active');
    } catch (error) {
      console.error('[Realtime] Failed to subscribe:', error);
      // Don't throw - realtime is optional, sync will handle it
    }
  }

  /**
   * Subscribe to a single table
   */
  subscribeToTable(tableName, householdId) {
    const channelName = `${tableName}_${householdId}_${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `household_id=eq.${householdId}`
        },
        (payload) => {
          this.handleChange(tableName, payload);
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.warn(`[Realtime] ${tableName} subscription error (non-fatal):`, error.message);
        } else {
          console.log(`[Realtime] ${tableName}: ${status}`);
        }
      });

    this.channels.set(tableName, channel);
  }

  /**
   * Subscribe to notifications
   */
  subscribeToNotifications(householdId) {
    const user = authManager.getCurrentUser();
    if (!user) return;

    const channelName = `notifications_${householdId}_${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: Tables.NOTIFICATIONS,
          filter: `household_id=eq.${householdId}`
        },
        (payload) => {
          const notification = payload.new;

          // Only process if for this user or broadcast
          if (notification.to_user_id === user.id || notification.to_user_id === null) {
            // Don't show notifications from yourself
            if (notification.from_user_id !== user.id) {
              store.addNotification(notification);
              if (ui?.showToast) {
                ui.showToast(notification.message || notification.title, 'info');
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: Tables.NOTIFICATIONS,
          filter: `household_id=eq.${householdId}`
        },
        () => {
          this.debouncedReload('notifications');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: Tables.NOTIFICATIONS,
          filter: `household_id=eq.${householdId}`
        },
        (payload) => {
          store.removeNotification(payload.old.id);
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.warn('[Realtime] Notifications subscription error (non-fatal):', error.message);
        } else {
          console.log(`[Realtime] notifications: ${status}`);
        }
      });

    this.channels.set(Tables.NOTIFICATIONS, channel);
  }

  /**
   * Handle a change event from realtime
   * Triggers immediate sync for that table
   */
  handleChange(tableName, payload) {
    console.log(`[Realtime] ${tableName} ${payload.eventType}`);

    // Track last message for connection health monitoring
    this.lastMessageReceived = Date.now();
    // Update stable connection time - we're receiving data
    this.lastStableConnection = Date.now();

    // Debounce to avoid hammering on rapid changes
    this.debouncedReload(tableName);
  }

  /**
   * Debounced reload for a table
   */
  debouncedReload(tableName) {
    if (this.debounceTimers.has(tableName)) {
      clearTimeout(this.debounceTimers.get(tableName));
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(tableName);

      try {
        // Import sync manager and trigger table sync
        const { syncManager } = await import('./sync.js');
        await syncManager.syncTable(tableName);
      } catch (error) {
        console.error(`[Realtime] Error syncing ${tableName}:`, error);
      }
    }, this.DEBOUNCE_MS);

    this.debounceTimers.set(tableName, timer);
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll() {
    console.log('[Realtime] Unsubscribing from all channels');

    for (const [tableName, channel] of this.channels) {
      try {
        await supabase.removeChannel(channel);
      } catch (error) {
        console.warn(`[Realtime] Error removing ${tableName} channel:`, error.message);
      }
    }

    this.channels.clear();
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.isSubscribed = false;
    this.householdId = null;
  }

  /**
   * Reconnect all subscriptions
   * Called by connection manager, but we keep it simple
   *
   * MOBILE OPTIMIZATION: Don't fight iOS/mobile network behavior.
   * If the app is backgrounded on mobile, skip reconnection - polling will handle sync.
   */
  async reconnectAll() {
    if (!this.enabled) return;

    const household = authManager.getCurrentHousehold();
    if (!household) return;

    // On iOS/mobile, don't reconnect if app is backgrounded
    // iOS kills WebSocket connections when backgrounded - accept it, polling handles sync
    if (this.isMobile && document.hidden) {
      console.log('[Realtime] Mobile in background - skipping reconnect, polling will handle sync');
      return;
    }

    // Only reconnect if connection was stable before being interrupted
    // If connection was unstable, let polling handle sync instead
    const timeSinceStable = Date.now() - (this.lastStableConnection || 0);
    if (this.lastStableConnection && timeSinceStable < this.connectionStableThreshold) {
      console.log('[Realtime] Connection was unstable, letting polling handle sync');
      return;
    }

    console.log('[Realtime] Reconnecting...');

    // Simple: just unsubscribe and resubscribe
    await this.unsubscribeAll();

    // Small delay to let things settle
    await new Promise(resolve => setTimeout(resolve, 300));

    await this.subscribeToHousehold(household.id);
  }

  /**
   * Check if realtime connection is healthy
   * Returns false if we haven't received updates in 60 seconds
   * Used by sync manager to decide if realtime is working
   */
  isConnectionHealthy() {
    if (!this.isSubscribed || this.channels.size === 0) {
      return false;
    }
    // If we've never received a message, assume unhealthy after 30s
    if (!this.lastMessageReceived) {
      const timeSinceSubscribe = Date.now() - (this.lastStableConnection || 0);
      return timeSinceSubscribe < 30000;
    }
    // Healthy if received message in last 60 seconds
    return (Date.now() - this.lastMessageReceived) < 60000;
  }

  /**
   * Enable/disable realtime
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.unsubscribeAll();
    }
  }

  /**
   * Check if connected (best effort)
   */
  isConnected() {
    return this.isSubscribed && this.channels.size > 0;
  }
}

// Singleton instance
export const realtimeManager = new RealtimeManager();
