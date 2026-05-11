import { createContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import { syncCurrentUser } from '../lib/platform';

export const AuthContext = createContext(null);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function ensureUserProfile() {
  try {
    const syncResult = await syncCurrentUser();
    if (syncResult?.profile) {
      return {
        profile: syncResult.profile,
        setupWarnings: syncResult.setupWarnings || [],
        claimsUpdated: syncResult.claimsUpdated === true
      };
    }
  } catch (error) {
    return {
      profile: null,
      setupWarnings: [error?.message || 'Platform sync failed.'],
      claimsUpdated: false
    };
  }
  return { profile: null, setupWarnings: [], claimsUpdated: false };
}

async function finalizeUserState(nextUser) {
  const syncState = await ensureUserProfile();
  const tokenResult = await nextUser.getIdTokenResult(syncState?.claimsUpdated === true).catch(() => null);
  const isAdmin = syncState?.profile?.role === 'admin';

  return {
    profile: syncState?.profile || null,
    claims: tokenResult?.claims || {},
    setupWarnings: [...(syncState?.setupWarnings || [])],
    destination: isAdmin ? '/admin' : '/dashboard'
  };
}

async function refreshCurrentProfileState(nextUser) {
  if (!nextUser) {
    return { profile: null, claims: {}, setupWarnings: [] };
  }
  const nextState = await finalizeUserState(nextUser);
  return {
    profile: nextState.profile,
    claims: nextState.claims,
    setupWarnings: nextState.setupWarnings
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [claims, setClaims] = useState({});
  const [loading, setLoading] = useState(true);
  const [setupWarnings, setSetupWarnings] = useState([]);

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setClaims({});
        setLoading(false);
        return;
      }

      const nextState = await finalizeUserState(nextUser);
      setClaims(nextState.claims);
      setProfile(nextState.profile);
      setSetupWarnings(nextState.setupWarnings);
      setLoading(false);
    });
  }, []);

  async function loginWithEmail(email, password) {
    if (!auth) throw new Error('Firebase auth is not configured.');
    const credential = await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
    return finalizeUserState(credential.user);
  }

  async function signupWithEmail(email, password, displayName) {
    if (!auth) throw new Error('Firebase auth is not configured.');
    const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
    const normalizedDisplayName = String(displayName || '').trim();
    if (normalizedDisplayName) {
      await updateProfile(credential.user, { displayName: normalizedDisplayName });
    }
    return finalizeUserState(credential.user);
  }

  async function loginWithGoogle() {
    if (!auth) throw new Error('Firebase auth is not configured.');
    const provider = googleProvider || new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    return finalizeUserState(credential.user);
  }

  async function logout() {
    if (!auth) return;
    await signOut(auth);
  }

  async function resetPassword(email) {
    if (!auth) throw new Error('Firebase auth is not configured.');
    return sendPasswordResetEmail(auth, normalizeEmail(email));
  }

  async function refreshProfile() {
    if (!auth?.currentUser) return null;
    const nextState = await refreshCurrentProfileState(auth.currentUser);
    setClaims(nextState.claims);
    setProfile(nextState.profile);
    setSetupWarnings(nextState.setupWarnings);
    return nextState;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        claims,
        loading,
        setupWarnings,
        isAuthenticated: Boolean(user),
        isAdmin: profile?.role === 'admin',
        isFirebaseConfigured,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        logout,
        resetPassword,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
