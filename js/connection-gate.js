import { supabase, authManager } from './auth.js';
import { DB_OPERATION_TIMEOUT } from './config.js';

/**
 * Connection Gate
 * Blocks database operations until connection is verified
 * Key principle: "Guilty until proven innocent" - assume disconnected until proven otherwise
 */
class ConnectionGate {
  constructor() {
    this.isReady = false;
    this.lastVerification = null;
    this.verificationPromise = null;
    this.VERIFICATION_TIMEOUT = 10000; // 10 seconds
    this.RETRY_ATTEMPTS = 3;
    this.RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

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

    // Auto-invalidate on focus
    window.addEventListener('focus', () => {
      this.invalidate('window focus');
    });

    // Auto-invalidate on pageshow (iOS back/forward cache)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        this.invalidate('pageshow (bfcache)');
      }
    });
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
   * @param {number} timeout - Maximum time to wait in ms
   * @returns {Promise<boolean>} - True if ready, false if timeout
   */
  async waitForReady(timeout = this.VERIFICATION_TIMEOUT) {
    // If already verifying, wait for that
    if (this.verificationPromise) {
      try {
        return await Promise.race([
          this.verificationPromise,
          this.timeoutPromise(timeout, false)
        ]);
      } catch (error) {
        console.error('[ConnectionGate] Error waiting for verification:', error);
        return false;
      }
    }

    // If already verified recently, return immediately
    if (this.isReady && this.lastVerification && (Date.now() - this.lastVerification < 5000)) {
      return true;
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
      return false;
    } finally {
      this.verificationPromise = null;
    }
  }

  /**
   * Verify the connection with retry logic
   */
  async verifyConnection() {
    console.log('[ConnectionGate] Starting connection verification...');

    // Try up to RETRY_ATTEMPTS times with exponential backoff
    for (let attempt = 0; attempt < this.RETRY_ATTEMPTS; attempt++) {
      try {
        // Check 1: Network connectivity
        if (!navigator.onLine) {
          console.log('[ConnectionGate] Offline - skipping verification');
          throw new Error('Offline');
        }

        // Check 2: Valid session
        const session = await authManager.getSession();
        if (!session) {
          console.log('[ConnectionGate] No valid session');
          throw new Error('No session');
        }

        // Check 3: Lightweight ping query
        const { data, error } = await Promise.race([
          supabase.from('households').select('id').limit(1),
          this.timeoutPromise(3000, null)
        ]);

        if (error) {
          console.error(`[ConnectionGate] Ping query failed (attempt ${attempt + 1}):`, error);
          throw error;
        }

        // Success!
        console.log('[ConnectionGate] Connection verified ✓');
        this.isReady = true;
        this.lastVerification = Date.now();
        return true;

      } catch (error) {
        console.error(`[ConnectionGate] Verification attempt ${attempt + 1} failed:`, error);

        // If this isn't the last attempt, wait before retrying
        if (attempt < this.RETRY_ATTEMPTS - 1) {
          const delay = this.RETRY_DELAYS[attempt];
          console.log(`[ConnectionGate] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    console.error('[ConnectionGate] Connection verification failed after all attempts');
    this.isReady = false;
    return false;
  }

  /**
   * Execute a database operation with connection verification
   * @param {Function} operation - The database operation to execute
   * @param {string} name - Name of the operation for logging
   * @returns {Promise<any>} - Result of the operation
   */
  async execute(operation, name = 'operation') {
    console.log(`[ConnectionGate] Executing ${name}...`);

    // Wait for connection to be ready
    const ready = await this.waitForReady();

    if (!ready) {
      const error = new Error('Connection not ready - operation blocked');
      console.error(`[ConnectionGate] ${name} blocked:`, error);
      throw error;
    }

    // Execute the operation
    try {
      const result = await operation();
      console.log(`[ConnectionGate] ${name} completed successfully`);
      return result;
    } catch (error) {
      console.error(`[ConnectionGate] ${name} failed:`, error);

      // If it's a connection error, invalidate
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
