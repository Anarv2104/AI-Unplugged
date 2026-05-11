import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-credential': 'Email or password is incorrect. Check the details or reset your password.',
  'auth/wrong-password': 'Email or password is incorrect. Check the details or reset your password.',
  'auth/user-not-found': 'Email or password is incorrect. Check the details or reset your password.',
  'auth/email-already-in-use': 'An account already exists with this email. Log in instead.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.'
};

function getAuthErrorMessage(error) {
  return AUTH_ERROR_MESSAGES[error?.code] || 'Something went wrong. Please try again.';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2c.5-.1.9-.2 1.4-.2 6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 4" />
      <path d="M6.4 6.9A17.5 17.5 0 0 0 2.5 12s3.5 7 9.5 7c1.6 0 3-.5 4.2-1.1" />
      <path d="M9.9 9.9A3 3 0 0 0 14.1 14" />
    </svg>
  );
}

function AuthPanel({ mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithEmail, signupWithEmail, loginWithGoogle, resetPassword, isFirebaseConfigured } = useAuth();
  const [values, setValues] = useState({ email: '', password: '', name: '' });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const cardRef = useRef(null);

  const title = mode === 'signup' ? 'Create your account' : 'Log in';
  const subtitle = mode === 'signup'
    ? 'Get into the platform, join events, and start building with the rooms that matter.'
    : 'Return to your dashboard, events, and updates.';

  function closeModal() {
    const background = location.state?.backgroundLocation;
    if (background) navigate(-1);
    else navigate('/');
  }

  function finishAuth(destination) {
    navigate(destination || '/', { replace: true });
  }

  function switchMode(nextMode) {
    navigate(`/${nextMode}`, { replace: true, state: location.state });
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') closeModal();
    }

    window.addEventListener('keydown', handleKeyDown);
    cardRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextValues = {
      email: values.email.trim(),
      password: values.password,
      name: values.name.trim()
    };

    if (!nextValues.email) {
      setError('Enter your email address.');
      setMessage('');
      return;
    }

    if (!isValidEmail(nextValues.email)) {
      setError('Enter a valid email address.');
      setMessage('');
      return;
    }

    if (!nextValues.password) {
      setError('Enter your password.');
      setMessage('');
      return;
    }

    if (mode === 'signup' && !nextValues.name) {
      setError('Enter your name to create an account.');
      setMessage('');
      return;
    }

    setPending(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signup') {
        const result = await signupWithEmail(nextValues.email, nextValues.password, nextValues.name);
        finishAuth(result?.destination);
      } else {
        const result = await loginWithEmail(nextValues.email, nextValues.password);
        finishAuth(result?.destination);
      }
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    setPending(true);
    setError('');
    setMessage('');

    try {
      const result = await loginWithGoogle();
      finishAuth(result?.destination);
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setPending(false);
    }
  }

  async function handleResetPassword() {
    const nextEmail = values.email.trim();

    if (!nextEmail) {
      setError('Enter your email first so we know where to send the reset link.');
      setMessage('');
      return;
    }

    if (!isValidEmail(nextEmail)) {
      setError('Enter a valid email address.');
      setMessage('');
      return;
    }

    setPending(true);
    setError('');

    try {
      await resetPassword(nextEmail);
      setMessage('Password reset email sent.');
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-overlay" onClick={closeModal}>
      <div className="auth-card-shell" onClick={(event) => event.stopPropagation()}>
        <div className="auth-card form-card" ref={cardRef} tabIndex={-1}>
          <button type="button" className="auth-close" onClick={closeModal}>×</button>
          <p className="section-label">{mode === 'signup' ? 'Create account' : 'Log in'}</p>
          <h2 className="auth-title">{title}</h2>
          <p className="auth-sub">{subtitle}</p>

          {!isFirebaseConfigured ? (
            <div className="empty-state auth-empty">
              Firebase auth is not configured yet. Add the client env values first.
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {mode === 'signup' ? (
              <div className="form-field">
                <label className="form-label" htmlFor="auth-name">Name</label>
                <input
                  className="form-input"
                  id="auth-name"
                  autoComplete="name"
                  required
                  value={values.name}
                  onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
            ) : null}

            <div className="form-field">
              <label className="form-label" htmlFor="auth-email">Email</label>
              <input
                className="form-input"
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={values.email}
                onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="auth-password">Password</label>
              <div className="auth-password-field">
                <input
                  className="form-input"
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  value={values.password}
                  onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error ? <div className="auth-message" role="alert">{error}</div> : null}
            {message ? <div className="auth-success">{message}</div> : null}

            <div className="auth-actions">
              <button type="submit" className="btn-primary" disabled={pending || !isFirebaseConfigured}>
                {pending ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}
              </button>
              <button type="button" className="btn-secondary" disabled={pending || !isFirebaseConfigured} onClick={handleGoogle}>
                Continue with Google
              </button>
            </div>
          </form>

          <div className="auth-links">
            {mode === 'login' ? (
              <button type="button" className="auth-link" onClick={handleResetPassword}>Forgot password?</button>
            ) : null}
            <button type="button" className="auth-link" onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}>
              {mode === 'signup' ? 'Already have an account?' : 'Need an account?'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthModal({ mode }) {
  return <AuthPanel mode={mode} />;
}
