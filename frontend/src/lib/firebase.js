import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { firebaseClientConfig, isFirebaseConfigured } from '../config/env';

let app = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseClientConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

export { app, auth, googleProvider, isFirebaseConfigured };
