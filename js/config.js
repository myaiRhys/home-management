// Firebase Configuration
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC9tqJRmUJdzExW_1PbuxPfKZDMQc65VG8",
  authDomain: "thibault-f18c6.firebaseapp.com",
  projectId: "thibault-f18c6",
  storageBucket: "thibault-f18c6.firebasestorage.app",
  messagingSenderId: "893751591946",
  appId: "1:893751591946:web:74cd25679f9162af834bf3",
  measurementId: "G-WPJQM1JJY5"
};

// App Constants
export const APP_NAME = 'Thibault';
export const APP_VERSION = '2.0.0';
export const INVITE_CODE_LENGTH = 6;

// Connection timeouts
export const DB_OPERATION_TIMEOUT = 30000; // 30 seconds
export const RECONNECT_DELAY = 1000; // 1 second
export const MAX_RETRY_ATTEMPTS = 3;

// Local storage keys
export const STORAGE_KEYS = {
  THEME: 'thibault_theme',
  LANGUAGE: 'thibault_language',
  QUEUE: 'thibault_queue',
  USER: 'thibault_user',
  HOUSEHOLD: 'thibault_household'
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
  PERSONAL_TASKS: 'personal_tasks'
};
