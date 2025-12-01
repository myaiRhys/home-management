import { store } from './store.js';
import { db } from './database.js';
import { authManager } from './auth.js';
import { queueManager } from './queue.js';
import { connectionManager } from './connection.js';

// Translations
const translations = {
  en: {
    appName: 'Thibault',
    dashboard: 'Dashboard',
    shopping: 'Shopping',
    tasks: 'Tasks',
    clifford: 'Clifford',
    settings: 'Settings',
    addItem: 'Add Item',
    addTask: 'Add Task',
    toBuy: 'To Buy',
    purchased: 'Purchased',
    completed: 'Completed',
    active: 'Active',
    quickAdd: 'Quick Add',
    today: 'Today',
    tomorrow: 'Tomorrow',
    overdue: 'Overdue',
    dueDate: 'Due Date',
    assignee: 'Assignee',
    notes: 'Notes',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    loading: 'Loading...',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    signOut: 'Sign Out',
    createAccount: 'Create Account',
    alreadyHaveAccount: 'Already have an account?',
    dontHaveAccount: "Don't have an account?",
    createHousehold: 'Create Household',
    joinHousehold: 'Join Household',
    householdName: 'Household Name',
    inviteCode: 'Invite Code',
    householdMembers: 'Household Members',
    manageQuickAdd: 'Manage Quick Add',
    theme: 'Theme',
    language: 'Language',
    dark: 'Dark',
    light: 'Light',
    online: 'Online',
    offline: 'Offline',
    syncing: 'Syncing...',
    pending: 'Pending',
    upcoming: 'Upcoming',
    noItems: 'No items',
    name: 'Name',
    copyInviteCode: 'Copy Invite Code',
    inviteCodeCopied: 'Invite code copied!',
    admin: 'Admin',
    member: 'Member'
  },
  af: {
    appName: 'Thibault',
    dashboard: 'Paneelbord',
    shopping: 'Inkopies',
    tasks: 'Take',
    clifford: 'Clifford',
    settings: 'Instellings',
    addItem: 'Voeg Item By',
    addTask: 'Voeg Taak By',
    toBuy: 'Te Koop',
    purchased: 'Gekoop',
    completed: 'Voltooi',
    active: 'Aktief',
    quickAdd: 'Vinnig Byvoeg',
    today: 'Vandag',
    tomorrow: 'Môre',
    overdue: 'Agterstallig',
    dueDate: 'Vervaldatum',
    assignee: 'Toegewys Aan',
    notes: 'Notas',
    save: 'Stoor',
    cancel: 'Kanselleer',
    delete: 'Verwyder',
    edit: 'Wysig',
    loading: 'Laai...',
    email: 'E-pos',
    password: 'Wagwoord',
    signIn: 'Teken In',
    signUp: 'Registreer',
    signOut: 'Teken Uit',
    createAccount: 'Skep Rekening',
    alreadyHaveAccount: 'Het reeds \'n rekening?',
    dontHaveAccount: 'Het nie \'n rekening nie?',
    createHousehold: 'Skep Huishouding',
    joinHousehold: 'Sluit Aan By Huishouding',
    householdName: 'Huishouding Naam',
    inviteCode: 'Uitnodigingskode',
    householdMembers: 'Huishouding Lede',
    manageQuickAdd: 'Bestuur Vinnig Byvoeg',
    theme: 'Tema',
    language: 'Taal',
    dark: 'Donker',
    light: 'Lig',
    online: 'Aanlyn',
    offline: 'Vanlyn',
    syncing: 'Sinkroniseer...',
    pending: 'Hangend',
    upcoming: 'Opkomend',
    noItems: 'Geen items',
    name: 'Naam',
    copyInviteCode: 'Kopieer Uitnodigingskode',
    inviteCodeCopied: 'Uitnodigingskode gekopieer!',
    admin: 'Administrateur',
    member: 'Lid'
  }
};

/**
 * UI Manager
 * Handles all rendering and UI interactions
 */
class UIManager {
  constructor() {
    this.currentToast = null;
  }

  /**
   * Get translation
   */
  t(key) {
    const lang = store.getLanguage();
    return translations[lang]?.[key] || translations.en[key] || key;
  }

