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
   * Dispatch an error event for UI to display
   */
  dispatchError(message, details = null) {
    console.error('[DB] Error:', message, details);
    window.dispatchEvent(new CustomEvent('db:error', {
      detail: { message, details }
    }));
  }

  /**
   * Dispatch a success event for UI to display
   */
  dispatchSuccess(message) {
    window.dispatchEvent(new CustomEvent('db:success', {
      detail: { message }
    }));
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

      // Detect and report specific error types
      if (error.message?.includes('policy') || error.code === '42501') {
        this.dispatchError('Unable to save - permission denied. Please check your household membership.', error);
      } else if (error.message?.includes('timeout')) {
        this.dispatchError('Save timed out - will retry when connection improves', error);
      } else if (error.message?.includes('JWT') || error.message?.includes('auth')) {
        this.dispatchError('Session expired - please refresh the page', error);
      } else if (!navigator.onLine) {
        this.dispatchError('You are offline - changes will sync when connected', error);
      }

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

      // Detect and report specific error types
      if (error.message?.includes('policy') || error.code === '42501') {
        this.dispatchError('Unable to update - permission denied', error);
      } else if (error.message?.includes('JWT') || error.message?.includes('auth')) {
        this.dispatchError('Session expired - please refresh the page', error);
      }

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

      // Detect and report specific error types
      if (error.message?.includes('policy') || error.code === '42501') {
        this.dispatchError('Unable to delete - permission denied', error);
      } else if (error.message?.includes('JWT') || error.message?.includes('auth')) {
        this.dispatchError('Session expired - please refresh the page', error);
      }

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
        created_by: user.id,
        custom_clifford_name: 'Clifford'
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

    try {
      const result = await this.executeWithTimeout(async () => {
        // Try to get household members with profiles first
        let members = null;
        let membersError = null;

        // Get household members
        const response = await supabase
          .from(Tables.HOUSEHOLD_MEMBERS)
          .select('id, household_id, user_id, role, created_at')
          .eq('household_id', household.id)
          .order('created_at', { ascending: true });

        members = response.data;
        membersError = response.error;

        // If we got members, try to fetch profiles separately
        if (members && members.length > 0 && !membersError) {
          try {
            const userIds = members.map(m => m.user_id);
            const { data: profiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id, display_name')
              .in('id', userIds);

            if (!profilesError && profiles) {
              // Map profiles to members
              const profilesMap = {};
              profiles.forEach(p => {
                profilesMap[p.id] = p;
              });

              members = members.map(member => ({
                ...member,
                profiles: profilesMap[member.user_id]
              }));

              console.log('[DB] Loaded profiles:', profiles);
            } else if (profilesError) {
              console.log('[DB] Profiles query error (table may not exist):', profilesError);
            }
          } catch (profilesError) {
            console.log('[DB] Could not load profiles, continuing without them');
          }
        }

        if (membersError) {
          console.error('[DB] Error loading members:', membersError);
          throw membersError;
        }

        console.log('[DB] Loaded members:', members);

        const currentUserId = authManager.getCurrentUser()?.id;

        // Map to expected structure with display names
        const membersWithUsers = members.map((member, index) => {
          const displayName = member.profiles?.display_name ||
                            (member.user_id === currentUserId ? 'You' : `Member ${index + 1}`);

          console.log('[DB] Member:', member.user_id, 'Display name:', displayName);

          return {
            id: member.id,
            household_id: member.household_id,
            user_id: member.user_id,
            role: member.role,
            created_at: member.created_at,
            profiles: member.profiles,
            users: {
              id: member.user_id,
              email: displayName
            }
          };
        });

        return membersWithUsers;
      });

      if (result) {
        console.log('[DB] Setting household members in store:', result);
        store.setHouseholdMembers(result);
      }

      return { data: result, error: null };

    } catch (error) {
      console.error('[DB] Load household members error:', error);
      return { data: null, error };
    }
  }

  /**
   * Update user profile display name
   */
  async updateDisplayName(displayName) {
    const user = authManager.getCurrentUser();
    if (!user) {
      return { error: { message: 'Not authenticated' } };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: displayName,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) throw error;

      // Reload household members to show updated name
      await this.loadHouseholdMembers();

      return { data, error: null };
    } catch (error) {
      console.error('[DB] Update display name error:', error);
      return { data: null, error };
    }
  }

  /**
   * Update household custom clifford name
   */
  async updateHouseholdCustomName(customName) {
    const household = authManager.getCurrentHousehold();
    if (!household) {
      return { data: null, error: new Error('No household') };
    }

    const { data, error } = await this.update(Tables.HOUSEHOLDS, household.id, {
      custom_clifford_name: customName
    });

    if (!error && data) {
      // Update local store
      store.setHousehold({ ...household, custom_clifford_name: customName });
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

  async addShoppingItem(name, notes = '', quantity = 1) {
    const household = authManager.getCurrentHousehold();
    const user = authManager.getCurrentUser();
    if (!household) {
      return { data: null, error: new Error('No household') };
    }

    const item = {
      household_id: household.id,
      name,
      notes,
      quantity: quantity || 1,
      completed: false,
      created_by: user?.id || null,
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
    const user = authManager.getCurrentUser();
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
      created_by: user?.id || null,
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
    const user = authManager.getCurrentUser();
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
      created_by: user?.id || null,
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
  // PERSONAL TASKS OPERATIONS
  // ============================

  async loadPersonalTasks() {
    const user = authManager.getCurrentUser();
    if (!user) {
      return { data: [], error: null };
    }

    const { data, error } = await this.fetch(Tables.PERSONAL_TASKS, {
      user_id: user.id
    });

    if (!error && data) {
      store.setPersonalTasks(data);
    }

    return { data, error };
  }

  async addPersonalTask(name, dueDate, notes) {
    const user = authManager.getCurrentUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const item = {
      user_id: user.id,
      name,
      notes: notes || '',
      due_date: dueDate || null,
      completed: false,
      created_at: new Date().toISOString()
    };

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempItem = { ...item, id: tempId };
    store.setPersonalTasks([tempItem, ...store.getPersonalTasks()]);

    const { data, error } = await this.insert(Tables.PERSONAL_TASKS, item);

    if (data) {
      // Replace temp item with real one
      const current = store.getPersonalTasks();
      store.setPersonalTasks([data, ...current.filter(t => t.id !== tempId)]);
    } else if (error) {
      // Mark temp item as pending on error
      const current = store.getPersonalTasks();
      const updated = current.map(t => t.id === tempId ? { ...t, pending: true } : t);
      store.setPersonalTasks(updated);
    }

    return { data, error };
  }

  async updatePersonalTask(id, updates) {
    // Optimistic update
    const current = store.getPersonalTasks();
    const optimistic = current.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    store.setPersonalTasks(optimistic);

    const { data, error } = await this.update(Tables.PERSONAL_TASKS, id, {
      ...updates,
      updated_at: new Date().toISOString()
    });

    if (error) {
      // Mark as pending on error
      const updated = store.getPersonalTasks().map(item =>
        item.id === id ? { ...item, pending: true } : item
      );
      store.setPersonalTasks(updated);
    }

    return { data, error };
  }

  async togglePersonalTask(id) {
    const current = store.getPersonalTasks();
    const item = current.find(t => t.id === id);
    if (!item) return { data: null, error: new Error('Item not found') };

    return await this.updatePersonalTask(id, {
      completed: !item.completed
    });
  }

  async deletePersonalTask(id) {
    const { data, error } = await this.delete(Tables.PERSONAL_TASKS, id);

    if (!error) {
      const current = store.getPersonalTasks().filter(item => item.id !== id);
      store.setPersonalTasks(current);
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

    // Get current items to calculate next sort_order
    const current = store.getQuickAdd(type);
    const maxSortOrder = current.length > 0
      ? Math.max(...current.map(item => item.sort_order || 0))
      : 0;

    const item = {
      household_id: household.id,
      type,
      name,
      sort_order: maxSortOrder + 1
    };

    const { data, error } = await this.insert(Tables.QUICK_ADD, item);

    if (!error && data) {
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
