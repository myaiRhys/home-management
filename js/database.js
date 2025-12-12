import { db, auth } from './auth.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { store } from './store.js';
import { Tables, INVITE_CODE_LENGTH } from './config.js';

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('[DB] Persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('[DB] Persistence not available in this browser');
  }
});

/**
 * Database Operations Manager
 * Handles all CRUD operations with Firestore
 */
class DatabaseManager {
  constructor() {
    console.log('[DB] Initialized with Firestore');
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
   * Insert a record
   */
  async insert(tableName, data) {
    try {
      const docRef = await addDoc(collection(db, tableName), {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      const inserted = {
        id: docRef.id,
        ...data,
        created_at: new Date().toISOString(), // For immediate use
        updated_at: new Date().toISOString()
      };

      return { data: inserted, error: null };

    } catch (error) {
      console.error(`[DB] Insert error on ${tableName}:`, error);

      // Detect and report specific error types
      if (error.code === 'permission-denied') {
        this.dispatchError('Unable to save - permission denied. Please check your household membership.', error);
      } else if (error.code === 'unauthenticated') {
        this.dispatchError('Session expired - please refresh the page', error);
      } else if (!navigator.onLine) {
        this.dispatchError('You are offline - changes will sync when connected', error);
      }

      return { data: null, error };
    }
  }

  /**
   * Update a record
   */
  async update(tableName, id, data) {
    try {
      await updateDoc(doc(db, tableName, id), {
        ...data,
        updated_at: serverTimestamp()
      });

      const updated = {
        id,
        ...data,
        updated_at: new Date().toISOString()
      };

      return { data: updated, error: null };

    } catch (error) {
      console.error(`[DB] Update error on ${tableName}:`, error);

      // Detect and report specific error types
      if (error.code === 'permission-denied') {
        this.dispatchError('Unable to update - permission denied', error);
      } else if (error.code === 'unauthenticated') {
        this.dispatchError('Session expired - please refresh the page', error);
      }

      return { data: null, error };
    }
  }

  /**
   * Delete a record
   */
  async delete(tableName, id) {
    try {
      await deleteDoc(doc(db, tableName, id));
      return { data: { id }, error: null };

    } catch (error) {
      console.error(`[DB] Delete error on ${tableName}:`, error);

      // Detect and report specific error types
      if (error.code === 'permission-denied') {
        this.dispatchError('Unable to delete - permission denied', error);
      } else if (error.code === 'unauthenticated') {
        this.dispatchError('Session expired - please refresh the page', error);
      }

      return { data: null, error };
    }
  }

  /**
   * Fetch records
   */
  async fetch(tableName, filters = {}) {
    try {
      let q = collection(db, tableName);
      const constraints = [];

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        constraints.push(where(key, '==', value));
      });

      // Order by created_at desc
      constraints.push(orderBy('created_at', 'desc'));

      q = query(q, ...constraints);

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return { data, error: null };

    } catch (error) {
      console.error(`[DB] Fetch error on ${tableName}:`, error);
      return { data: null, error };
    }
  }

  // ============================
  // HOUSEHOLD OPERATIONS
  // ============================

  /**
   * Create a new household
   */
  async createHousehold(name) {
    const user = auth.currentUser;
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
        created_by: user.uid,
        custom_clifford_name: 'Clifford'
      });

      if (householdError) {
        return { data: null, error: householdError };
      }

