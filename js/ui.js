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
    personal: 'Personal',
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
    member: 'Member',
    you: 'You',
    noMembers: 'No members yet',
    removeMember: 'Remove member',
    confirmRemoveMember: 'Are you sure you want to remove {email} from the household?',
    memberRemoved: 'Member removed successfully',
    displayName: 'Display Name',
    updateDisplayName: 'Update Name',
    displayNameUpdated: 'Display name updated!',
    clearCompleted: 'Clear All',
    confirmClearCompleted: 'Delete all completed items? This cannot be undone.',
    clearedCompleted: 'Completed items cleared!',
    childName: 'Child Name',
    updateName: 'Update Name',
    nameUpdated: 'Name updated successfully!',
    addQuickAdd: 'Add Quick Add',
    noQuickAddItems: 'No quick add items yet',
    quickAddItemAdded: 'Quick add item added!',
    quickAddItemDeleted: 'Quick add item deleted!'
  },
  af: {
    appName: 'Thibault',
    dashboard: 'Paneelbord',
    shopping: 'Inkopies',
    tasks: 'Take',
    clifford: 'Clifford',
    personal: 'Persoonlik',
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
    member: 'Lid',
    you: 'Jy',
    noMembers: 'Nog geen lede nie',
    removeMember: 'Verwyder lid',
    confirmRemoveMember: 'Is jy seker jy wil {email} uit die huishouding verwyder?',
    memberRemoved: 'Lid suksesvol verwyder',
    displayName: 'Vertoonnaam',
    updateDisplayName: 'Opdateer Naam',
    displayNameUpdated: 'Vertoonnaam opgedateer!',
    clearCompleted: 'Maak Alles Skoon',
    confirmClearCompleted: 'Verwyder alle voltooide items? Dit kan nie ongedaan gemaak word nie.',
    clearedCompleted: 'Voltooide items verwyder!',
    childName: 'Kind Naam',
    updateName: 'Opdateer Naam',
    nameUpdated: 'Naam suksesvol opgedateer!',
    addQuickAdd: 'Voeg Vinnig Byvoeg By',
    noQuickAddItems: 'Nog geen vinnig byvoeg items nie',
    quickAddItemAdded: 'Vinnig byvoeg item bygevoeg!',
    quickAddItemDeleted: 'Vinnig byvoeg item verwyder!'
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
   * Get custom clifford name
   */
  getCliffordName() {
    const household = store.getHousehold();
    // Use custom name if set, otherwise fall back to translated 'clifford'
    return household?.custom_clifford_name || this.t('clifford');
  }

  /**
   * Initialize UI
   */
  initialize() {
    // Set initial theme
    document.documentElement.setAttribute('data-theme', store.getTheme());

    // Subscribe to state changes
    store.subscribe((state, prevState) => {
      // Re-render on loading state change
      if (state.loading !== prevState?.loading) {
        this.render();
      }

      // Re-render on view change
      if (state.currentView !== prevState?.currentView) {
        this.render();
      }

      // Re-render on tasks drawer change
      if (state.tasksDrawer !== prevState?.tasksDrawer) {
        this.render();
      }

      // Re-render on user/household change
      if (state.user !== prevState?.user || state.household !== prevState?.household) {
        this.render();
      }

      // Re-render on data changes (shopping, tasks, clifford, quickAdd)
      if (state.shopping !== prevState?.shopping ||
          state.tasks !== prevState?.tasks ||
          state.clifford !== prevState?.clifford ||
          JSON.stringify(state.quickAdd) !== JSON.stringify(prevState?.quickAdd)) {
        this.render();
      }

      // Update connection indicator
      if (state.connectionState !== prevState?.connectionState) {
        this.updateConnectionIndicator();
      }

      // Update other UI elements as needed
      if (state.language !== prevState?.language ||
          state.theme !== prevState?.theme ||
          JSON.stringify(state.sortPreferences) !== JSON.stringify(prevState?.sortPreferences)) {
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
          <div class="pull-to-refresh-indicator" id="pull-indicator">
            <div class="spinner"></div>
          </div>
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
      { id: 'clifford', label: this.getCliffordName(), icon: '👶' },
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
    const shopping = store.getShopping().filter(item => !item.completed);
    const tasks = store.getTasks().filter(task => !task.completed);
    const clifford = store.getClifford().filter(item => !item.completed);
    const personal = store.getPersonalTasks().filter(item => !item.completed);

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
              <h3>${this.getCliffordName()}</h3>
              <p class="card-count">${clifford.length} ${this.t('active').toLowerCase()}</p>
            </div>
          </div>

          <div class="dashboard-card" data-action="navigate-personal">
            <div class="card-icon">📝</div>
            <div class="card-content">
              <h3>${this.t('personal')}</h3>
              <p class="card-count">${personal.length} ${this.t('active').toLowerCase()}</p>
            </div>
          </div>
        </div>

        ${this.renderUpcoming()}

        <div id="add-form-container"></div>
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
              ${tasks.map(task => this.renderTaskItem(task, true, 'tasks')).join('')}
            </div>
          </div>
        ` : ''}

        ${clifford.length > 0 ? `
          <div class="upcoming-group">
            <h3>${this.getCliffordName()}</h3>
            <div class="list">
              ${clifford.map(item => this.renderTaskItem(item, true, 'clifford')).join('')}
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
    const sortBy = store.getSortPreference('shopping');
    const toBuy = this.sortItems(items.filter(item => !item.completed), sortBy);
    const purchased = this.sortItems(items.filter(item => item.completed), sortBy);
    const quickAdd = store.getQuickAdd('shopping');

    return `
      <div class="view-container">
        <div class="view-header">
          <h1>${this.t('shopping')}</h1>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${this.renderSortDropdown('shopping')}
            <button class="btn btn-icon" data-action="show-add-form" data-type="shopping">+</button>
          </div>
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
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ${purchased.length > 0 ? `
                <button
                  class="btn btn-secondary btn-sm"
                  data-action="clear-completed"
                  data-type="shopping"
                  style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                >
                  ${this.t('clearCompleted')}
                </button>
              ` : ''}
              <span class="collapse-icon">▼</span>
            </div>
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
    const quantity = item.quantity || 1;
    const quantityPrefix = quantity > 1 ? `${quantity}× ` : '';
    const creatorInitials = this.getCreatorInitials(item.created_by);

    return `
      <div class="list-item ${item.completed ? 'completed' : ''} ${isPending ? 'pending' : ''}" data-id="${item.id}">
        <input
          type="checkbox"
          class="item-checkbox"
          ${item.completed ? 'checked' : ''}
          data-action="toggle-shopping"
          data-id="${item.id}"
        />
        <div class="item-content">
          <div class="item-name">${quantityPrefix}${this.escapeHtml(item.name)}</div>
          ${item.notes ? `<div class="item-notes">${this.escapeHtml(item.notes)}</div>` : ''}
        </div>
        <div class="item-actions">
          ${creatorInitials ? `<span class="creator-initials">${creatorInitials}</span>` : ''}
          ${isPending ? '<span class="pending-indicator">⏳</span>' : ''}
          <button class="btn-icon-small" data-action="edit-item" data-type="shopping" data-id="${item.id}">✎</button>
          <button class="btn-icon-small" data-action="delete-item" data-type="shopping" data-id="${item.id}">×</button>
        </div>
      </div>
    `;
  }

  /**
   * Render tasks list with drawer for household/personal
   */
  renderTasks() {
    const drawer = store.getTasksDrawer();
    const isPersonal = drawer === 'personal';

    // Get items based on drawer
    const items = isPersonal ? store.getPersonalTasks() : store.getTasks();
    const type = isPersonal ? 'personal' : 'tasks';
    const sortBy = store.getSortPreference(type);
    const active = this.sortItems(items.filter(item => !item.completed), sortBy);
    const completed = this.sortItems(items.filter(item => item.completed), sortBy);
    const quickAdd = isPersonal ? [] : store.getQuickAdd('tasks');

    return `
      <div class="view-container">
        <div class="view-header">
          <h1>${this.t('tasks')}</h1>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${this.renderSortDropdown(type)}
            <button class="btn btn-icon" data-action="show-add-form" data-type="${type}">+</button>
          </div>
        </div>

        <div class="tasks-drawer">
          <button
            class="drawer-btn ${drawer === 'household' ? 'active' : ''}"
            data-action="switch-tasks-drawer"
            data-drawer="household"
          >
            Household Tasks
          </button>
          <button
            class="drawer-btn ${drawer === 'personal' ? 'active' : ''}"
            data-action="switch-tasks-drawer"
            data-drawer="personal"
          >
            Personal Tasks
          </button>
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
          <div class="list-section-header" data-action="toggle-section" data-section="active-${type}">
            <h2>${this.t('active')} (${active.length})</h2>
            <span class="collapse-icon">▼</span>
          </div>
          <div class="list" id="active-${type}-list">
            ${active.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : active.map(item => this.renderTaskItem(item, false, type)).join('')}
          </div>
        </div>

        <div class="list-section collapsed">
          <div class="list-section-header" data-action="toggle-section" data-section="completed-${type}">
            <h2>${this.t('completed')} (${completed.length})</h2>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ${completed.length > 0 ? `
                <button
                  class="btn btn-secondary btn-sm"
                  data-action="clear-completed"
                  data-type="${type}"
                  style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                >
                  ${this.t('clearCompleted')}
                </button>
              ` : ''}
              <span class="collapse-icon">▼</span>
            </div>
          </div>
          <div class="list" id="completed-${type}-list" style="display: none;">
            ${completed.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : completed.map(item => this.renderTaskItem(item, false, type)).join('')}
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
    const sortBy = store.getSortPreference('clifford');
    const active = this.sortItems(items.filter(item => !item.completed), sortBy);
    const completed = this.sortItems(items.filter(item => item.completed), sortBy);
    const quickAdd = store.getQuickAdd('clifford');

    return `
      <div class="view-container">
        <div class="view-header">
          <h1>${this.getCliffordName()}</h1>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${this.renderSortDropdown('clifford')}
            <button class="btn btn-icon" data-action="show-add-form" data-type="clifford">+</button>
          </div>
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
            ${active.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : active.map(item => this.renderTaskItem(item, false, 'clifford')).join('')}
          </div>
        </div>

        <div class="list-section collapsed">
          <div class="list-section-header" data-action="toggle-section" data-section="completed-clifford">
            <h2>${this.t('completed')} (${completed.length})</h2>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ${completed.length > 0 ? `
                <button
                  class="btn btn-secondary btn-sm"
                  data-action="clear-completed"
                  data-type="clifford"
                  style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                >
                  ${this.t('clearCompleted')}
                </button>
              ` : ''}
              <span class="collapse-icon">▼</span>
            </div>
          </div>
          <div class="list" id="completed-clifford-list" style="display: none;">
            ${completed.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : completed.map(item => this.renderTaskItem(item, false, 'clifford')).join('')}
          </div>
        </div>

        <div id="add-form-container"></div>
      </div>
    `;
  }

  /**
   * Render personal tasks list (private to user)
   */
  renderPersonal() {
    const items = store.getPersonalTasks();
    const active = items.filter(item => !item.completed);
    const completed = items.filter(item => item.completed);

    return `
      <div class="view-container">
        <div class="view-header">
          <h1>${this.t('personal')}</h1>
          <button class="btn btn-icon" data-action="show-add-form" data-type="personal">+</button>
        </div>

        <div class="list-section">
          <div class="list-section-header" data-action="toggle-section" data-section="active-personal">
            <h2>${this.t('active')} (${active.length})</h2>
            <span class="collapse-icon">▼</span>
          </div>
          <div class="list" id="active-personal-list">
            ${active.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : active.map(item => this.renderTaskItem(item, false, 'personal')).join('')}
          </div>
        </div>

        <div class="list-section collapsed">
          <div class="list-section-header" data-action="toggle-section" data-section="completed-personal">
            <h2>${this.t('completed')} (${completed.length})</h2>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ${completed.length > 0 ? `
                <button
                  class="btn btn-secondary btn-sm"
                  data-action="clear-completed"
                  data-type="personal"
                  style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                >
                  ${this.t('clearCompleted')}
                </button>
              ` : ''}
              <span class="collapse-icon">▼</span>
            </div>
          </div>
          <div class="list" id="completed-personal-list" style="display: none;">
            ${completed.length === 0 ? `<p class="empty-message">${this.t('noItems')}</p>` : completed.map(item => this.renderTaskItem(item, false, 'personal')).join('')}
          </div>
        </div>

        <div id="add-form-container"></div>
      </div>
    `;
  }

  /**
   * Render task item (used for both tasks and clifford)
   */
  renderTaskItem(item, compact = false, type = 'tasks') {
    const isPending = queueManager.hasPendingOperations(type, item.id);
    const dueStatus = this.getDueStatus(item.due_date);
    const assigneeName = this.getMemberName(item.assignee);
    const creatorInitials = this.getCreatorInitials(item.created_by);

    return `
      <div class="list-item ${item.completed ? 'completed' : ''} ${isPending ? 'pending' : ''}" data-id="${item.id}">
        <input
          type="checkbox"
          class="item-checkbox"
          ${item.completed ? 'checked' : ''}
          data-action="toggle-task"
          data-type="${type}"
          data-id="${item.id}"
        />
        <div class="item-content">
          <div class="item-name">${this.escapeHtml(item.name)}</div>
          ${item.notes && !compact ? `<div class="item-notes">${this.escapeHtml(item.notes)}</div>` : ''}
          <div class="item-meta">
            ${assigneeName ? `<span class="badge">${this.escapeHtml(assigneeName)}</span>` : ''}
            ${item.due_date ? `<span class="badge badge-${dueStatus.class}">${dueStatus.text}</span>` : ''}
          </div>
        </div>
        ${!compact ? `
          <div class="item-actions">
            ${creatorInitials ? `<span class="creator-initials">${creatorInitials}</span>` : ''}
            ${isPending ? '<span class="pending-indicator">⏳</span>' : ''}
            <button class="btn-icon-small" data-action="edit-item" data-type="${type}" data-id="${item.id}">✎</button>
            <button class="btn-icon-small" data-action="delete-item" data-type="${type}" data-id="${item.id}">×</button>
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
    const currentUser = authManager.getCurrentUser();

    return `
      <div class="view-container">
        <h1>${this.t('settings')}</h1>

        ${household ? `
          <div class="settings-section">
            <h3>Personalization</h3>
            <div class="setting-item">
              <div style="flex: 1;">
                <label>${this.t('childName')}</label>
                <input
                  type="text"
                  id="custom-clifford-name"
                  placeholder="Enter child name"
                  value="${this.escapeHtml(household.custom_clifford_name || 'Clifford')}"
                  maxlength="20"
                  style="width: 100%; margin-top: 0.5rem; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);"
                />
              </div>
              <button
                class="btn btn-primary"
                data-action="update-clifford-name"
                style="margin-left: 0.5rem; align-self: flex-end;">
                ${this.t('updateName')}
              </button>
            </div>
          </div>
        ` : ''}

        <div class="settings-section">
          <h3>${this.t('displayName')}</h3>
          <div class="setting-item">
            <input
              type="text"
              id="display-name-input"
              placeholder="${this.t('displayName')}"
              value=""
              style="flex: 1; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);"
            />
            <button class="btn btn-primary" data-action="update-display-name" style="margin-left: 0.5rem;">
              ${this.t('updateDisplayName')}
            </button>
          </div>
        </div>

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
            <h3>${this.t('householdMembers')}</h3>
            ${this.renderHouseholdMembers()}
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
              ${this.getCliffordName()}
            </button>
          </div>
        ` : ''}

        <div class="settings-section">
          <button class="btn btn-danger" data-action="sign-out">${this.t('signOut')}</button>
        </div>

        <div id="add-form-container"></div>
      </div>
    `;
  }

  /**
   * Render household members list
   */
  renderHouseholdMembers() {
    const members = store.getHouseholdMembers();
    const currentUser = authManager.getCurrentUser();
    const household = authManager.getCurrentHousehold();
    const isAdmin = household && household.userRole === 'admin';

    if (!members || members.length === 0) {
      return `<p class="empty-message">${this.t('noMembers')}</p>`;
    }

    return `
      <div class="members-list">
        ${members.map(member => {
          const userEmail = member.users?.email || 'Unknown';
          const isCurrentUser = member.user_id === currentUser?.id;
          const roleText = this.t(member.role) || member.role;

          return `
            <div class="member-item">
              <div class="member-info">
                <div class="member-email">${this.escapeHtml(userEmail)}</div>
                <span class="badge ${member.role === 'admin' ? 'badge-warning' : ''}">${roleText}</span>
                ${isCurrentUser ? `<span class="badge">${this.t('you')}</span>` : ''}
              </div>
              ${isAdmin && !isCurrentUser ? `
                <button
                  class="btn-icon-small btn-danger"
                  data-action="remove-member"
                  data-member-id="${member.id}"
                  data-email="${this.escapeHtml(userEmail)}"
                  title="${this.t('removeMember')}">
                  ×
                </button>
              ` : ''}
            </div>
          `;
        }).join('')}
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
    console.log('[UI] Setting up event listeners...');
    document.addEventListener('click', (e) => this.handleClick(e));
    document.addEventListener('submit', (e) => this.handleSubmit(e));
    document.addEventListener('change', (e) => this.handleChange(e));
    console.log('[UI] Event listeners attached');
  }

  /**
   * Handle click events
   */
  async handleClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    console.log('[handleClick] Action triggered:', action, 'Element:', target);

    switch (action) {
      case 'navigate':
        e.preventDefault();
        store.setCurrentView(target.dataset.view);
        break;

      case 'navigate-personal':
        e.preventDefault();
        store.setTasksDrawer('personal');
        store.setCurrentView('tasks');
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

      case 'remove-member':
        await this.removeMember(target.dataset.memberId, target.dataset.email);
        break;

      case 'sign-out':
        await this.signOut();
        break;

      case 'sign-up':
        await this.signUp();
        break;

      case 'close-modal':
        this.closeModal();
        break;

      case 'update-display-name':
        await this.updateDisplayName();
        break;

      case 'update-clifford-name':
        await this.updateCliffordName();
        break;

      case 'clear-completed':
        await this.clearCompleted(target.dataset.type);
        break;

      case 'switch-tasks-drawer':
        store.setTasksDrawer(target.dataset.drawer);
        break;

      case 'delete-quick-add':
        await this.deleteQuickAdd(target.dataset.id, target.dataset.type);
        break;
    }
  }

  /**
   * Handle form submissions
   */
  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formId = form.getAttribute('id'); // Use getAttribute to avoid conflicts with named inputs

    console.log('[handleSubmit] Form submitted, ID:', formId);

    // Prevent duplicate submissions
    if (form.dataset.submitting === 'true') {
      console.log('[handleSubmit] Form already submitting, ignoring duplicate');
      return;
    }

    // Mark as submitting
    form.dataset.submitting = 'true';

    // Disable submit button
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Saving...';
    }

    try {
      if (formId === 'auth-form') {
        await this.signIn();
      } else if (formId === 'create-household-form') {
        await this.createHousehold();
      } else if (formId === 'join-household-form') {
        await this.joinHousehold();
      } else if (formId === 'add-item-form') {
        await this.submitAddForm(form);
      } else if (formId === 'edit-item-form') {
        console.log('[handleSubmit] Calling submitEditForm');
        await this.submitEditForm(form);
      } else if (formId === 'add-quick-add-form') {
        await this.submitAddQuickAdd(form);
      } else {
        console.warn('[handleSubmit] Unknown form ID:', formId);
      }
    } finally {
      // Reset submitting state
      form.dataset.submitting = 'false';
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = this.t('save');
      }
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
    } else if (action === 'change-sort') {
      const view = target.dataset.view;
      const sortValue = target.value;
      const currentSort = store.getSortPreference(view);

      // Toggle between creator and creator-reverse when selecting "Added By"
      if (sortValue === 'creator') {
        if (currentSort === 'creator') {
          store.setSortPreference(view, 'creator-reverse');
        } else {
          store.setSortPreference(view, 'creator');
        }
      } else {
        store.setSortPreference(view, sortValue);
      }
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
   * Get member name from user ID
   */
  getMemberName(userId) {
    if (!userId) return null;
    const members = store.getHouseholdMembers();
    const member = members.find(m => m.user_id === userId);
    return member?.users?.email || null;
  }

  /**
   * Get creator initials from user ID
   */
  getCreatorInitials(userId) {
    if (!userId) return null;

    const currentUser = authManager.getCurrentUser();
    const members = store.getHouseholdMembers();
    const member = members.find(m => m.user_id === userId);

    if (!member) return null;

    // Get display name from profiles or email
    const displayName = member.profiles?.display_name || member.users?.email;
    if (!displayName) return null;

    // Extract initials
    const parts = displayName.split(/[\s@._-]+/);
    if (parts.length >= 2) {
      // First letter of first two parts
      return (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
      // First two letters if only one part
      return parts[0].substring(0, 2).toUpperCase();
    } else if (parts[0].length === 1) {
      // Just one letter if that's all we have
      return parts[0].toUpperCase();
    }

    return null;
  }

  /**
   * Sort items based on sort preference
   */
  sortItems(items, sortBy) {
    const sorted = [...items];

    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      case 'a-z':
        return sorted.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      case 'z-a':
        return sorted.sort((a, b) => b.name.toLowerCase().localeCompare(a.name.toLowerCase()));
      case 'due_date':
        return sorted.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        });
      case 'creator':
      case 'creator-reverse':
        // Group by creator, then sort by created_at within each group
        const isReverse = sortBy === 'creator-reverse';
        return sorted.sort((a, b) => {
          const creatorA = this.getCreatorInitials(a.created_by) || 'Unknown';
          const creatorB = this.getCreatorInitials(b.created_by) || 'Unknown';

          // Compare creators
          const creatorCompare = isReverse
            ? creatorB.localeCompare(creatorA)
            : creatorA.localeCompare(creatorB);

          if (creatorCompare !== 0) return creatorCompare;

          // Same creator, sort by most recent
          return new Date(b.created_at) - new Date(a.created_at);
        });
      default:
        return sorted;
    }
  }

  /**
   * Render sort dropdown
   */
  renderSortDropdown(view) {
    const currentSort = store.getSortPreference(view);
    const hasDueDate = view === 'tasks' || view === 'clifford' || view === 'personal';
    const isCreatorSort = currentSort === 'creator' || currentSort === 'creator-reverse';

    return `
      <select
        class="sort-dropdown"
        data-action="change-sort"
        data-view="${view}"
        style="padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius); background-color: var(--card); color: var(--text); font-size: 0.9rem; max-width: 120px;"
      >
        <option value="recent" ${currentSort === 'recent' ? 'selected' : ''}>Newest</option>
        <option value="oldest" ${currentSort === 'oldest' ? 'selected' : ''}>Oldest</option>
        <option value="a-z" ${currentSort === 'a-z' ? 'selected' : ''}>A-Z</option>
        <option value="z-a" ${currentSort === 'z-a' ? 'selected' : ''}>Z-A</option>
        <option value="creator" ${isCreatorSort ? 'selected' : ''}>Added By</option>
        ${hasDueDate ? `<option value="due_date" ${currentSort === 'due_date' ? 'selected' : ''}>Due Date</option>` : ''}
      </select>
    `;
  }

  /**
   * Get household member options for dropdown
   */
  getMemberOptions(selectedUserId = null) {
    const members = store.getHouseholdMembers();
    const options = members.map(member => {
      const name = member.users?.email || 'Unknown';
      const isSelected = member.user_id === selectedUserId ? 'selected' : '';
      return `<option value="${member.user_id}" ${isSelected}>${this.escapeHtml(name)}</option>`;
    }).join('');

    return `
      <option value="">-- ${this.t('assignee')} --</option>
      ${options}
    `;
  }

  /**
   * Show add form
   */
  showAddForm(type) {
    const container = document.getElementById('add-form-container');
    if (!container) return;

    const isShopping = type === 'shopping';
    const isPersonal = type === 'personal';
    const needsTaskFields = !isShopping; // tasks, clifford, and personal all have due date

    container.innerHTML = `
      <div class="modal-overlay" data-action="close-modal">
        <div class="modal">
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
            ${isShopping ? `
              <input
                type="number"
                name="quantity"
                placeholder="Qty"
                min="1"
                value="1"
                style="width: 80px; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); margin-bottom: 0.5rem;"
              />
            ` : ''}
            ${needsTaskFields ? `
              ${!isPersonal ? `
                <select name="assignee" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); margin-bottom: 0.5rem;">
                  ${this.getMemberOptions()}
                </select>
              ` : ''}
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

    console.log('[showAddForm] Form container updated with add form HTML');

    // Prevent clicks inside modal from closing it (but allow button actions to work)
    const modal = container.querySelector('.modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        const actionElement = e.target.closest('[data-action]');
        // Stop propagation UNLESS clicking on an action element that is NOT the overlay
        // (overlay is an ancestor, we don't want clicks on inputs to trigger it)
        if (!actionElement || actionElement.classList.contains('modal-overlay')) {
          e.stopPropagation();
        }
      });
    }
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
      const quantity = parseInt(formData.get('quantity')) || 1;
      await db.addShoppingItem(name, notes, quantity);
    } else if (type === 'personal') {
      const dueDate = formData.get('due_date') || null;
      await db.addPersonalTask(name, dueDate, notes);
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
   * Submit edit form
   */
  async submitEditForm(form) {
    console.log('[submitEditForm] Starting...');
    const formData = new FormData(form);
    const type = formData.get('type');
    const id = formData.get('id');
    const name = formData.get('name');
    const notes = formData.get('notes') || '';

    console.log('[submitEditForm] Form data:', { type, id, name, notes });

    const updates = { name, notes };

    // Add shopping-specific fields
    if (type === 'shopping') {
      const quantity = parseInt(formData.get('quantity')) || 1;
      updates.quantity = quantity;
    }

    // Add task-specific fields
    if (type !== 'shopping') {
      const dueDate = formData.get('due_date') || null;
      updates.due_date = dueDate;

      // Only add assignee for tasks and clifford (not personal)
      if (type !== 'personal') {
        const assignee = formData.get('assignee') || null;
        updates.assignee = assignee;
      }
    }

    console.log('[submitEditForm] Updates:', updates);

    // Close modal FIRST (before the update triggers a re-render)
    const formContainer = document.getElementById('add-form-container');
    const tempContainer = document.getElementById('edit-form-temp');
    if (formContainer) formContainer.innerHTML = '';
    if (tempContainer) tempContainer.remove();

    // Update the item (this may trigger a re-render)
    console.log('[submitEditForm] Updating item...');
    if (type === 'shopping') {
      await db.updateShoppingItem(id, updates);
    } else if (type === 'tasks') {
      await db.updateTask(id, updates);
    } else if (type === 'clifford') {
      await db.updateClifford(id, updates);
    } else if (type === 'personal') {
      await db.updatePersonalTask(id, updates);
    }

    console.log('[submitEditForm] Item updated successfully');
    this.showToast(`${name} updated!`, 'success');
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
    const item = store.getShopping().find(i => String(i.id) === String(id));
    if (item) {
      await db.updateShoppingItem(id, { completed: !item.completed });
    }
  }

  /**
   * Toggle task
   */
  async toggleTask(type, id) {
    let items, updateFn;

    if (type === 'tasks') {
      items = store.getTasks();
      updateFn = db.updateTask.bind(db);
    } else if (type === 'clifford') {
      items = store.getClifford();
      updateFn = db.updateClifford.bind(db);
    } else if (type === 'personal') {
      items = store.getPersonalTasks();
      updateFn = db.updatePersonalTask.bind(db);
    }

    const item = items.find(i => String(i.id) === String(id));

    if (item) {
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
    } else if (type === 'personal') {
      await db.deletePersonalTask(id);
    }

    this.showToast('Item deleted', 'success');
  }

  /**
   * Edit item
   */
  editItem(type, id) {
    console.log('editItem called:', { type, id, idType: typeof id });

    // Get the item - convert IDs to strings for comparison
    let item;
    if (type === 'shopping') {
      item = store.getShopping().find(i => String(i.id) === String(id));
    } else if (type === 'tasks') {
      item = store.getTasks().find(i => String(i.id) === String(id));
    } else if (type === 'clifford') {
      item = store.getClifford().find(i => String(i.id) === String(id));
    }

    if (!item) {
      console.error('Item not found for edit:', { type, id });
      this.showToast('Item not found', 'error');
      return;
    }

    console.log('Item found, showing edit form:', item);

    // Show edit modal
    this.showEditForm(type, item);
  }

  /**
   * Show edit form
   */
  showEditForm(type, item) {
    console.log('showEditForm called:', { type, item });

    const container = document.getElementById('add-form-container') ||
                      document.querySelector('.view-container');

    if (!container) {
      console.error('No container found for edit form');
      this.showToast('Error showing edit form', 'error');
      return;
    }

    const isShopping = type === 'shopping';
    const isPersonal = type === 'personal';
    const needsTaskFields = !isShopping; // tasks, clifford, and personal all have due date

    const modalHtml = `
      <div class="modal-overlay" data-action="close-modal">
        <div class="modal">
          <h2>${this.t('edit')}</h2>
          <form id="edit-item-form">
            <input type="hidden" name="type" value="${type}">
            <input type="hidden" name="id" value="${item.id}">
            <input
              type="text"
              name="name"
              placeholder="${this.t('name')}"
              value="${this.escapeHtml(item.name)}"
              required
              autofocus
            />
            ${isShopping ? `
              <input
                type="number"
                name="quantity"
                placeholder="Qty"
                min="1"
                value="${item.quantity || 1}"
                style="width: 80px; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); margin-bottom: 0.5rem;"
              />
            ` : ''}
            ${needsTaskFields ? `
              ${!isPersonal ? `
                <select name="assignee" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); margin-bottom: 0.5rem;">
                  ${this.getMemberOptions(item.assignee)}
                </select>
              ` : ''}
              <input
                type="date"
                name="due_date"
                placeholder="${this.t('dueDate')}"
                value="${item.due_date || ''}"
              />
            ` : ''}
            <textarea
              name="notes"
              placeholder="${this.t('notes')}"
              rows="3"
            >${item.notes || ''}</textarea>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" data-action="close-modal">${this.t('cancel')}</button>
              <button type="submit" class="btn btn-primary">${this.t('save')}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // If add-form-container exists, use it, otherwise append to container
    const formContainer = document.getElementById('add-form-container');
    if (formContainer) {
      console.log('[showEditForm] Inserting into add-form-container');
      formContainer.innerHTML = modalHtml;
    } else {
      // Create temporary container
      console.log('[showEditForm] Creating temp container');
      const tempDiv = document.createElement('div');
      tempDiv.id = 'edit-form-temp';
      tempDiv.innerHTML = modalHtml;
      container.appendChild(tempDiv);
    }

    // Verify form was created
    const editForm = document.getElementById('edit-item-form');
    console.log('[showEditForm] Form created:', editForm ? 'YES' : 'NO');
    if (editForm) {
      console.log('[showEditForm] Form ID:', editForm.id);
      console.log('[showEditForm] Form has submit button:', editForm.querySelector('[type="submit"]') ? 'YES' : 'NO');
    }

    // Prevent clicks inside modal from closing it (but allow button actions to work)
    const modalDiv = (formContainer || container).querySelector('.modal');
    if (modalDiv) {
      modalDiv.addEventListener('click', (e) => {
        const actionElement = e.target.closest('[data-action]');
        // Stop propagation UNLESS clicking on an action element that is NOT the overlay
        // (overlay is an ancestor, we don't want clicks on inputs to trigger it)
        if (!actionElement || actionElement.classList.contains('modal-overlay')) {
          e.stopPropagation();
        }
      });
    }
  }

  /**
   * Close modal
   */
  closeModal() {
    console.log('[closeModal] Called');
    const formContainer = document.getElementById('add-form-container');
    const tempContainer = document.getElementById('edit-form-temp');
    const quickAddContainer = document.getElementById('quick-add-modal');

    console.log('[closeModal] Containers found:', {
      formContainer: formContainer ? 'YES' : 'NO',
      tempContainer: tempContainer ? 'YES' : 'NO',
      quickAddContainer: quickAddContainer ? 'YES' : 'NO'
    });

    if (formContainer) formContainer.innerHTML = '';
    if (tempContainer) tempContainer.remove();
    if (quickAddContainer) quickAddContainer.remove();

    console.log('[closeModal] Modals closed');
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
    const container = document.getElementById('add-form-container');
    if (!container) return;

    const items = store.getQuickAdd(type);
    const typeName = type === 'clifford' ? this.getCliffordName() : this.t(type);

    container.innerHTML = `
      <div class="modal-overlay" data-action="close-modal">
        <div class="modal">
          <h2>${this.t('manageQuickAdd')}: ${typeName}</h2>

          <div class="quick-add-list" style="margin-bottom: 1rem; max-height: 300px; overflow-y: auto;">
            ${items.length === 0 ? `<p class="empty-message">${this.t('noQuickAddItems')}</p>` :
              items.map(item => `
                <div class="quick-add-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                  <span>${this.escapeHtml(item.name)}</span>
                  <button
                    class="btn-icon-small btn-danger"
                    data-action="delete-quick-add"
                    data-id="${item.id}"
                    data-type="${type}"
                    title="${this.t('delete')}"
                  >×</button>
                </div>
              `).join('')
            }
          </div>

          <form id="add-quick-add-form">
            <input type="hidden" name="type" value="${type}">
            <input
              type="text"
              name="name"
              placeholder="${this.t('name')}"
              required
              autofocus
              style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); margin-bottom: 0.5rem;"
            />
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" data-action="close-modal">${this.t('cancel')}</button>
              <button type="submit" class="btn btn-primary">${this.t('addQuickAdd')}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Prevent clicks inside modal from closing it
    const modal = container.querySelector('.modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        const actionElement = e.target.closest('[data-action]');
        if (!actionElement || actionElement.classList.contains('modal-overlay')) {
          e.stopPropagation();
        }
      });
    }
  }

  /**
   * Submit add quick add form
   */
  async submitAddQuickAdd(form) {
    const formData = new FormData(form);
    const type = formData.get('type');
    const name = formData.get('name');

    const { error } = await db.addQuickAddItem(type, name);

    if (error) {
      this.showToast('Failed to add quick add item', 'error');
    } else {
      this.showToast(this.t('quickAddItemAdded'), 'success');

      // Clear the input field
      const nameInput = form.querySelector('[name="name"]');
      if (nameInput) {
        nameInput.value = '';
      }

      // Update just the list portion without replacing the form
      this.refreshQuickAddList(type);
    }
  }

  /**
   * Delete quick add item
   */
  async deleteQuickAdd(id, type) {
    const { error } = await db.deleteQuickAddItem(id, type);

    if (error) {
      this.showToast('Failed to delete quick add item', 'error');
    } else {
      this.showToast(this.t('quickAddItemDeleted'), 'success');
      // Update just the list portion without replacing the form
      this.refreshQuickAddList(type);
    }
  }

  /**
   * Refresh quick add list without replacing the form
   */
  refreshQuickAddList(type) {
    const listContainer = document.querySelector('.quick-add-list');
    if (!listContainer) return;

    const items = store.getQuickAdd(type);

    listContainer.innerHTML = items.length === 0 ? `<p class="empty-message">${this.t('noQuickAddItems')}</p>` :
      items.map(item => `
        <div class="quick-add-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
          <span>${this.escapeHtml(item.name)}</span>
          <button
            class="btn-icon-small btn-danger"
            data-action="delete-quick-add"
            data-id="${item.id}"
            data-type="${type}"
            title="${this.t('delete')}"
          >×</button>
        </div>
      `).join('');
  }

  /**
   * Remove household member
   */
  async removeMember(memberId, email) {
    const confirmMessage = this.t('confirmRemoveMember')
      .replace('{email}', email);

    if (!confirm(confirmMessage)) {
      return;
    }

    store.setLoading(true);

    const { error } = await db.removeHouseholdMember(memberId);

    store.setLoading(false);

    if (error) {
      console.error('Remove member error:', error);
      this.showToast(error.message || 'Failed to remove member', 'error');
    } else {
      // Remove member from local state
      const members = store.getHouseholdMembers().filter(m => String(m.id) !== String(memberId));
      store.setHouseholdMembers(members);
      this.showToast(this.t('memberRemoved'), 'success');
    }
  }

  /**
   * Update display name
   */
  async updateDisplayName() {
    const input = document.getElementById('display-name-input');
    const displayName = input?.value?.trim();

    if (!displayName) {
      this.showToast('Please enter a display name', 'error');
      return;
    }

    store.setLoading(true);
    const { error } = await db.updateDisplayName(displayName);
    store.setLoading(false);

    if (error) {
      console.error('Update display name error:', error);
      this.showToast(error.message || 'Failed to update display name', 'error');
    } else {
      this.showToast(this.t('displayNameUpdated'), 'success');
      // Clear input
      if (input) input.value = '';
    }
  }

  /**
   * Update custom clifford name
   */
  async updateCliffordName() {
    const input = document.getElementById('custom-clifford-name');
    const customName = input?.value?.trim();

    if (!customName) {
      this.showToast('Please enter a name', 'error');
      return;
    }

    if (customName.length > 20) {
      this.showToast('Name must be 20 characters or less', 'error');
      return;
    }

    store.setLoading(true);
    const { error } = await db.updateHouseholdCustomName(customName);
    store.setLoading(false);

    if (error) {
      console.error('Update custom name error:', error);
      this.showToast(error.message || 'Failed to update name', 'error');
    } else {
      this.showToast(this.t('nameUpdated'), 'success');
      // UI will auto-refresh due to store update
    }
  }

  /**
   * Clear all completed items
   */
  async clearCompleted(type) {
    if (!confirm(this.t('confirmClearCompleted'))) {
      return;
    }

    let items = [];
    if (type === 'shopping') {
      items = store.getShopping().filter(item => item.completed);
    } else if (type === 'tasks') {
      items = store.getTasks().filter(item => item.completed);
    } else if (type === 'clifford') {
      items = store.getClifford().filter(item => item.completed);
    } else if (type === 'personal') {
      items = store.getPersonalTasks().filter(item => item.completed);
    }

    if (items.length === 0) return;

    store.setLoading(true);

    // Delete all completed items
    const deletePromises = items.map(item => {
      if (type === 'shopping') {
        return db.deleteShoppingItem(item.id);
      } else if (type === 'tasks') {
        return db.deleteTask(item.id);
      } else if (type === 'clifford') {
        return db.deleteClifford(item.id);
      } else if (type === 'personal') {
        return db.deletePersonalTask(item.id);
      }
    });

    try {
      await Promise.all(deletePromises);
      this.showToast(this.t('clearedCompleted'), 'success');
    } catch (error) {
      console.error('Error clearing completed items:', error);
      this.showToast('Failed to clear completed items', 'error');
    } finally {
      store.setLoading(false);
    }
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
