import { supabase, authManager } from './auth.js';
import { store } from './store.js';
import { connectionManager } from './connection.js';
import { queueManager } from './queue.js';
import { DB_OPERATION_TIMEOUT, MAX_RETRY_ATTEMPTS, Tables, OperationType, INVITE_CODE_LENGTH } from './config.js';

/**
 * Database Operations Manager
 * Handles all CRUD operations with connection management
 */
class DatabaseManager {
  constructor() {
    // Set queue executor
    queueManager.setExecutor((operation) => this.executeQueuedOperation(operation));
  }

  /**
   * Execute a database operation with timeout and error handling
   */
  async executeWithTimeout(operation, timeout = DB_OPERATION_TIMEOUT) {
    return new Promise(async (resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, timeout);

      try {
        const result = await operation();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Execute queued operation
   */
  async executeQueuedOperation(operation) {
    const { type, table, data } = operation;

    switch (type) {
      case OperationType.INSERT:
        return await this.insert(table, data, false); // Don't queue again

      case OperationType.UPDATE:
        return await this.update(table, data.id, data, false);

      case OperationType.DELETE:
        return await this.delete(table, data.id, false);

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  /**
   * Insert a record
   */
  async insert(table, data, shouldQueue = true) {
    try {
      const result = await this.executeWithTimeout(async () => {
        const { data: inserted, error } = await supabase
          .from(table)
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return inserted;
      });

      return { data: result, error: null };

    } catch (error) {
      console.error(`[DB] Insert error on ${table}:`, error);

      // Queue for later if appropriate
      if (shouldQueue && this.shouldQueue(error)) {
        queueManager.enqueue({
          type: OperationType.INSERT,
          table,
          data
        });
      }

      return { data: null, error };
    }
  }

  /**
   * Update a record
   */
  async update(table, id, data, shouldQueue = true) {
    try {
      const result = await this.executeWithTimeout(async () => {
        const { data: updated, error } = await supabase
          .from(table)
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return updated;
      });

      return { data: result, error: null };

    } catch (error) {
      console.error(`[DB] Update error on ${table}:`, error);

      if (shouldQueue && this.shouldQueue(error)) {
        queueManager.enqueue({
          type: OperationType.UPDATE,
          table,
          data: { ...data, id }
        });
      }

      return { data: null, error };
    }
  }

  /**
   * Delete a record
   */
  async delete(table, id, shouldQueue = true) {
    try {
      const result = await this.executeWithTimeout(async () => {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', id);

        if (error) throw error;
        return { id };
      });

      return { data: result, error: null };

    } catch (error) {
      console.error(`[DB] Delete error on ${table}:`, error);

      if (shouldQueue && this.shouldQueue(error)) {
        queueManager.enqueue({
          type: OperationType.DELETE,
          table,
          data: { id }
        });
      }

      return { data: null, error };
    }
  }

  /**
   * Fetch records
   */
  async fetch(table, filters = {}) {
    try {
      const result = await this.executeWithTimeout(async () => {
        let query = supabase.from(table).select('*');

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });

        // Order by created_at desc
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;
        return data;
      });

      return { data: result, error: null };

    } catch (error) {
      console.error(`[DB] Fetch error on ${table}:`, error);
      return { data: null, error };
    }
  }

  /**
   * Determine if operation should be queued
   */
  shouldQueue(error) {
    // Queue on network errors, timeouts, or connection issues
    if (!navigator.onLine) return true;
    if (error.message?.includes('timeout')) return true;
    if (error.message?.includes('network')) return true;
    if (error.message?.includes('fetch')) return true;

    // Don't queue on validation errors or auth errors
    if (error.code?.startsWith('23')) return false; // PostgreSQL constraint violations
    if (error.message?.includes('auth')) return false;

    return false;
  }

  // ============================
  // HOUSEHOLD OPERATIONS
  // ============================

  /**
   * Create a new household
   */
  async createHousehold(name) {
    const user = authManager.getCurrentUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    try {
      // Generate invite code
      const inviteCode = this.generateInviteCode();

      // Create household
      const { data: household, error: householdError } = await this.insert(Tables.HOUSEHOLDS, {
        name,
        invite_code: inviteCode,
        created_by: user.id
      });

      if (householdError) {
        return { data: null, error: householdError };
      }

      // Add creator as admin member
      const { error: memberError } = await this.insert(Tables.HOUSEHOLD_MEMBERS, {
        household_id: household.id,
        user_id: user.id,
        role: 'admin'
      });

      if (memberError) {
        return { data: null, error: memberError };
      }

      // Update store
      store.setHousehold({ ...household, userRole: 'admin' });

      return { data: household, error: null };

    } catch (error) {
      console.error('[DB] Create household error:', error);
      return { data: null, error };
    }
  }

  /**
   * Join household with invite code
   */
  async joinHousehold(inviteCode) {
    const user = authManager.getCurrentUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    try {
      // Call RPC function to get household
      const { data: household, error: fetchError } = await supabase
        .rpc('get_household_by_invite_code', { code: inviteCode });

      if (fetchError || !household || household.length === 0) {
        return { data: null, error: new Error('Invalid invite code') };
      }

      const householdData = household[0];

      // Add user as member
      const { error: memberError } = await this.insert(Tables.HOUSEHOLD_MEMBERS, {
        household_id: householdData.id,
        user_id: user.id,
        role: 'member'
      });

      if (memberError) {
        return { data: null, error: memberError };
      }

      // Update store
      store.setHousehold({ ...householdData, userRole: 'member' });

      return { data: householdData, error: null };

    } catch (error) {
      console.error('[DB] Join household error:', error);
      return { data: null, error };
    }
  }

  /**
   * Load household members
   */
  async loadHouseholdMembers() {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: [], error: null };
    }

    const { data, error } = await this.fetch(Tables.HOUSEHOLD_MEMBERS, {
      household_id: household.id
    });

    if (!error && data) {
      store.setHouseholdMembers(data);
    }

    return { data, error };
  }

  /**
   * Remove household member (admin only)
   */
  async removeHouseholdMember(memberId) {
    const household = authManager.getCurrentHousehold();
    if (!household || household.userRole !== 'admin') {
      return { data: null, error: new Error('Not authorized') };
    }

    return await this.delete(Tables.HOUSEHOLD_MEMBERS, memberId);
  }

  /**
   * Generate random invite code
   */
  generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // ============================
  // SHOPPING OPERATIONS
  // ============================

  async addShoppingItem(name, notes = '') {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: null, error: new Error('No household') };
    }

