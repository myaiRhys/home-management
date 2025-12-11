import { STORAGE_KEYS } from './config.js';

/**
 * Centralized State Management
 * Single source of truth for app state
 */
class Store {
  constructor() {
    this.state = {
      // User & Auth
      user: null,
      household: null,
      householdMembers: [],

      // Data
      shopping: [],
      tasks: [],
      clifford: [],
      personalTasks: [],
      quickAdd: {
        shopping: [],
        tasks: [],
        clifford: []
      },

      // Notifications
      notifications: [],
      notificationPreferences: {
        task_assigned: true,
        shopping_added: true,
        task_completed: false,
        clifford_assigned: true
      },
      showNotificationPanel: false,

      // UI State
      currentView: 'dashboard', // dashboard, shopping, tasks, clifford, settings
      tasksDrawer: 'household', // 'household' or 'personal'
      theme: 'dark',
      language: 'en',
      loading: false,
      connectionState: 'offline',
      sortPreferences: {
        shopping: 'recent',
        tasks: 'recent',
        clifford: 'recent',
        personal: 'recent'
      },

      // Modals & Forms
      showModal: null, // null, 'quick-add-shopping', 'quick-add-tasks', etc.
      editingItem: null
    };

    this.listeners = new Map(); // view -> Set of callbacks

    // Load persisted state
    this.loadPersistedState();
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Update state and notify listeners
   */
  setState(updates) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // Persist certain state
    this.persistState();

    // Notify listeners
    this.notifyListeners(prevState);
  }

  /**
   * Subscribe to state changes
   * @param {string} view - Optional view name to filter updates
   * @param {function} callback - Callback function
   */
  subscribe(callback, view = 'global') {
    if (!this.listeners.has(view)) {
      this.listeners.set(view, new Set());
    }
    this.listeners.get(view).add(callback);

    // Immediately call with current state
    callback(this.state);

    // Return unsubscribe function
    return () => {
      const viewListeners = this.listeners.get(view);
      if (viewListeners) {
        viewListeners.delete(callback);
      }
    };
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners(prevState) {
    // Notify global listeners
    const globalListeners = this.listeners.get('global');
    if (globalListeners) {
      globalListeners.forEach(callback => {
        try {
          callback(this.state, prevState);
        } catch (error) {
          console.error('Error in state listener:', error);
        }
      });
    }

    // Notify view-specific listeners
    const currentView = this.state.currentView;
    const viewListeners = this.listeners.get(currentView);
    if (viewListeners) {
      viewListeners.forEach(callback => {
        try {
          callback(this.state, prevState);
        } catch (error) {
          console.error(`Error in ${currentView} listener:`, error);
        }
      });
    }
  }

  /**
   * Load persisted state from localStorage
   */
  loadPersistedState() {
    try {
      // Theme
      const theme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (theme) {
        this.state.theme = theme;
      }

      // Language
      const language = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (language) {
        this.state.language = language;
      }

      // User
      const user = localStorage.getItem(STORAGE_KEYS.USER);
      if (user) {
        this.state.user = JSON.parse(user);
      }

      // Household
      const household = localStorage.getItem(STORAGE_KEYS.HOUSEHOLD);
      if (household) {
        this.state.household = JSON.parse(household);
      }

      // Sort preferences
      const sortPreferences = localStorage.getItem('thibault_sort_preferences');
      if (sortPreferences) {
        this.state.sortPreferences = JSON.parse(sortPreferences);
      }

      // Notification preferences
      const notificationPrefs = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFS);
      if (notificationPrefs) {
        this.state.notificationPreferences = JSON.parse(notificationPrefs);
      }

    } catch (error) {
      console.error('Error loading persisted state:', error);
    }
  }

