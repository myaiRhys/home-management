import { STORAGE_KEYS, OperationType } from './config.js';
import { connectionManager } from './connection.js';

/**
 * Offline Operation Queue
 * SIMPLIFIED: Just stores failed operations for retry
 */
class QueueManager {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.listeners = new Set();

    this.loadQueue();

    window.addEventListener('connection:reconnect', () => this.processQueue());
  }

  loadQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.QUEUE);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`[Queue] Loaded ${this.queue.length} operations`);
      }
    } catch (error) {
      console.error('[Queue] Error loading:', error);
      this.queue = [];
    }
  }

  saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[Queue] Error saving:', error);
    }
  }

  enqueue(operation) {
    const queueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...operation
    };

    this.queue.push(queueItem);
    this.saveQueue();
    this.notifyListeners();

    console.log(`[Queue] Enqueued ${operation.type} on ${operation.table}`);
    return queueItem.id;
  }

  dequeue(id) {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.saveQueue();
      this.notifyListeners();
    }
  }

  getQueue() {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
    this.saveQueue();
    this.notifyListeners();
  }

  async processQueue() {
    if (this.processing || !connectionManager.isConnected() || this.queue.length === 0) {
      return;
    }

    console.log(`[Queue] Processing ${this.queue.length} operations...`);
    this.processing = true;

    while (this.queue.length > 0) {
      const operation = this.queue[0];

      try {
        if (this.executeOperation) {
          await this.executeOperation(operation);
        }
        this.dequeue(operation.id);
      } catch (error) {
        console.error(`[Queue] Failed:`, error);

        if (error.message?.includes('auth') || !navigator.onLine) {
          break;
        }
        // Remove failed operation and continue
        this.dequeue(operation.id);
      }
    }

    this.processing = false;
    console.log(`[Queue] Done. ${this.queue.length} remaining.`);
  }

  setExecutor(executorFn) {
    this.executeOperation = executorFn;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.queue);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.queue);
      } catch (error) {
        console.error('[Queue] Listener error:', error);
      }
    });
  }
}

export const queueManager = new QueueManager();