  /**
   * Initialize UI
   */
  initialize() {
    // Set initial theme
    document.documentElement.setAttribute('data-theme', store.getTheme());

    // Subscribe to state changes
    store.subscribe((state, prevState) => {
      // Re-render on view change
      if (state.currentView !== prevState?.currentView) {
        this.render();
      }

      // Update connection indicator
      if (state.connectionState !== prevState?.connectionState) {
        this.updateConnectionIndicator();
      }

      // Update other UI elements as needed
      if (state.language !== prevState?.language || state.theme !== prevState?.theme) {
        this.render();
      }
    });

    // Subscribe to connection state
    connectionManager.subscribe((state) => {
      store.setConnectionState(state);
    });

    // Initial render
    this.render();

    // Setup event delegation
    this.setupEventListeners();
  }

  /**
   * Main render function
   */
  render() {
    const state = store.getState();
    const app = document.getElementById('app');

    // Show splash screen if loading
    if (state.loading) {
      app.innerHTML = this.renderSplash();
      return;
    }

    // Show auth screen if not authenticated
    if (!state.user || !state.household) {
      app.innerHTML = this.renderAuth();
      return;
    }

    // Show main app
    app.innerHTML = this.renderMainApp();

    // Update connection indicator
    this.updateConnectionIndicator();
  }

  /**
   * Render splash screen
   */
  renderSplash() {
    return `
      <div class="splash">
        <div class="splash-content">
          <h1>${this.t('appName')}</h1>
          <div class="spinner"></div>
        </div>
      </div>
    `;
  }

  /**
   * Render auth screen
   */
  renderAuth() {
    const state = store.getState();

    if (!state.user) {
      return this.renderAuthForm();
    }

    if (!state.household) {
      return this.renderHouseholdSetup();
    }
  }

