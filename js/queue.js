import { STORAGE_KEYS, OperationType } from './config.js';
import { connectionManager } from './connection.js';

/**
 * Offline Operation Queue
 * Stores failed operations and retries them when connection is restored
 */
class QueueManager {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.listeners = new Set();

    // IDEMPOTENCY FIX: Track recently processed operations to prevent duplicates
    // Maps idempotency key -> timestamp of successful execution
    this.processedOperations = new Map();
    this.IDEMPOTENCY_TTL = 60000; // 60 seconds - how long to remember processed operations

    // Load queue from localStorage
    this.loadQueue();

    // Listen for reconnection events
    window.addEventListener('connection:reconnect', () => this.processQueue());

    // Clean up old idempotency records periodically
    setInterval(() => this.cleanupIdempotencyRecords(), 30000);
  }

  /**
   * Generate an idempotency key for an operation
   * This identifies unique operations to prevent duplicates
   */
  generateIdempotencyKey(operation) {
    const { type, table, data } = operation;
    // For INSERTs, use a hash of the content (name + household_id + type)
    if (type === OperationType.INSERT) {
      return `${type}_${table}_${data.name || ''}_${data.household_id || data.user_id || ''}_${data.type || ''}`;
    }
    // For UPDATEs and DELETEs, use the record ID
    return `${type}_${table}_${data.id || ''}`;
  }

  /**
   * Check if an operation was recently processed (idempotency check)
   */
  wasRecentlyProcessed(operation) {
    const key = this.generateIdempotencyKey(operation);
    const processedAt = this.processedOperations.get(key);
    if (processedAt && Date.now() - processedAt < this.IDEMPOTENCY_TTL) {
      return true;
    }
    return false;
  }

  /**
   * Mark an operation as processed (for idempotency)
   */
  markAsProcessed(operation) {
    const key = this.generateIdempotencyKey(operation);
    this.processedOperations.set(key, Date.now());
  }

  /**
   * Clean up old idempotency records
   */
  cleanupIdempotencyRecords() {
    const now = Date.now();
    for (const [key, timestamp] of this.processedOperations) {
      if (now - timestamp > this.IDEMPOTENCY_TTL) {
        this.processedOperations.delete(key);
      }
    }
  }

  /**
   * Load queue from localStorage
   */
  loadQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.QUEUE);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`[Queue] Loaded ${this.queue.length} operations from storage`);
      }
    } catch (error) {
      console.error('[Queue] Error loading queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[Queue] Error saving queue:', error);
    }
  }

  /**
   * Add operation to queue
   */
  enqueue(operation) {
    // IDEMPOTENCY FIX: Check if this operation was recently processed successfully
    if (this.wasRecentlyProcessed(operation)) {
      console.log(`[Queue] Skipping duplicate operation (recently processed):`, operation.type, operation.table);
      return null;
    }

    // IDEMPOTENCY FIX: Check if a similar operation is already in the queue
    const idempotencyKey = this.generateIdempotencyKey(operation);
    const existingInQueue = this.queue.find(item =>
      this.generateIdempotencyKey(item) === idempotencyKey
    );
    if (existingInQueue) {
      console.log(`[Queue] Skipping duplicate operation (already queued):`, operation.type, operation.table);
      return existingInQueue.id;
    }

    const queueItem = {
      id: this.generateId(),
      timestamp: Date.now(),
      idempotencyKey,
      ...operation
    };

    this.queue.push(queueItem);
    this.saveQueue();
    this.notifyListeners();

    console.log(`[Queue] Enqueued ${operation.type} on ${operation.table}`, queueItem);

    return queueItem.id;
  }

  /**
   * Remove operation from queue
   */
  dequeue(id) {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = this.queue.splice(index, 1)[0];
      this.saveQueue();
      this.notifyListeners();
      console.log(`[Queue] Dequeued operation ${id}`);
      return item;
    }
    return null;
  }

  /**
   * Get all queued operations
   */
  getQueue() {
    return [...this.queue];
  }

  /**
   * Get queued operations for a specific item
   */
  getItemQueue(table, itemId) {
    return this.queue.filter(op =>
      op.table === table &&
      (op.data?.id === itemId || op.id === itemId)
    );
  }

  /**
   * Check if an item has pending operations
   */
  hasPendingOperations(table, itemId) {
    return this.getItemQueue(table, itemId).length > 0;
  }

  /**
   * Clear all queued operations
   */
  clear() {
    this.queue = [];
    this.saveQueue();
    this.notifyListeners();
    console.log('[Queue] Cleared all operations');
  }

  /**
   * Process the queue
   * Attempts to execute all queued operations in order
   */
  async processQueue() {
    // Don't process if already processing or offline
    if (this.processing || !connectionManager.isConnected()) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    console.log(`[Queue] Processing ${this.queue.length} queued operations...`);
    this.processing = true;

    // Process operations one by one
    while (this.queue.length > 0) {
      const operation = this.queue[0];

      try {
        // IDEMPOTENCY FIX: Skip if this operation was already processed
        if (this.wasRecentlyProcessed(operation)) {
          console.log(`[Queue] Skipping already-processed operation:`, operation.id);
          this.dequeue(operation.id);
          continue;
        }

        console.log(`[Queue] Processing ${operation.type} on ${operation.table}`);

        // Execute the operation (this will be set by the database module)
        if (this.executeOperation) {
          const result = await this.executeOperation(operation);

          // IDEMPOTENCY FIX: Mark as successfully processed
          this.markAsProcessed(operation);
        }

        // Success - remove from queue
        this.dequeue(operation.id);

      } catch (error) {
        console.error(`[Queue] Failed to process operation ${operation.id}:`, error);

        // If it's an auth error or network error, stop processing
        if (error.message?.includes('auth') || !navigator.onLine) {
          console.log('[Queue] Stopping queue processing due to error');
          break;
        }

        // Check for duplicate key error (item already exists)
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          console.log('[Queue] Duplicate detected, marking as processed and removing');
          this.markAsProcessed(operation);
          this.dequeue(operation.id);
          continue;
        }

        // Otherwise, remove the failed operation and continue
        this.dequeue(operation.id);
      }
    }

    this.processing = false;
    console.log(`[Queue] Processing complete. ${this.queue.length} operations remaining.`);
  }

  /**
   * Set the operation executor function (will be set by database module)
   */
  setExecutor(executorFn) {
    this.executeOperation = executorFn;
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.queue);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of queue changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.queue);
      } catch (error) {
        console.error('[Queue] Error in listener:', error);
      }
    });
  }

  /**
   * Generate unique ID for queue item
   */
  generateId() {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const queueManager = new QueueManager();
