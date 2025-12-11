import { ConnectionState, RECONNECT_DELAY } from './config.js';

/**
 * Connection State Machine
 * Manages network connectivity and Supabase connection state
 * Critical for iOS Safari reliability after backgrounding
 *
 * KEY PRINCIPLE: "Guilty until proven innocent"
 * Always assume disconnection after backgrounding, especially on iOS
 */
class ConnectionManager {
  constructor() {
    this.state = ConnectionState.OFFLINE;
    this.listeners = new Set();
    this.lastStateChange = Date.now();
    this.reconnectTimeout = null;

    // Background tracking (iOS Safari kills WebSockets aggressively)
    this.backgroundStartTime = null;
    this.BACKGROUND_THRESHOLD = 5000; // 5 seconds - iOS kills connections quickly
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

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
    window.addEventListener('blur', () => this.handleBlur());

    // Listen to pageshow (iOS back/forward cache)
    window.addEventListener('pageshow', (event) => this.handlePageShow(event));

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
   * GUILTY UNTIL PROVEN INNOCENT: Always assume disconnection
   */
  async handleVisibilityChange() {
    if (document.hidden) {
      // App going to background - track when
      this.backgroundStartTime = Date.now();
      console.log('[Connection] App going to background');
    } else {
      // App coming back from background
      const backgroundDuration = this.backgroundStartTime
        ? Date.now() - this.backgroundStartTime
        : 0;

      console.log(`[Connection] App became visible after ${backgroundDuration}ms in background`);

      // AGGRESSIVE: On iOS, always reconnect. On other platforms, reconnect if backgrounded for >5s
      const shouldFullReconnect = this.isIOS || backgroundDuration > this.BACKGROUND_THRESHOLD;

      if (shouldFullReconnect) {
        console.log('[Connection] Full reconnect required (iOS or long background)');
        this.setState(ConnectionState.RECONNECTING);
        // Use setTimeout to avoid blocking the UI thread
        setTimeout(() => this.attemptReconnect(), 100);
      } else {
        console.log('[Connection] Quick verification - no action needed, connection gate will verify on next operation');
        // Don't trigger anything - let connection gate verify naturally on next operation
      }

      this.backgroundStartTime = null;
    }
  }

  /**
   * Handle window blur (app losing focus)
   */
  handleBlur() {
    this.backgroundStartTime = Date.now();
    console.log('[Connection] Window blur - starting background timer');
  }

  /**
   * Handle window focus (additional trigger)
   */
  handleFocus() {
    const backgroundDuration = this.backgroundStartTime
      ? Date.now() - this.backgroundStartTime
      : 0;

    console.log(`[Connection] Window focused after ${backgroundDuration}ms`);

    if (navigator.onLine) {
      // Only reconnect if we've been disconnected or backgrounded for a long time
      if ((this.isIOS && backgroundDuration > 1000) || backgroundDuration > this.BACKGROUND_THRESHOLD || this.state === ConnectionState.OFFLINE) {
        console.log('[Connection] Reconnecting on focus after background...');
        this.setState(ConnectionState.RECONNECTING);
        // Use setTimeout to avoid blocking the UI thread
        setTimeout(() => this.attemptReconnect(), 100);
      }
    }

    this.backgroundStartTime = null;
  }

  /**
   * Handle pageshow event (iOS back/forward cache)
   * Critical for iOS Safari which uses bfcache
   */
  handlePageShow(event) {
    if (event.persisted) {
      // Page was loaded from bfcache
      console.log('[Connection] Page restored from bfcache - forcing reconnect');
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
