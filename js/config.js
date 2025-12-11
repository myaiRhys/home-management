// Supabase Configuration
export const SUPABASE_URL = 'https://gyutgfsdtsbbymhwrqka.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dXRnZnNkdHNiYnltaHdycWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzM1MDgsImV4cCI6MjA3OTU0OTUwOH0.MT8uHkOR5nmnB1VqOXelaMUM24aWiTYISmGK4VcSt4g';

// App Constants
export const APP_NAME = 'Thibault';
export const APP_VERSION = '2.0.0';
export const INVITE_CODE_LENGTH = 6;

// Connection timeouts
export const DB_OPERATION_TIMEOUT = 10000; // 10 seconds (reduced from 30s for better UX)
export const RECONNECT_DELAY = 1000; // 1 second
export const MAX_RETRY_ATTEMPTS = 3;

// Local storage keys
export const STORAGE_KEYS = {
  THEME: 'thibault_theme',
  LANGUAGE: 'thibault_language',
  QUEUE: 'thibault_queue',
  USER: 'thibault_user',
  HOUSEHOLD: 'thibault_household',
  NOTIFICATION_PREFS: 'thibault_notification_prefs',
  SYNC_STATE: 'thibault_sync_state'
};

// Connection states
export const ConnectionState = {
  OFFLINE: 'offline',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting'
};

// Operation types for queue
export const OperationType = {
  INSERT: 'insert',
  UPDATE: 'update',
  DELETE: 'delete'
};

// Table names
export const Tables = {
  SHOPPING: 'shopping',
  TASKS: 'tasks',
  CLIFFORD: 'clifford',
  QUICK_ADD: 'quick_add',
  HOUSEHOLDS: 'households',
  HOUSEHOLD_MEMBERS: 'household_members',
  PERSONAL_TASKS: 'personal_tasks',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_PREFERENCES: 'notification_preferences'
};

// Notification types
export const NotificationType = {
  TASK_ASSIGNED: 'task_assigned',
  SHOPPING_ADDED: 'shopping_added',
  TASK_COMPLETED: 'task_completed',
  CLIFFORD_ASSIGNED: 'clifford_assigned'
};
