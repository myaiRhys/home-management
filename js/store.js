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
      quickAdd: {
        shopping: [],
        tasks: [],
        clifford: []
      },

      // UI State
      currentView: 'dashboard', // dashboard, shopping, tasks, clifford, settings
      theme: 'dark',
      language: 'en',
      loading: false,
      connectionState: 'offline',

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
      }
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
}

// Singleton instance
export const store = new Store();
