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
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import { syncCurrentUser } from '../lib/platform';

export const AuthContext = createContext(null);

async function ensureUserProfile(user) {
  if (!db || !user) return null;

  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const payload = {
    email: user.email || '',
    displayName: user.displayName || '',
    newsletterSubscribed: snap.exists() ? snap.data().newsletterSubscribed !== false : true,
    updatedAt: serverTimestamp()
  };

  if (!snap.exists()) {
    payload.role = 'user';
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });
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
    const nextSnap = await getDoc(ref);
    return {
      profile: nextSnap.exists() ? { id: nextSnap.id, ...nextSnap.data() } : null,
      setupWarnings: [error?.message || 'Platform sync failed.'],
      claimsUpdated: false
    };
  }
  const nextSnap = await getDoc(ref);
  return {
    profile: nextSnap.exists() ? { id: nextSnap.id, ...nextSnap.data() } : null,
    setupWarnings: [],
    claimsUpdated: false
  };
}

async function finalizeUserState(nextUser) {
  const syncState = await ensureUserProfile(nextUser);
  const tokenResult = await nextUser.getIdTokenResult(syncState?.claimsUpdated === true);
  const isAdmin = tokenResult.claims?.admin === true || syncState?.profile?.role === 'admin';

  return {
    profile: syncState?.profile || null,
    claims: tokenResult.claims || {},
    setupWarnings: [...(syncState?.setupWarnings || [])],
    destination: isAdmin ? '/admin' : '/dashboard'
  };
}

async function refreshCurrentProfileState(nextUser) {
  if (!nextUser) {
    return {
      profile: null,
      claims: {},
      setupWarnings: []
    };
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
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return finalizeUserState(credential.user);
  }

  async function signupWithEmail(email, password, displayName) {
    if (!auth) throw new Error('Firebase auth is not configured.');
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }
    await ensureUserProfile(credential.user);
    await setDoc(doc(db, 'users', credential.user.uid), {
      displayName: displayName || '',
      email,
      newsletterSubscribed: true
    }, { merge: true });
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
    return sendPasswordResetEmail(auth, email);
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
        isAdmin: claims.admin === true || profile?.role === 'admin',
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
