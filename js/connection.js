import { ConnectionState, RECONNECT_DELAY } from './config.js';

/**
 * Connection State Machine
 * Manages network connectivity and Supabase connection state
 * Critical for iOS Safari reliability after backgrounding
 */
class ConnectionManager {
  constructor() {
    this.state = ConnectionState.OFFLINE;
    this.listeners = new Set();
    this.lastStateChange = Date.now();
    this.reconnectTimeout = null;

    // Initialize
    this.initialize();
  }

  initialize() {
    // Check initial online status
    this.state = navigator.onLine ? ConnectionState.CONNECTED : ConnectionState.OFFLINE;

    // Listen to online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Listen to visibility changes (critical for iOS backgrounding)
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

    // Listen to page focus/blur
    window.addEventListener('focus', () => this.handleFocus());

    this.notifyListeners();
  }

  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if we're connected
   */
  isConnected() {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Check if we're offline
   */
  isOffline() {
    return this.state === ConnectionState.OFFLINE;
  }

  /**
   * Subscribe to connection state changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    // Immediately notify of current state
    callback(this.state);

    // Return unsubscribe function
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  /**
   * Set connection state and notify listeners
   */
  setState(newState) {
    if (this.state !== newState) {
      console.log(`[Connection] ${this.state} → ${newState}`);
      this.state = newState;
      this.lastStateChange = Date.now();
      this.notifyListeners();
    }
  }

  /**
   * Handle online event
   */
  handleOnline() {
    console.log('[Connection] Browser online event');
    this.setState(ConnectionState.RECONNECTING);
    this.attemptReconnect();
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    console.log('[Connection] Browser offline event');
    this.setState(ConnectionState.OFFLINE);
  }

  /**
   * Handle visibility change (critical for iOS)
   * When app comes back from background, we need to reconnect
   */
  async handleVisibilityChange() {
    if (!document.hidden) {
      console.log('[Connection] App became visible, reconnecting...');

      // Don't wait for reconnect to complete - do it in background
      this.setState(ConnectionState.RECONNECTING);
      this.attemptReconnect();
    }
  }

  /**
   * Handle window focus (additional trigger)
   */
  handleFocus() {
    if (navigator.onLine && this.state !== ConnectionState.CONNECTED) {
      console.log('[Connection] Window focused, reconnecting...');
      this.setState(ConnectionState.RECONNECTING);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect
   * This will trigger auth session refresh and queue processing
   */
  async attemptReconnect() {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (!navigator.onLine) {
      this.setState(ConnectionState.OFFLINE);
      return;
    }

    try {
      // Simple connectivity check
      const response = await fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        cache: 'no-cache'
      });

      // If we got here, we have connectivity
      this.setState(ConnectionState.CONNECTED);

      // Trigger reconnection event for auth and realtime
      window.dispatchEvent(new CustomEvent('connection:reconnect'));

    } catch (error) {
      console.error('[Connection] Reconnect failed:', error);
      this.setState(ConnectionState.OFFLINE);

      // Retry after delay
      this.reconnectTimeout = setTimeout(() => {
        this.attemptReconnect();
      }, RECONNECT_DELAY);
    }
  }

  /**
   * Force a reconnection attempt
   */
  forceReconnect() {
    console.log('[Connection] Forcing reconnect...');
    this.setState(ConnectionState.RECONNECTING);
    this.attemptReconnect();
  }

  /**
   * Manually set connected state (called after successful auth)
   */
  setConnected() {
    this.setState(ConnectionState.CONNECTED);
  }

  /**
   * Manually set offline state
   */
  setOffline() {
    this.setState(ConnectionState.OFFLINE);
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