      // Add creator as admin member
      const { error: memberError } = await this.insert(Tables.HOUSEHOLD_MEMBERS, {
        household_id: household.id,
        user_id: user.uid,
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
    const user = auth.currentUser;
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    try {
      // Find household by invite code
      const q = query(
        collection(db, Tables.HOUSEHOLDS),
        where('invite_code', '==', inviteCode)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { data: null, error: new Error('Invalid invite code') };
      }

      const householdDoc = snapshot.docs[0];
      const householdData = {
        id: householdDoc.id,
        ...householdDoc.data()
      };

      // Add user as member
      const { error: memberError } = await this.insert(Tables.HOUSEHOLD_MEMBERS, {
        household_id: householdData.id,
        user_id: user.uid,
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
    const household = store.getHousehold();
    if (!household) {
      return { data: [], error: null };
    }

    try {
      // Get household members
      const q = query(
        collection(db, Tables.HOUSEHOLD_MEMBERS),
        where('household_id', '==', household.id),
        orderBy('created_at', 'asc')
      );

      const snapshot = await getDocs(q);
      const members = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Try to fetch user profiles separately
      const currentUserId = auth.currentUser?.uid;

      const membersWithUsers = members.map((member, index) => {
        const displayName = member.user_id === currentUserId ? 'You' : `Member ${index + 1}`;

        return {
          id: member.id,
          household_id: member.household_id,
          user_id: member.user_id,
          role: member.role,
          created_at: member.created_at,
          users: {
            id: member.user_id,
            email: displayName
          }
        };
      });

      console.log('[DB] Setting household members in store:', membersWithUsers);
      store.setHouseholdMembers(membersWithUsers);

      return { data: membersWithUsers, error: null };

    } catch (error) {
      console.error('[DB] Load household members error:', error);
      return { data: null, error };
    }
  }

  /**
   * Update user profile display name
   */
  async updateDisplayName(displayName) {
    const user = auth.currentUser;
    if (!user) {
      return { error: { message: 'Not authenticated' } };
    }

    try {
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, {
        display_name: displayName,
        updated_at: serverTimestamp()
      });

      // Reload household members to show updated name
      await this.loadHouseholdMembers();

      return { data: null, error: null };
    } catch (error) {
      console.error('[DB] Update display name error:', error);
      return { data: null, error };
    }
  }

  /**
   * Update household custom clifford name
   */
  async updateHouseholdCustomName(customName) {
    const household = store.getHousehold();
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
    const household = store.getHousehold();
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
    const household = store.getHousehold();
    const user = auth.currentUser;
    if (!household) {
      return { data: null, error: new Error('No household') };
    }

    const item = {
      household_id: household.id,
      name,
      notes,
      quantity: quantity || 1,
      completed: false,
      created_by: user?.uid || null
    };

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempItem = { ...item, id: tempId, created_at: new Date().toISOString() };
    store.setShopping([tempItem, ...store.getShopping()]);

    const { data, error } = await this.insert(Tables.SHOPPING, item);

    if (data) {
      // Replace temp item with real one
      const shopping = store.getShopping().filter(i => i.id !== tempId);
      store.setShopping([data, ...shopping]);
    } else if (error) {
      // Firestore offline persistence will handle retry
      // Just keep the temp item for now
      console.log('[DB] Insert queued for when online');
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
    const household = store.getHousehold();
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
    const household = store.getHousehold();
    const user = auth.currentUser;
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
      created_by: user?.uid || null
    };

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempTask = { ...task, id: tempId, created_at: new Date().toISOString() };
    store.setTasks([tempTask, ...store.getTasks()]);

    const { data, error } = await this.insert(Tables.TASKS, task);

    if (data) {
      const tasks = store.getTasks().filter(t => t.id !== tempId);
      store.setTasks([data, ...tasks]);
    }

    return { data, error };
  }

  async updateTask(id, updates) {
    const tasks = store.getTasks().map(task =>
      task.id === id ? { ...task, ...updates } : task
    );
    store.setTasks(tasks);

    const { data, error } = await this.update(Tables.TASKS, id, updates);

    return { data, error };
  }

  async deleteTask(id) {
    const tasks = store.getTasks().filter(task => task.id !== id);
    store.setTasks(tasks);

    const { data, error } = await this.delete(Tables.TASKS, id);

    return { data, error };
  }

  async loadTasks() {
    const household = store.getHousehold();
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
    const household = store.getHousehold();
    const user = auth.currentUser;
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
      created_by: user?.uid || null
    };

    const tempId = `temp_${Date.now()}`;
    const tempClifford = { ...clifford, id: tempId, created_at: new Date().toISOString() };
    store.setClifford([tempClifford, ...store.getClifford()]);

    const { data, error } = await this.insert(Tables.CLIFFORD, clifford);

    if (data) {
      const cliffords = store.getClifford().filter(c => c.id !== tempId);
      store.setClifford([data, ...cliffords]);
    }

    return { data, error };
  }

  async updateClifford(id, updates) {
    const cliffords = store.getClifford().map(clifford =>
      clifford.id === id ? { ...clifford, ...updates } : clifford
    );
    store.setClifford(cliffords);

    const { data, error } = await this.update(Tables.CLIFFORD, id, updates);

    return { data, error };
  }

  async deleteClifford(id) {
    const cliffords = store.getClifford().filter(clifford => clifford.id !== id);
    store.setClifford(cliffords);

    const { data, error } = await this.delete(Tables.CLIFFORD, id);

    return { data, error };
  }

  async loadClifford() {
    const household = store.getHousehold();
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
    const user = auth.currentUser;
    if (!user) {
      return { data: [], error: null };
    }

    const { data, error } = await this.fetch(Tables.PERSONAL_TASKS, {
      user_id: user.uid
    });

    if (!error && data) {
      store.setPersonalTasks(data);
    }

    return { data, error };
  }

  async addPersonalTask(name, dueDate, notes) {
    const user = auth.currentUser;
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const item = {
      user_id: user.uid,
      name,
      notes: notes || '',
      due_date: dueDate || null,
      completed: false
    };

    const { data, error } = await this.insert(Tables.PERSONAL_TASKS, item);

    if (!error && data) {
      const current = store.getPersonalTasks();
      store.setPersonalTasks([...current, data]);
    }

    return { data, error };
  }

  async updatePersonalTask(id, updates) {
    const { data, error} = await this.update(Tables.PERSONAL_TASKS, id, updates);

    if (!error && data) {
      const current = store.getPersonalTasks();
      const updated = current.map(item => item.id === id ? { ...item, ...data } : item);
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
    const household = store.getHousehold();
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
    const household = store.getHousehold();
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