  /**
   * Persist state to localStorage
   */
  persistState() {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, this.state.theme);
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, this.state.language);

      if (this.state.user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.state.user));
      }

      if (this.state.household) {
        localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(this.state.household));
      }

      // Persist sort preferences
      localStorage.setItem('thibault_sort_preferences', JSON.stringify(this.state.sortPreferences));

      // Persist notification preferences
      localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFS, JSON.stringify(this.state.notificationPreferences));
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  }

  /**
   * Clear user data (on logout)
   */
  clearUserData() {
    this.setState({
      user: null,
      household: null,
      householdMembers: [],
      shopping: [],
      tasks: [],
      clifford: [],
      quickAdd: {
        shopping: [],
        tasks: [],
        clifford: []
      },
      notifications: [],
      showNotificationPanel: false
    });

    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.HOUSEHOLD);
  }

  // Convenience getters
  getUser() {
    return this.state.user;
  }

  getHousehold() {
    return this.state.household;
  }

  getShopping() {
    return this.state.shopping;
  }

  getTasks() {
    return this.state.tasks;
  }

  getClifford() {
    return this.state.clifford;
  }

  getPersonalTasks() {
    return this.state.personalTasks;
  }

  getQuickAdd(type) {
    return this.state.quickAdd[type] || [];
  }

  getCurrentView() {
    return this.state.currentView;
  }

  getTheme() {
    return this.state.theme;
  }

  getLanguage() {
    return this.state.language;
  }

  getHouseholdMembers() {
    return this.state.householdMembers;
  }

  // Convenience setters
  setUser(user) {
    this.setState({ user });
  }

  setHousehold(household) {
    this.setState({ household });
  }

  setHouseholdMembers(householdMembers) {
    this.setState({ householdMembers });
  }

  setShopping(shopping) {
    this.setState({ shopping });
  }

  setTasks(tasks) {
    this.setState({ tasks });
  }

  setClifford(clifford) {
    this.setState({ clifford });
  }

  setPersonalTasks(personalTasks) {
    this.setState({ personalTasks });
  }

  setQuickAdd(type, items) {
    this.setState({
      quickAdd: {
        ...this.state.quickAdd,
        [type]: items
      }
    });
  }

  setCurrentView(view) {
    this.setState({ currentView: view });
  }

  setTheme(theme) {
    this.setState({ theme });
    document.documentElement.setAttribute('data-theme', theme);
  }

  setLanguage(language) {
    this.setState({ language });
  }

  setLoading(loading) {
    this.setState({ loading });
  }

  setConnectionState(connectionState) {
    this.setState({ connectionState });
  }

  setShowModal(showModal) {
    this.setState({ showModal });
  }

  setEditingItem(editingItem) {
    this.setState({ editingItem });
  }

  getTasksDrawer() {
    return this.state.tasksDrawer;
  }

  setTasksDrawer(tasksDrawer) {
    this.setState({ tasksDrawer });
  }

  getSortPreference(view) {
    return this.state.sortPreferences[view] || 'recent';
  }

  setSortPreference(view, sort) {
    this.setState({
      sortPreferences: {
        ...this.state.sortPreferences,
        [view]: sort
      }
    });
  }

  // Notification getters
  getNotifications() {
    return this.state.notifications;
  }

  getUnreadNotifications() {
    return this.state.notifications.filter(n => !n.read);
  }

  getUnreadCount() {
    return this.state.notifications.filter(n => !n.read).length;
  }

  getNotificationPreferences() {
    return this.state.notificationPreferences;
  }

  getShowNotificationPanel() {
    return this.state.showNotificationPanel;
  }

  // Notification setters
  setNotifications(notifications) {
    this.setState({ notifications });
  }

  addNotification(notification) {
    const notifications = [notification, ...this.state.notifications];
    this.setState({ notifications });
  }

  markNotificationAsRead(notificationId) {
    const notifications = this.state.notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    this.setState({ notifications });
  }

  markAllNotificationsAsRead() {
    const notifications = this.state.notifications.map(n => ({ ...n, read: true }));
    this.setState({ notifications });
  }

  removeNotification(notificationId) {
    const notifications = this.state.notifications.filter(n => n.id !== notificationId);
    this.setState({ notifications });
  }

  setNotificationPreferences(preferences) {
    this.setState({
      notificationPreferences: {
        ...this.state.notificationPreferences,
        ...preferences
      }
    });
  }

  setShowNotificationPanel(show) {
    this.setState({ showNotificationPanel: show });
  }

  toggleNotificationPanel() {
    this.setState({ showNotificationPanel: !this.state.showNotificationPanel });
  }

  // ============================
  // MERGE METHODS (for delta sync)
  // These intelligently merge server data without overwriting local changes
  // ============================

  /**
   * Merge incoming items with existing state
   * - Updates existing items if server version is newer
   * - Adds new items
   * - Preserves items with pending local changes
   *
   * @param {string} key - State key (shopping, tasks, clifford)
   * @param {Array} serverItems - Items from server
   * @param {Function} setter - Optional custom setter
   */
  mergeItems(key, serverItems) {
    if (!serverItems || serverItems.length === 0) return;

    const current = this.state[key] || [];
    const merged = [...current];

    for (const serverItem of serverItems) {
      const existingIndex = merged.findIndex(item => item.id === serverItem.id);

      if (existingIndex >= 0) {
        const existing = merged[existingIndex];

        // Don't overwrite items with pending local changes
        if (existing.pending) {
          console.log(`[Store] Skipping ${key} item ${serverItem.id} - has pending changes`);
          continue;
        }

        // Only update if server version is newer
        const serverUpdated = serverItem.updated_at || serverItem.created_at;
        const localUpdated = existing.updated_at || existing.created_at;

        if (serverUpdated >= localUpdated) {
          merged[existingIndex] = serverItem;
        }
      } else {
        // New item from server - add it
        merged.push(serverItem);
      }
    }

    // Sort by created_at desc (newest first)
    merged.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });

    this.setState({ [key]: merged });
  }

  /**
   * Full merge with deletion detection
   * - Merges all items
   * - Removes items that no longer exist on server (unless pending)
   *
   * @param {string} key - State key
   * @param {Array} serverItems - Complete list from server
   */
  fullMergeItems(key, serverItems) {
    if (!serverItems) return;

    const current = this.state[key] || [];
    const serverIds = new Set(serverItems.map(item => item.id));

    // Start with server items
    const merged = [...serverItems];

    // Add back any items with pending local changes that aren't on server
    // (they might be newly created and not yet synced)
    for (const localItem of current) {
      if (localItem.pending && !serverIds.has(localItem.id)) {
        merged.push(localItem);
      }
    }

    // Sort by created_at desc
    merged.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });

    this.setState({ [key]: merged });
  }

  // Convenience merge methods
  mergeShopping(items) {
    this.mergeItems('shopping', items);
  }

  mergeTasks(items) {
    this.mergeItems('tasks', items);
  }

  mergeClifford(items) {
    this.mergeItems('clifford', items);
  }

  fullMergeShopping(items) {
    this.fullMergeItems('shopping', items);
  }

  fullMergeTasks(items) {
    this.fullMergeItems('tasks', items);
  }

  fullMergeClifford(items) {
    this.fullMergeItems('clifford', items);
  }

  /**
   * Mark an item as having pending local changes
   * Call this before making optimistic updates
   */
  markPending(key, itemId) {
    const items = this.state[key] || [];
    const updated = items.map(item =>
      item.id === itemId ? { ...item, pending: true } : item
    );
    this.setState({ [key]: updated });
  }

  /**
   * Clear pending flag from an item
   * Call this after server confirms the change
   */
  clearPending(key, itemId) {
    const items = this.state[key] || [];
    const updated = items.map(item =>
      item.id === itemId ? { ...item, pending: false } : item
    );
    this.setState({ [key]: updated });
  }
}

// Singleton instance
export const store = new Store();