  /**
   * Render auth form (login/signup)
   */
  renderAuthForm() {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <h1>${this.t('appName')}</h1>
          <form id="auth-form" class="auth-form">
            <input
              type="email"
              id="auth-email"
              placeholder="${this.t('email')}"
              required
              autocomplete="email"
            />
            <input
              type="password"
              id="auth-password"
              placeholder="${this.t('password')}"
              required
              autocomplete="current-password"
              minlength="6"
            />
            <button type="submit" class="btn btn-primary" data-action="sign-in">
              ${this.t('signIn')}
            </button>
            <button type="button" class="btn btn-secondary" data-action="sign-up">
              ${this.t('createAccount')}
            </button>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Render household setup
   */
  renderHouseholdSetup() {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <h2>${this.t('createHousehold')}</h2>
          <form id="create-household-form" class="auth-form">
            <input
              type="text"
              id="household-name"
              placeholder="${this.t('householdName')}"
              required
            />
            <button type="submit" class="btn btn-primary">
              ${this.t('createHousehold')}
            </button>
          </form>

          <div class="divider">OR</div>

          <h2>${this.t('joinHousehold')}</h2>
          <form id="join-household-form" class="auth-form">
            <input
              type="text"
              id="invite-code"
              placeholder="${this.t('inviteCode')}"
              required
              maxlength="6"
              style="text-transform: uppercase"
            />
            <button type="submit" class="btn btn-primary">
              ${this.t('joinHousehold')}
            </button>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Render main app
   */
  renderMainApp() {
    const view = store.getCurrentView();
    return `
      <div class="app-container">
        <div class="connection-indicator" id="connection-indicator"></div>
        <div class="app-content" id="app-content">
          ${this.renderView(view)}
        </div>
        <nav class="bottom-nav">
          ${this.renderBottomNav()}
        </nav>
      </div>
    `;
  }

  /**
   * Render view based on current view
   */
  renderView(view) {
    switch (view) {
      case 'dashboard':
        return this.renderDashboard();
      case 'shopping':
        return this.renderShopping();
      case 'tasks':
        return this.renderTasks();
      case 'clifford':
        return this.renderClifford();
      case 'settings':
        return this.renderSettings();
      default:
        return this.renderDashboard();
    }
  }

  /**
   * Render bottom navigation
   */
  renderBottomNav() {
    const view = store.getCurrentView();
    const tabs = [
      { id: 'dashboard', label: this.t('dashboard'), icon: '📊' },
      { id: 'shopping', label: this.t('shopping'), icon: '🛒' },
      { id: 'tasks', label: this.t('tasks'), icon: '✓' },
      { id: 'clifford', label: this.t('clifford'), icon: '👶' },
      { id: 'settings', label: this.t('settings'), icon: '⚙️' }
    ];

    return tabs.map(tab => `
      <button
        class="nav-tab ${view === tab.id ? 'active' : ''}"
        data-action="navigate"
        data-view="${tab.id}"
      >
        <span class="nav-icon">${tab.icon}</span>
        <span class="nav-label">${tab.label}</span>
      </button>
    `).join('');
  }

  /**
   * Render dashboard
   */
  renderDashboard() {
    const shopping = store.getShopping().filter(item => !item.purchased);
    const tasks = store.getTasks().filter(task => !task.completed);
    const clifford = store.getClifford().filter(item => !item.completed);

    return `
      <div class="view-container">
        <h1>${this.t('dashboard')}</h1>

        <div class="dashboard-cards">
          <div class="dashboard-card" data-action="navigate" data-view="shopping">
            <div class="card-icon">🛒</div>
            <div class="card-content">
              <h3>${this.t('shopping')}</h3>
              <p class="card-count">${shopping.length} ${this.t('toBuy').toLowerCase()}</p>
            </div>
          </div>

          <div class="dashboard-card" data-action="navigate" data-view="tasks">
            <div class="card-icon">✓</div>
            <div class="card-content">
              <h3>${this.t('tasks')}</h3>
              <p class="card-count">${tasks.length} ${this.t('active').toLowerCase()}</p>
            </div>
          </div>

          <div class="dashboard-card" data-action="navigate" data-view="clifford">
            <div class="card-icon">👶</div>
            <div class="card-content">
              <h3>${this.t('clifford')}</h3>
              <p class="card-count">${clifford.length} ${this.t('active').toLowerCase()}</p>
            </div>
          </div>
        </div>

        ${this.renderUpcoming()}
      </div>
    `;
  }

  /**
   * Render upcoming tasks
   */
  renderUpcoming() {
    const tasks = store.getTasks()
      .filter(task => !task.completed && task.due_date)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5);

    const clifford = store.getClifford()
      .filter(item => !item.completed && item.due_date)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5);

    if (tasks.length === 0 && clifford.length === 0) {
      return '';
    }

    return `
      <div class="upcoming-section">
        <h2>${this.t('upcoming')}</h2>

        ${tasks.length > 0 ? `
          <div class="upcoming-group">
            <h3>${this.t('tasks')}</h3>
            <div class="list">
              ${tasks.map(task => this.renderTaskItem(task, true)).join('')}
            </div>
          </div>
        ` : ''}

        ${clifford.length > 0 ? `
          <div class="upcoming-group">
            <h3>${this.t('clifford')}</h3>
            <div class="list">
              ${clifford.map(item => this.renderTaskItem(item, true)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render shopping list
   */
  renderShopping() {
    const items = store.getShopping();
    const toBuy = items.filter(item => !item.purchased);
    const purchased = items.filter(item => item.purchased);
    const quickAdd = store.getQuickAdd('shopping');

    return `
      <div class="view-container">
        <div class="view-header">
          <h1>${this.t('shopping')}</h1>
          <button class="btn btn-icon" data-action="show-add-form" data-type="shopping">+</button>
        </div>

        ${quickAdd.length > 0 ? `
          <div class="quick-add-section">
            <div class="quick-add-label">${this.t('quickAdd')}</div>
            <div class="quick-add-buttons">
              ${quickAdd.map(item => `
                <button
                  class="quick-add-btn"
                  data-action="quick-add-item"
                  data-type="shopping"
                  data-name="${this.escapeHtml(item.name)}"
                >
                  ${this.escapeHtml(item.name)}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="list-section">
          <div class="list-section-header" data-action="toggle-section" data-section="to-buy">
            <h2>${this.t('toBuy')} (${toBuy.length})</h2>
            <span class="collapse-icon">▼</span>
          </div>
          <div class="list" id="to-buy-list">
            ${toBuy.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : toBuy.map(item => this.renderShoppingItem(item)).join('')}
          </div>
        </div>

        <div class="list-section collapsed">
          <div class="list-section-header" data-action="toggle-section" data-section="purchased">
            <h2>${this.t('purchased')} (${purchased.length})</h2>
            <span class="collapse-icon">▼</span>
          </div>
          <div class="list" id="purchased-list" style="display: none;">
            ${purchased.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : purchased.map(item => this.renderShoppingItem(item)).join('')}
          </div>
        </div>

        <div id="add-form-container"></div>
      </div>
    `;
  }

  /**
   * Render shopping item
   */
  renderShoppingItem(item) {
    const isPending = queueManager.hasPendingOperations('shopping', item.id);

    return `
      <div class="list-item ${item.purchased ? 'completed' : ''} ${isPending ? 'pending' : ''}" data-id="${item.id}">
        <input
          type="checkbox"
          class="item-checkbox"
          ${item.purchased ? 'checked' : ''}
          data-action="toggle-shopping"
          data-id="${item.id}"
        />
        <div class="item-content">
          <div class="item-name">${this.escapeHtml(item.name)}</div>
          ${item.notes ? `<div class="item-notes">${this.escapeHtml(item.notes)}</div>` : ''}
        </div>
        <div class="item-actions">
          ${isPending ? '<span class="pending-indicator">⏳</span>' : ''}
          <button class="btn-icon-small" data-action="edit-item" data-type="shopping" data-id="${item.id}">✎</button>
          <button class="btn-icon-small" data-action="delete-item" data-type="shopping" data-id="${item.id}">×</button>
        </div>
      </div>
    `;
  }

  /**
   * Render tasks list
   */
  renderTasks() {
    const items = store.getTasks();
    const active = items.filter(item => !item.completed);
    const completed = items.filter(item => item.completed);
    const quickAdd = store.getQuickAdd('tasks');

    return `
      <div class="view-container">
        <div class="view-header">
          <h1>${this.t('tasks')}</h1>
          <button class="btn btn-icon" data-action="show-add-form" data-type="tasks">+</button>
        </div>

        ${quickAdd.length > 0 ? `
          <div class="quick-add-section">
            <div class="quick-add-label">${this.t('quickAdd')}</div>
            <div class="quick-add-buttons">
              ${quickAdd.map(item => `
                <button
                  class="quick-add-btn"
                  data-action="quick-add-item"
                  data-type="tasks"
                  data-name="${this.escapeHtml(item.name)}"
                >
                  ${this.escapeHtml(item.name)}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="list-section">
          <div class="list-section-header" data-action="toggle-section" data-section="active-tasks">
            <h2>${this.t('active')} (${active.length})</h2>
            <span class="collapse-icon">▼</span>
          </div>
          <div class="list" id="active-tasks-list">
            ${active.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : active.map(item => this.renderTaskItem(item)).join('')}
          </div>
        </div>

        <div class="list-section collapsed">
          <div class="list-section-header" data-action="toggle-section" data-section="completed-tasks">
            <h2>${this.t('completed')} (${completed.length})</h2>
            <span class="collapse-icon">▼</span>
          </div>
          <div class="list" id="completed-tasks-list" style="display: none;">
            ${completed.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : completed.map(item => this.renderTaskItem(item)).join('')}
          </div>
        </div>

        <div id="add-form-container"></div>
      </div>
    `;
  }

  /**
   * Render clifford list
   */
  renderClifford() {
    const items = store.getClifford();
    const active = items.filter(item => !item.completed);
    const completed = items.filter(item => item.completed);
    const quickAdd = store.getQuickAdd('clifford');

    return `
      <div class="view-container">
        <div class="view-header">
          <h1>${this.t('clifford')}</h1>
          <button class="btn btn-icon" data-action="show-add-form" data-type="clifford">+</button>
        </div>

        ${quickAdd.length > 0 ? `
          <div class="quick-add-section">
            <div class="quick-add-label">${this.t('quickAdd')}</div>
            <div class="quick-add-buttons">
              ${quickAdd.map(item => `
                <button
                  class="quick-add-btn"
                  data-action="quick-add-item"
                  data-type="clifford"
                  data-name="${this.escapeHtml(item.name)}"
                >
                  ${this.escapeHtml(item.name)}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="list-section">
          <div class="list-section-header" data-action="toggle-section" data-section="active-clifford">
            <h2>${this.t('active')} (${active.length})</h2>
            <span class="collapse-icon">▼</span>
          </div>
          <div class="list" id="active-clifford-list">
            ${active.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : active.map(item => this.renderTaskItem(item)).join('')}
          </div>
        </div>

        <div class="list-section collapsed">
          <div class="list-section-header" data-action="toggle-section" data-section="completed-clifford">
            <h2>${this.t('completed')} (${completed.length})</h2>
            <span class="collapse-icon">▼</span>
          </div>
          <div class="list" id="completed-clifford-list" style="display: none;">
            ${completed.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : completed.map(item => this.renderTaskItem(item)).join('')}
          </div>
        </div>

        <div id="add-form-container"></div>
      </div>
    `;
  }

  /**
   * Render task item (used for both tasks and clifford)
   */
  renderTaskItem(item, compact = false) {
    const isPending = queueManager.hasPendingOperations(item.type || 'tasks', item.id);
    const dueStatus = this.getDueStatus(item.due_date);

    return `
      <div class="list-item ${item.completed ? 'completed' : ''} ${isPending ? 'pending' : ''}" data-id="${item.id}">
        <input
          type="checkbox"
          class="item-checkbox"
          ${item.completed ? 'checked' : ''}
          data-action="toggle-task"
          data-type="${item.type || 'tasks'}"
          data-id="${item.id}"
        />
        <div class="item-content">
          <div class="item-name">${this.escapeHtml(item.name)}</div>
          ${item.notes && !compact ? `<div class="item-notes">${this.escapeHtml(item.notes)}</div>` : ''}
          <div class="item-meta">
            ${item.assignee ? `<span class="badge">${this.escapeHtml(item.assignee)}</span>` : ''}
            ${item.due_date ? `<span class="badge badge-${dueStatus.class}">${dueStatus.text}</span>` : ''}
          </div>
        </div>
        ${!compact ? `
          <div class="item-actions">
            ${isPending ? '<span class="pending-indicator">⏳</span>' : ''}
            <button class="btn-icon-small" data-action="edit-item" data-type="${item.type || 'tasks'}" data-id="${item.id}">✎</button>
            <button class="btn-icon-small" data-action="delete-item" data-type="${item.type || 'tasks'}" data-id="${item.id}">×</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get due status for a date
   */
  getDueStatus(dueDate) {
    if (!dueDate) {
      return { text: '', class: '' };
    }

    const due = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (due < today) {
      return { text: this.t('overdue'), class: 'danger' };
    } else if (due.getTime() === today.getTime()) {
      return { text: this.t('today'), class: 'warning' };
    } else if (due.getTime() === tomorrow.getTime()) {
      return { text: this.t('tomorrow'), class: 'info' };
    } else {
      return { text: due.toLocaleDateString(), class: '' };
    }
  }

  /**
   * Render settings
   */
  renderSettings() {
    const household = authManager.getCurrentHousehold();
    const theme = store.getTheme();
    const language = store.getLanguage();

    return `
      <div class="view-container">
        <h1>${this.t('settings')}</h1>

        <div class="settings-section">
          <div class="setting-item">
            <label>${this.t('theme')}</label>
            <select id="theme-select" data-action="change-theme">
              <option value="dark" ${theme === 'dark' ? 'selected' : ''}>${this.t('dark')}</option>
              <option value="light" ${theme === 'light' ? 'selected' : ''}>${this.t('light')}</option>
            </select>
          </div>

          <div class="setting-item">
            <label>${this.t('language')}</label>
            <select id="language-select" data-action="change-language">
              <option value="en" ${language === 'en' ? 'selected' : ''}>English</option>
              <option value="af" ${language === 'af' ? 'selected' : ''}>Afrikaans</option>
            </select>
          </div>
        </div>

        ${household ? `
          <div class="settings-section">
            <h2>${household.name}</h2>
            <div class="setting-item">
              <label>${this.t('inviteCode')}</label>
              <div class="invite-code-container">
                <code class="invite-code">${household.invite_code}</code>
                <button class="btn btn-secondary" data-action="copy-invite-code">${this.t('copyInviteCode')}</button>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h3>${this.t('manageQuickAdd')}</h3>
            <button class="btn btn-secondary" data-action="manage-quick-add" data-type="shopping">
              ${this.t('shopping')}
            </button>
            <button class="btn btn-secondary" data-action="manage-quick-add" data-type="tasks">
              ${this.t('tasks')}
            </button>
            <button class="btn btn-secondary" data-action="manage-quick-add" data-type="clifford">
              ${this.t('clifford')}
            </button>
          </div>
        ` : ''}

        <div class="settings-section">
          <button class="btn btn-danger" data-action="sign-out">${this.t('signOut')}</button>
        </div>
      </div>
    `;
  }

  /**
   * Update connection indicator
   */
  updateConnectionIndicator() {
    const indicator = document.getElementById('connection-indicator');
    if (!indicator) return;

    const state = store.getState().connectionState;
    let className = 'offline';
    let text = this.t('offline');

    switch (state) {
      case 'connected':
        className = 'online';
        text = this.t('online');
        break;
      case 'connecting':
      case 'reconnecting':
        className = 'syncing';
        text = this.t('syncing');
        break;
    }

    indicator.className = `connection-indicator ${className}`;
    indicator.textContent = text;
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Remove existing toast
    if (this.currentToast) {
      this.currentToast.remove();
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    this.currentToast = toast;

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.remove();
      if (this.currentToast === toast) {
        this.currentToast = null;
      }
    }, 3000);
  }

  /**
   * Setup event listeners (event delegation)
   */
  setupEventListeners() {
    document.addEventListener('click', (e) => this.handleClick(e));
    document.addEventListener('submit', (e) => this.handleSubmit(e));
    document.addEventListener('change', (e) => this.handleChange(e));
  }

  /**
   * Handle click events
   */
  async handleClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    switch (action) {
      case 'navigate':
        e.preventDefault();
        store.setCurrentView(target.dataset.view);
        break;

      case 'toggle-section':
        this.toggleSection(target);
        break;

      case 'show-add-form':
        this.showAddForm(target.dataset.type);
        break;

      case 'quick-add-item':
        await this.quickAddItem(target.dataset.type, target.dataset.name);
        break;

      case 'toggle-shopping':
        await this.toggleShopping(target.dataset.id);
        break;

      case 'toggle-task':
        await this.toggleTask(target.dataset.type, target.dataset.id);
        break;

      case 'delete-item':
        await this.deleteItem(target.dataset.type, target.dataset.id);
        break;

      case 'edit-item':
        this.editItem(target.dataset.type, target.dataset.id);
        break;

      case 'copy-invite-code':
        this.copyInviteCode();
        break;

      case 'manage-quick-add':
        this.manageQuickAdd(target.dataset.type);
        break;

      case 'sign-out':
        await this.signOut();
        break;

      case 'sign-up':
        await this.signUp();
        break;
    }
  }

  /**
   * Handle form submissions
   */
  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;

    if (form.id === 'auth-form') {
      await this.signIn();
    } else if (form.id === 'create-household-form') {
      await this.createHousehold();
    } else if (form.id === 'join-household-form') {
      await this.joinHousehold();
    } else if (form.id === 'add-item-form') {
      await this.submitAddForm(form);
    }
  }

  /**
   * Handle change events
   */
  handleChange(e) {
    const target = e.target;
    const action = target.dataset?.action;

    if (action === 'change-theme') {
      store.setTheme(target.value);
    } else if (action === 'change-language') {
      store.setLanguage(target.value);
    }
  }

  /**
   * Toggle section (collapse/expand)
   */
  toggleSection(header) {
    const section = header.closest('.list-section');
    const list = section.querySelector('.list');
    const icon = header.querySelector('.collapse-icon');

    if (section.classList.contains('collapsed')) {
      section.classList.remove('collapsed');
      list.style.display = 'block';
      icon.textContent = '▼';
    } else {
      section.classList.add('collapsed');
      list.style.display = 'none';
      icon.textContent = '▶';
    }
  }

  /**
   * Show add form
   */
  showAddForm(type) {
    const container = document.getElementById('add-form-container');
    if (!container) return;

    const isShopping = type === 'shopping';

    container.innerHTML = `
      <div class="modal-overlay" data-action="close-modal">
        <div class="modal" onclick="event.stopPropagation()">
          <h2>${isShopping ? this.t('addItem') : this.t('addTask')}</h2>
          <form id="add-item-form">
            <input type="hidden" name="type" value="${type}">
            <input
              type="text"
              name="name"
              placeholder="${this.t('name')}"
              required
              autofocus
            />
            ${!isShopping ? `
              <input
                type="text"
                name="assignee"
                placeholder="${this.t('assignee')}"
              />
              <input
                type="date"
                name="due_date"
                placeholder="${this.t('dueDate')}"
              />
            ` : ''}
            <textarea
              name="notes"
              placeholder="${this.t('notes')}"
              rows="3"
            ></textarea>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" data-action="close-modal">${this.t('cancel')}</button>
              <button type="submit" class="btn btn-primary">${this.t('save')}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Add close handler
    container.querySelector('[data-action="close-modal"]').addEventListener('click', () => {
      container.innerHTML = '';
    });
  }

  /**
   * Submit add form
   */
  async submitAddForm(form) {
    const formData = new FormData(form);
    const type = formData.get('type');
    const name = formData.get('name');
    const notes = formData.get('notes') || '';

    if (type === 'shopping') {
      await db.addShoppingItem(name, notes);
    } else {
      const assignee = formData.get('assignee') || null;
      const dueDate = formData.get('due_date') || null;

      if (type === 'tasks') {
        await db.addTask(name, assignee, dueDate, notes);
      } else if (type === 'clifford') {
        await db.addClifford(name, assignee, dueDate, notes);
      }
    }

    // Close modal
    document.getElementById('add-form-container').innerHTML = '';
    this.showToast(`${name} added!`, 'success');
  }

  /**
   * Quick add item
   */
  async quickAddItem(type, name) {
    if (type === 'shopping') {
      await db.addShoppingItem(name);
    } else if (type === 'tasks') {
      await db.addTask(name);
    } else if (type === 'clifford') {
      await db.addClifford(name);
    }

    this.showToast(`${name} added!`, 'success');
  }

  /**
   * Toggle shopping item
   */
  async toggleShopping(id) {
    const item = store.getShopping().find(i => i.id === id);
    if (item) {
      await db.updateShoppingItem(id, { purchased: !item.purchased });
    }
  }

  /**
   * Toggle task
   */
  async toggleTask(type, id) {
    const items = type === 'tasks' ? store.getTasks() : store.getClifford();
    const item = items.find(i => i.id === id);

    if (item) {
      const updateFn = type === 'tasks' ? db.updateTask.bind(db) : db.updateClifford.bind(db);
      await updateFn(id, { completed: !item.completed });
    }
  }

  /**
   * Delete item
   */
  async deleteItem(type, id) {
    if (!confirm('Delete this item?')) return;

    if (type === 'shopping') {
      await db.deleteShoppingItem(id);
    } else if (type === 'tasks') {
      await db.deleteTask(id);
    } else if (type === 'clifford') {
      await db.deleteClifford(id);
    }

    this.showToast('Item deleted', 'success');
  }

  /**
   * Edit item
   */
  editItem(type, id) {
    // TODO: Implement edit functionality
    this.showToast('Edit functionality coming soon', 'info');
  }

  /**
   * Copy invite code
   */
  async copyInviteCode() {
    const household = authManager.getCurrentHousehold();
    if (!household) return;

    try {
      await navigator.clipboard.writeText(household.invite_code);
      this.showToast(this.t('inviteCodeCopied'), 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showToast('Failed to copy', 'error');
    }
  }

  /**
   * Manage quick add
   */
  manageQuickAdd(type) {
    // TODO: Implement quick add management
    this.showToast('Quick Add management coming soon', 'info');
  }

  /**
   * Sign in
   */
  async signIn() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    store.setLoading(true);
    const { error } = await authManager.signIn(email, password);
    store.setLoading(false);

    if (error) {
      this.showToast(error.message, 'error');
    }
  }

  /**
   * Sign up
   */
  async signUp() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if (password.length < 6) {
      this.showToast('Password must be at least 6 characters', 'error');
      return;
    }

    store.setLoading(true);
    const { error } = await authManager.signUp(email, password);
    store.setLoading(false);

    if (error) {
      this.showToast(error.message, 'error');
    } else {
      this.showToast('Account created! Please sign in.', 'success');
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    if (!confirm('Sign out?')) return;

    await authManager.signOut();
  }

  /**
   * Create household
   */
  async createHousehold() {
    const name = document.getElementById('household-name').value;

    store.setLoading(true);
    const { data, error } = await db.createHousehold(name);
    store.setLoading(false);

    if (error) {
      this.showToast(error.message, 'error');
    } else {
      this.showToast(`Household "${name}" created!`, 'success');
    }
  }

  /**
   * Join household
   */
  async joinHousehold() {
    const code = document.getElementById('invite-code').value.toUpperCase();

    store.setLoading(true);
    const { data, error } = await db.joinHousehold(code);
    store.setLoading(false);

    if (error) {
      this.showToast(error.message, 'error');
    } else {
      this.showToast(`Joined ${data.name}!`, 'success');
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Singleton instance
export const ui = new UIManager();
