import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { FIREBASE_CONFIG } from './config.js';
import { store } from './store.js';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Authentication Manager
 * Handles auth state and session management with Firebase
 */
class AuthManager {
  constructor() {
    this.initialized = false;
    this.authStateUnsubscribe = null;
  }

  /**
   * Initialize auth state
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    console.log('[Auth] Initializing...');

    return new Promise((resolve) => {
      // Listen for auth state changes
      this.authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('[Auth] State change:', user ? 'signed in' : 'signed out');

        if (user) {
          console.log('[Auth] User found:', user.uid);
          await this.handleSession(user);
        } else {
          console.log('[Auth] No user found');
          this.handleSignOut();
        }

        if (!this.initialized) {
          this.initialized = true;
          resolve({ data: user, error: null });
        }
      }, (error) => {
        console.error('[Auth] Auth state error:', error);
        if (!this.initialized) {
          this.initialized = true;
          resolve({ data: null, error });
        }
      });
    });
  }

  /**
   * Handle session (load user data)
   */
  async handleSession(user) {
    if (!user) {
      return;
    }

    console.log('[Auth] Handling session for user:', user.uid);

    // Store user
    store.setUser({
      id: user.uid,
      email: user.email,
      email_confirmed_at: user.emailVerified ? new Date().toISOString() : null
    });

    // Load user's household
    await this.loadUserHousehold(user.uid);
  }

  /**
   * Load user's household
   */
  async loadUserHousehold(userId) {
    try {
      const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

      // Get household membership
      const q = query(
        collection(db, 'household_members'),
        where('user_id', '==', userId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('[Auth] No household membership found');
        return;
      }

      const membership = snapshot.docs[0].data();
      const householdId = membership.household_id;

      // Get household details
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const householdDoc = await getDoc(doc(db, 'households', householdId));

      if (householdDoc.exists()) {
        console.log('[Auth] Loaded household:', householdId);
        store.setHousehold({
          id: householdId,
          ...householdDoc.data(),
          userRole: membership.role
        });
      }

    } catch (error) {
      console.error('[Auth] Error in loadUserHousehold:', error);
    }
  }

  /**
   * Handle sign out
   */
  handleSignOut() {
    console.log('[Auth] Signed out');
    store.clearUserData();
    store.setCurrentView('auth');
  }

  /**
   * Sign up with email and password
   */
  async signUp(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('[Auth] Sign up successful:', userCredential.user.uid);

      return {
        data: {
          user: {
            id: userCredential.user.uid,
            email: userCredential.user.email
          }
        },
        error: null
      };

    } catch (error) {
      console.error('[Auth] Sign up error:', error);
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('[Auth] Sign in successful:', userCredential.user.uid);

      return {
        data: {
          user: {
            id: userCredential.user.uid,
            email: userCredential.user.email
          }
        },
        error: null
      };

    } catch (error) {
      console.error('[Auth] Sign in error:', error);
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    try {
      await firebaseSignOut(auth);
      this.handleSignOut();
      return { error: null };

    } catch (error) {
      console.error('[Auth] Sign out error:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return store.getUser();
  }

  /**
   * Get current household
   */
  getCurrentHousehold() {
    return store.getHousehold();
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.authStateUnsubscribe) {
      this.authStateUnsubscribe();
      this.authStateUnsubscribe = null;
    }
  }
}

// Singleton instance
export const authManager = new AuthManager();
