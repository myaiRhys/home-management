import { supabase, authManager } from './auth.js';
import { store } from './store.js';
import { connectionManager } from './connection.js';
import { queueManager } from './queue.js';
import { DB_OPERATION_TIMEOUT, MAX_RETRY_ATTEMPTS, Tables, OperationType, INVITE_CODE_LENGTH, NotificationType } from './config.js';

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

      // Show user-friendly error messages
      if (error.message?.includes('policy') || error.code === '42501') {
        this.dispatchError('Unable to save - permission denied. Please check your household membership.', error);
      } else if (error.message?.includes('timeout')) {
        this.dispatchError('Save timed out - please try again', error);
      } else if (error.message?.includes('JWT') || error.message?.includes('auth')) {
        this.dispatchError('Session expired - please refresh the page', error);
      } else if (!navigator.onLine) {
        this.dispatchError('You are offline - please try again when connected', error);
      } else {
        this.dispatchError('Failed to save - please try again', error);
      }

      return { data: null, error };
    }
  }

  /**
   * Update a record
   */
  async update(table, id, data, shouldQueue = true) {
    try {
      // SYNC FIX: Always set updated_at for conflict resolution
      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      };

      const result = await this.executeWithTimeout(async () => {
        const { data: updated, error } = await supabase
          .from(table)
          .update(updateData)
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

    // Simple: just insert to database
    // Realtime subscription will reload and show to all household members
    const { data, error } = await this.insert(Tables.SHOPPING, item);

    // If successful, add to local store immediately (realtime will also update)
    if (data) {
      const shopping = store.getShopping();
      // Only add if not already present (realtime might have beaten us)
      if (!shopping.find(i => i.id === data.id)) {
        store.setShopping([data, ...shopping]);
      }

      // Send notification (broadcast to household)
      const prefs = store.getNotificationPreferences();
      if (prefs.shopping_added) {
        this.sendShoppingAddedNotification(name, data.id).catch(console.error);
      }
    }

    return { data, error };
  }

  async updateShoppingItem(id, updates) {
    const { data, error } = await this.update(Tables.SHOPPING, id, updates);

    // Update local store immediately if successful
    if (data) {
      store.setShopping(
        store.getShopping().map(item => item.id === id ? data : item)
      );
    }

    return { data, error };
  }

  async deleteShoppingItem(id) {
    // Remove from local store first for responsive UI
    store.setShopping(store.getShopping().filter(item => item.id !== id));

    const { data, error } = await this.delete(Tables.SHOPPING, id);

    // If delete failed, reload to restore the item
    if (error) {
      await this.loadShopping();
    }

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

    const { data, error } = await this.insert(Tables.TASKS, task);

    if (data) {
      const tasks = store.getTasks();
      if (!tasks.find(t => t.id === data.id)) {
        store.setTasks([data, ...tasks]);
      }

      // Send notification if task is assigned to someone
      if (assignee) {
        const prefs = store.getNotificationPreferences();
        if (prefs.task_assigned) {
          this.sendTaskAssignedNotification(name, assignee, data.id, 'tasks').catch(console.error);
        }
      }
    }

    return { data, error };
  }

  async updateTask(id, updates) {
    // Get original task to check for changes
    const originalTask = store.getTasks().find(t => t.id === id);

    const { data, error } = await this.update(Tables.TASKS, id, updates);

    if (data) {
      store.setTasks(
        store.getTasks().map(task => task.id === id ? data : task)
      );

      const prefs = store.getNotificationPreferences();

      // Send notification if task was just completed
      if (updates.completed === true && originalTask && !originalTask.completed) {
        if (prefs.task_completed) {
          this.sendTaskCompletedNotification(originalTask.name, id, 'tasks').catch(console.error);
        }
      }

      // Send notification if task was assigned to a new person
      if (updates.assignee && originalTask && updates.assignee !== originalTask.assignee) {
        if (prefs.task_assigned) {
          this.sendTaskAssignedNotification(originalTask.name, updates.assignee, id, 'tasks').catch(console.error);
        }
      }
    }

    return { data, error };
  }

  async deleteTask(id) {
    store.setTasks(store.getTasks().filter(task => task.id !== id));

    const { data, error } = await this.delete(Tables.TASKS, id);

    if (error) {
      await this.loadTasks();
    }

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

    const { data, error } = await this.insert(Tables.CLIFFORD, clifford);

    if (data) {
      const cliffords = store.getClifford();
      if (!cliffords.find(c => c.id === data.id)) {
        store.setClifford([data, ...cliffords]);
      }

      // Send notification if clifford task is assigned to someone
      if (assignee) {
        const prefs = store.getNotificationPreferences();
        if (prefs.clifford_assigned) {
          this.sendTaskAssignedNotification(name, assignee, data.id, 'clifford').catch(console.error);
        }
      }
    }

    return { data, error };
  }

  async updateClifford(id, updates) {
    // Get original task to check for changes
    const originalClifford = store.getClifford().find(c => c.id === id);

    const { data, error } = await this.update(Tables.CLIFFORD, id, updates);

    if (data) {
      store.setClifford(
        store.getClifford().map(clifford => clifford.id === id ? data : clifford)
      );

      const prefs = store.getNotificationPreferences();

      // Send notification if task was just completed
      if (updates.completed === true && originalClifford && !originalClifford.completed) {
        if (prefs.task_completed) {
          this.sendTaskCompletedNotification(originalClifford.name, id, 'clifford').catch(console.error);
        }
      }

      // Send notification if task was assigned to a new person
      if (updates.assignee && originalClifford && updates.assignee !== originalClifford.assignee) {
        if (prefs.clifford_assigned) {
          this.sendTaskAssignedNotification(originalClifford.name, updates.assignee, id, 'clifford').catch(console.error);
        }
      }
    }

    return { data, error };
  }

  async deleteClifford(id) {
    store.setClifford(store.getClifford().filter(clifford => clifford.id !== id));

    const { data, error } = await this.delete(Tables.CLIFFORD, id);

    if (error) {
      await this.loadClifford();
    }

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

  // ============================
  // NOTIFICATION OPERATIONS
  // ============================

  /**
   * Load notifications for the current user
   */
  async loadNotifications() {
    const user = authManager.getCurrentUser();
    const household = authManager.getCurrentHousehold();
    if (!user || !household) {
      return { data: [], error: null };
    }

    try {
      const result = await this.executeWithTimeout(async () => {
        // Get notifications for current user OR broadcast notifications for household
        const { data, error } = await supabase
          .from(Tables.NOTIFICATIONS)
          .select('*')
          .or(`to_user_id.eq.${user.id},and(to_user_id.is.null,household_id.eq.${household.id})`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data;
      });

      if (result) {
        store.setNotifications(result);
      }

      return { data: result, error: null };
    } catch (error) {
      console.error('[DB] Load notifications error:', error);
      return { data: null, error };
    }
  }

  /**
   * Create a notification
   */
  async createNotification({ type, title, message, toUserId = null, relatedItemId = null, relatedTable = null }) {
    const household = authManager.getCurrentHousehold();
    const user = authManager.getCurrentUser();
    if (!household || !user) {
      return { data: null, error: new Error('No household or user') };
    }

    // Don't send notification to yourself
    if (toUserId === user.id) {
      return { data: null, error: null };
    }

    const notification = {
      household_id: household.id,
      from_user_id: user.id,
      to_user_id: toUserId,
      type,
      title,
      message,
      related_item_id: relatedItemId,
      related_table: relatedTable,
      read: false,
      created_at: new Date().toISOString()
    };

    const { data, error } = await this.insert(Tables.NOTIFICATIONS, notification);

    return { data, error };
  }

  /**
   * Mark a notification as read
   */
  async markNotificationAsRead(id) {
    const { data, error } = await this.update(Tables.NOTIFICATIONS, id, { read: true });

    if (!error) {
      store.markNotificationAsRead(id);
    }

    return { data, error };
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead() {
    const user = authManager.getCurrentUser();
    const household = authManager.getCurrentHousehold();
    if (!user || !household) {
      return { data: null, error: new Error('No user or household') };
    }

    try {
      const { data, error } = await supabase
        .from(Tables.NOTIFICATIONS)
        .update({ read: true, updated_at: new Date().toISOString() })
        .or(`to_user_id.eq.${user.id},and(to_user_id.is.null,household_id.eq.${household.id})`)
        .eq('read', false);

      if (!error) {
        store.markAllNotificationsAsRead();
      }

      return { data, error };
    } catch (error) {
      console.error('[DB] Mark all notifications as read error:', error);
      return { data: null, error };
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id) {
    const { data, error } = await this.delete(Tables.NOTIFICATIONS, id);

    if (!error) {
      store.removeNotification(id);
    }

    return { data, error };
  }

  /**
   * Load notification preferences for current user
   */
  async loadNotificationPreferences() {
    const user = authManager.getCurrentUser();
    if (!user) {
      return { data: null, error: null };
    }

    try {
      const { data, error } = await supabase
        .from(Tables.NOTIFICATION_PREFERENCES)
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is fine
        throw error;
      }

      if (data) {
        store.setNotificationPreferences({
          task_assigned: data.task_assigned,
          shopping_added: data.shopping_added,
          task_completed: data.task_completed,
          clifford_assigned: data.clifford_assigned
        });
      }

      return { data, error: null };
    } catch (error) {
      console.error('[DB] Load notification preferences error:', error);
      return { data: null, error };
    }
  }

  /**
   * Save notification preferences for current user
   */
  async saveNotificationPreferences(preferences) {
    const user = authManager.getCurrentUser();
    const household = authManager.getCurrentHousehold();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    try {
      const { data, error } = await supabase
        .from(Tables.NOTIFICATION_PREFERENCES)
        .upsert({
          user_id: user.id,
          household_id: household?.id,
          task_assigned: preferences.task_assigned,
          shopping_added: preferences.shopping_added,
          task_completed: preferences.task_completed,
          clifford_assigned: preferences.clifford_assigned,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (!error) {
        store.setNotificationPreferences(preferences);
      }

      return { data, error };
    } catch (error) {
      console.error('[DB] Save notification preferences error:', error);
      return { data: null, error };
    }
  }

  /**
   * Helper: Get display name for a user
   */
  getMemberDisplayName(userId) {
    const members = store.getHouseholdMembers();
    const member = members.find(m => m.user_id === userId);
    return member?.profiles?.display_name || member?.users?.email || 'Someone';
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssignedNotification(taskName, assigneeUserId, taskId, table = 'tasks') {
    const fromUserName = this.getMemberDisplayName(authManager.getCurrentUser()?.id);
    const notifType = table === 'clifford' ? NotificationType.CLIFFORD_ASSIGNED : NotificationType.TASK_ASSIGNED;

    return this.createNotification({
      type: notifType,
      title: 'Task Assigned',
      message: `${fromUserName} assigned you: "${taskName}"`,
      toUserId: assigneeUserId,
      relatedItemId: taskId,
      relatedTable: table
    });
  }

  /**
   * Send shopping item added notification (broadcast)
   */
  async sendShoppingAddedNotification(itemName, itemId) {
    const fromUserName = this.getMemberDisplayName(authManager.getCurrentUser()?.id);

    return this.createNotification({
      type: NotificationType.SHOPPING_ADDED,
      title: 'Shopping List Updated',
      message: `${fromUserName} added "${itemName}" to the shopping list`,
      toUserId: null, // Broadcast to household
      relatedItemId: itemId,
      relatedTable: 'shopping'
    });
  }

  /**
   * Send task completed notification
   */
  async sendTaskCompletedNotification(taskName, taskId, table = 'tasks') {
    const fromUserName = this.getMemberDisplayName(authManager.getCurrentUser()?.id);

    return this.createNotification({
      type: NotificationType.TASK_COMPLETED,
      title: 'Task Completed',
      message: `${fromUserName} completed: "${taskName}"`,
      toUserId: null, // Broadcast to household
      relatedItemId: taskId,
      relatedTable: table
    });
  }
}

// Singleton instance
export const db = new DatabaseManager();
