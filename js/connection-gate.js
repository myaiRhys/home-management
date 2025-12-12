import { supabase, authManager } from './auth.js';
import { DB_OPERATION_TIMEOUT } from './config.js';

/**
 * Connection Gate - SIMPLIFIED
 *
 * ARCHITECTURE CHANGE: We now trust the queue system to handle failures.
 * This gate does a quick single-attempt check, then lets operations through.
 * If they fail, the queue system will retry them later.
 *
 * OLD: Block operations until connection verified, retry multiple times
 * NEW: Quick check, single attempt, trust queue for error recovery
 */
class ConnectionGate {
  constructor() {
    this.isReady = false;
    this.lastVerification = null;
    this.verificationPromise = null;
    this.VERIFICATION_TIMEOUT = 3000; // Reduced from 10s to 3s - fail fast
    // REMOVED: Retry logic - let queue handle failures instead

    // Auto-invalidate on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.invalidate('document hidden');
      }
    });

    // Auto-invalidate on online event (network might have changed)
    window.addEventListener('online', () => {
      this.invalidate('online event');
    });

    // REMOVED: Focus and pageshow invalidation - too aggressive, causes UX issues
  }

  /**
   * Invalidate the current connection state
   */
  invalidate(reason = 'unknown') {
    if (this.isReady) {
      console.log(`[ConnectionGate] Invalidating connection (${reason})`);
      this.isReady = false;
      this.lastVerification = null;
      this.verificationPromise = null;
    }
  }

  /**
   * Wait for connection to be ready
   * SIMPLIFIED: Quick single check, no blocking
   *
   * @param {number} timeout - Maximum time to wait in ms
   * @returns {Promise<boolean>} - True if ready, false if offline
   */
  async waitForReady(timeout = this.VERIFICATION_TIMEOUT) {
    // If already verified recently (within 10s), return immediately
    // Increased cache time to reduce verification overhead
    if (this.isReady && this.lastVerification && (Date.now() - this.lastVerification < 10000)) {
      return true;
    }

    // If already verifying, wait for that
    if (this.verificationPromise) {
      try {
        return await Promise.race([
          this.verificationPromise,
          this.timeoutPromise(timeout, false)
        ]);
      } catch (error) {
        console.error('[ConnectionGate] Error waiting for verification:', error);
        // On error, assume connection is OK and let operation try
        // Queue system will handle actual failures
        return true;
      }
    }

    // Start new verification
    this.verificationPromise = this.verifyConnection();

    try {
      const result = await Promise.race([
        this.verificationPromise,
        this.timeoutPromise(timeout, false)
      ]);
      return result;
    } catch (error) {
      console.error('[ConnectionGate] Error in waitForReady:', error);
      // On error, let operation through - queue handles failures
      return true;
    } finally {
      this.verificationPromise = null;
    }
  }

  /**
   * Verify the connection - SIMPLIFIED single attempt
   * NO RETRIES - let the queue system handle failures
   */
  async verifyConnection() {
    console.log('[ConnectionGate] Quick connection check...');

    try {
      // Check 1: Network connectivity (instant check)
      if (!navigator.onLine) {
        console.log('[ConnectionGate] Offline');
        this.isReady = false;
        return false;
      }

      // Check 2: Valid session (should be cached by Supabase)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.log('[ConnectionGate] No valid session');
        this.isReady = false;
        return false;
      }

      // Skip ping query - trust that if we're online with a session, we're good
      // Database operations will fail fast if connection is actually bad
      // Queue system handles retry logic

      console.log('[ConnectionGate] Connection OK ✓');
      this.isReady = true;
      this.lastVerification = Date.now();
      return true;

    } catch (error) {
      console.error('[ConnectionGate] Verification failed:', error);
      // Don't mark as not ready - let operation try anyway
      // This prevents blocking UI on temporary glitches
      this.isReady = true; // Optimistic - let queue handle failures
      return true;
    }
  }

  /**
   * Execute a database operation with connection verification
   * SIMPLIFIED: Quick check, don't block, let queue handle failures
   *
   * @param {Function} operation - The database operation to execute
   * @param {string} name - Name of the operation for logging
   * @returns {Promise<any>} - Result of the operation
   */
  async execute(operation, name = 'operation') {
    // Quick offline check - don't even try if clearly offline
    if (!navigator.onLine) {
      console.log(`[ConnectionGate] ${name} - offline, will be queued`);
      throw new Error('Offline - operation will be queued');
    }

    // Execute the operation directly - don't wait for verification
    // Trust queue system to handle failures
    try {
      const result = await operation();
      // Mark connection as verified on success
      this.isReady = true;
      this.lastVerification = Date.now();
      return result;
    } catch (error) {
      console.error(`[ConnectionGate] ${name} failed:`, error);

      // If it's a connection error, invalidate for next operation
      if (this.isConnectionError(error)) {
        this.invalidate(`${name} failed with connection error`);
      }

      throw error;
    }
  }

  /**
   * Check if an error is a connection-related error
   */
  isConnectionError(error) {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';

    return (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('jwt') ||
      message.includes('auth') ||
      code.includes('pgrst') ||
      code === '401' ||
      code === '403'
    );
  }

  /**
   * Create a timeout promise
   */
  timeoutPromise(ms, value) {
    return new Promise(resolve => setTimeout(() => resolve(value), ms));
  }

  /**
   * Get current connection status
   */
  getStatus() {
    return {
      isReady: this.isReady,
      lastVerification: this.lastVerification,
      timeSinceVerification: this.lastVerification ? Date.now() - this.lastVerification : null
    };
  }
}

// Singleton instance
export const connectionGate = new ConnectionGate();
