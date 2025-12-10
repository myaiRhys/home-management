import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_KEYS } from './config.js';
import { store } from './store.js';
import { connectionManager } from './connection.js';

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

/**
 * Authentication Manager
 * Handles auth state and session management
 */
class AuthManager {
  constructor() {
    this.initialized = false;
    this.sessionRefreshTimeout = null;
    this.refreshPromise = null; // Track ongoing refresh operations

    // Listen for reconnection events to refresh session
    window.addEventListener('connection:reconnect', () => this.refreshSession());
  }

  /**
   * Initialize auth state
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    console.log('[Auth] Initializing...');

    try {
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[Auth] Error getting session:', error);
        return { data: null, error };
      }

      if (session) {
        console.log('[Auth] Session found');
        await this.handleSession(session);
        connectionManager.setConnected();
      } else {
        console.log('[Auth] No session found');
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event);

        if (event === 'SIGNED_IN') {
          // Full session handling for new sign-ins
          await this.handleSession(session);
          connectionManager.setConnected();
        } else if (event === 'TOKEN_REFRESHED') {
          // Just update user, don't reload household (already have it)
          if (session?.user) {
            store.setUser(session.user);
          }
          connectionManager.setConnected();
        } else if (event === 'SIGNED_OUT') {
          this.handleSignOut();
        }
      });

      this.initialized = true;
      return { data: session, error: null };

    } catch (error) {
      console.error('[Auth] Initialize error:', error);
      return { data: null, error };
    }
  }

  /**
   * Handle session (load user data)
   */
  async handleSession(session) {
    if (!session || !session.user) {
      return;
    }

    console.log('[Auth] Handling session for user:', session.user.id);

    // Store user
    store.setUser(session.user);

    // Load user's household
    await this.loadUserHousehold(session.user.id);
  }

  /**
   * Load user's household
   */
  async loadUserHousehold(userId) {
    try {
      // Get household membership
      const { data: membership, error } = await supabase
        .from('household_members')
        .select('household_id, role, households(*)')
        .eq('user_id', userId)
        .single();

      if (error) {
        // PGRST116 = no rows returned (user not in any household)
        if (error.code === 'PGRST116') {
          console.log('[Auth] User not in any household, clearing stale data');
          store.setHousehold(null);
          localStorage.removeItem(STORAGE_KEYS.HOUSEHOLD);
        } else {
          // For other errors (network, etc.), log but don't clear
          // to allow offline use with cached data
          console.error('[Auth] Error loading household:', error);
        }
        return;
      }

      if (membership && membership.households) {
        console.log('[Auth] Loaded household:', membership.households.id);
        store.setHousehold({
          ...membership.households,
          userRole: membership.role
        });
      } else {
        // Membership exists but household join failed (shouldn't happen normally)
        console.warn('[Auth] Membership found but household data missing, clearing stale data');
        store.setHousehold(null);
        localStorage.removeItem(STORAGE_KEYS.HOUSEHOLD);
      }

    } catch (error) {
      console.error('[Auth] Error in loadUserHousehold:', error);
    }
  }

  /**
   * Handle sign out
   */
  handleSignOut() {
    console.log('[Auth] Signed out');
    store.clearUserData();
    store.setCurrentView('auth');
  }

  /**
   * Refresh session (critical for iOS backgrounding)
   * Returns a promise that resolves when refresh is complete
   */
  async refreshSession() {
    // If already refreshing, wait with timeout to prevent stale promise blocking
    if (this.refreshPromise) {
      console.log('[Auth] Refresh already in progress, waiting with timeout...');
      const timeout = new Promise(resolve => setTimeout(() => {
        console.log('[Auth] Refresh wait timeout, clearing stale promise');
        this.refreshPromise = null;
        resolve({ data: null, error: new Error('Refresh timeout - stale promise cleared') });
      }, 5000));

      const result = await Promise.race([this.refreshPromise, timeout]);
      // If we got a result from the actual promise, return it
      // If we got a timeout, the promise was cleared and we'll start fresh below
      if (result && !result.error?.message?.includes('stale promise')) {
        return result;
      }
      // Fall through to start a new refresh
    }

    console.log('[Auth] Refreshing session...');

    // Create and store the refresh promise
    this.refreshPromise = (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.refreshSession();

        if (error) {
          console.error('[Auth] Session refresh error:', error);
          return { data: null, error };
        }

        if (session) {
          console.log('[Auth] Session refreshed successfully');
          // Just update the user, don't reload household (that's done separately)
          store.setUser(session.user);
        }

        return { data: session, error: null };

      } catch (error) {
        console.error('[Auth] Session refresh failed:', error);
        return { data: null, error };
      } finally {
        // Clear the promise and dispatch completion event
        this.refreshPromise = null;
        window.dispatchEvent(new CustomEvent('auth:refreshed'));
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Sign up with email and password
   */
  async signUp(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        return { data: null, error };
      }

      return { data, error: null };

    } catch (error) {
      console.error('[Auth] Sign up error:', error);
      return { data: null, error };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { data: null, error };
      }

      return { data, error: null };

    } catch (error) {
      console.error('[Auth] Sign in error:', error);
      return { data: null, error };
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('[Auth] Sign out error:', error);
        return { error };
      }

      this.handleSignOut();
      return { error: null };

    } catch (error) {
      console.error('[Auth] Sign out failed:', error);
      return { error };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return store.getUser();
  }

  /**
   * Get current household
   */
  getCurrentHousehold() {
    return store.getHousehold();
  }

  /**
   * Get the current refresh promise (if any)
   * Used by realtime manager to coordinate reconnection
   */
  getRefreshPromise() {
    return this.refreshPromise;
  }
}

// Singleton instance
export const authManager = new AuthManager();