    const item = {
      household_id: household.id,
      name,
      notes,
      purchased: false,
      created_at: new Date().toISOString()
    };

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempItem = { ...item, id: tempId };
    store.setShopping([tempItem, ...store.getShopping()]);

    const { data, error } = await this.insert(Tables.SHOPPING, item);

    if (data) {
      // Replace temp item with real one
      const shopping = store.getShopping().filter(i => i.id !== tempId);
      store.setShopping([data, ...shopping]);
    } else if (error) {
      // Mark as pending
      tempItem.pending = true;
      store.setShopping(store.getShopping());
    }

    return { data, error };
  }

  async updateShoppingItem(id, updates) {
    // Optimistic update
    const shopping = store.getShopping().map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    store.setShopping(shopping);

    const { data, error } = await this.update(Tables.SHOPPING, id, updates);

    if (error) {
      // Mark as pending
      const updatedShopping = store.getShopping().map(item =>
        item.id === id ? { ...item, pending: true } : item
      );
      store.setShopping(updatedShopping);
    }

    return { data, error };
  }

  async deleteShoppingItem(id) {
    // Optimistic delete
    const shopping = store.getShopping().filter(item => item.id !== id);
    store.setShopping(shopping);

    const { data, error } = await this.delete(Tables.SHOPPING, id);

    return { data, error };
  }

  async loadShopping() {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: [], error: null };
    }

    const { data, error } = await this.fetch(Tables.SHOPPING, {
      household_id: household.id
    });

    if (!error && data) {
      store.setShopping(data);
    }

    return { data, error };
  }

  // ============================
  // TASKS OPERATIONS
  // ============================

  async addTask(name, assignee = null, dueDate = null, notes = '') {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: null, error: new Error('No household') };
    }

    const task = {
      household_id: household.id,
      name,
      assignee,
      due_date: dueDate,
      notes,
      completed: false,
      created_at: new Date().toISOString()
    };

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempTask = { ...task, id: tempId };
    store.setTasks([tempTask, ...store.getTasks()]);

    const { data, error } = await this.insert(Tables.TASKS, task);

    if (data) {
      const tasks = store.getTasks().filter(t => t.id !== tempId);
      store.setTasks([data, ...tasks]);
    } else if (error) {
      tempTask.pending = true;
      store.setTasks(store.getTasks());
    }

    return { data, error };
  }

  async updateTask(id, updates) {
    const tasks = store.getTasks().map(task =>
      task.id === id ? { ...task, ...updates } : task
    );
    store.setTasks(tasks);

    const { data, error } = await this.update(Tables.TASKS, id, updates);

    if (error) {
      const updatedTasks = store.getTasks().map(task =>
        task.id === id ? { ...task, pending: true } : task
      );
      store.setTasks(updatedTasks);
    }

    return { data, error };
  }

  async deleteTask(id) {
    const tasks = store.getTasks().filter(task => task.id !== id);
    store.setTasks(tasks);

    const { data, error } = await this.delete(Tables.TASKS, id);

    return { data, error };
  }

  async loadTasks() {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: [], error: null };
    }

    const { data, error } = await this.fetch(Tables.TASKS, {
      household_id: household.id
    });

    if (!error && data) {
      store.setTasks(data);
    }

    return { data, error };
  }

  // ============================
  // CLIFFORD OPERATIONS
  // ============================

  async addClifford(name, assignee = null, dueDate = null, notes = '') {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: null, error: new Error('No household') };
    }

    const clifford = {
      household_id: household.id,
      name,
      assignee,
      due_date: dueDate,
      notes,
      completed: false,
      created_at: new Date().toISOString()
    };

    const tempId = `temp_${Date.now()}`;
    const tempClifford = { ...clifford, id: tempId };
    store.setClifford([tempClifford, ...store.getClifford()]);

    const { data, error } = await this.insert(Tables.CLIFFORD, clifford);

    if (data) {
      const cliffords = store.getClifford().filter(c => c.id !== tempId);
      store.setClifford([data, ...cliffords]);
    } else if (error) {
      tempClifford.pending = true;
      store.setClifford(store.getClifford());
    }

    return { data, error };
  }

  async updateClifford(id, updates) {
    const cliffords = store.getClifford().map(clifford =>
      clifford.id === id ? { ...clifford, ...updates } : clifford
    );
    store.setClifford(cliffords);

    const { data, error } = await this.update(Tables.CLIFFORD, id, updates);

    if (error) {
      const updatedCliffords = store.getClifford().map(clifford =>
        clifford.id === id ? { ...clifford, pending: true } : clifford
      );
      store.setClifford(updatedCliffords);
    }

    return { data, error };
  }

  async deleteClifford(id) {
    const cliffords = store.getClifford().filter(clifford => clifford.id !== id);
    store.setClifford(cliffords);

    const { data, error } = await this.delete(Tables.CLIFFORD, id);

    return { data, error };
  }

  async loadClifford() {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: [], error: null };
    }

    const { data, error } = await this.fetch(Tables.CLIFFORD, {
      household_id: household.id
    });

    if (!error && data) {
      store.setClifford(data);
    }

    return { data, error };
  }

  // ============================
  // QUICK ADD OPERATIONS
  // ============================

  async loadQuickAdd() {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: [], error: null };
    }

    const { data, error } = await this.fetch(Tables.QUICK_ADD, {
      household_id: household.id
    });

    if (!error && data) {
      // Group by type
      const shopping = data.filter(item => item.type === 'shopping');
      const tasks = data.filter(item => item.type === 'tasks');
      const clifford = data.filter(item => item.type === 'clifford');

      store.setQuickAdd('shopping', shopping);
      store.setQuickAdd('tasks', tasks);
      store.setQuickAdd('clifford', clifford);
    }

    return { data, error };
  }

  async addQuickAddItem(type, name) {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: null, error: new Error('No household') };
    }

    const item = {
      household_id: household.id,
      type,
      name
    };

    const { data, error } = await this.insert(Tables.QUICK_ADD, item);

    if (!error && data) {
      const current = store.getQuickAdd(type);
      store.setQuickAdd(type, [...current, data]);
    }

    return { data, error };
  }

  async deleteQuickAddItem(id, type) {
    const { data, error } = await this.delete(Tables.QUICK_ADD, id);

    if (!error) {
      const current = store.getQuickAdd(type).filter(item => item.id !== id);
      store.setQuickAdd(type, current);
    }

    return { data, error };
  }
}

// Singleton instance
export const db = new DatabaseManager();
