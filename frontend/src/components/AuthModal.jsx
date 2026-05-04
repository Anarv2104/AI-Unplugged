import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

function AuthPanel({ mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithEmail, signupWithEmail, loginWithGoogle, resetPassword, isFirebaseConfigured } = useAuth();
  const [values, setValues] = useState({ email: '', password: '', name: '' });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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
    setPending(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signup') {
        const result = await signupWithEmail(values.email, values.password, values.name);
        finishAuth(result?.destination);
      } else {
        const result = await loginWithEmail(values.email, values.password);
        finishAuth(result?.destination);
      }
    } catch (nextError) {
      setError(nextError?.message || 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    setPending(true);
    setError('');

    try {
      const result = await loginWithGoogle();
      finishAuth(result?.destination);
    } catch (nextError) {
      setError(nextError?.message || 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  async function handleResetPassword() {
    if (!values.email) {
      setError('Enter your email first so we know where to send the reset link.');
      return;
    }

    setPending(true);
    setError('');

    try {
      await resetPassword(values.email);
      setMessage('Password reset email sent.');
    } catch (nextError) {
      setError(nextError?.message || 'Something went wrong.');
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

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' ? (
              <div className="form-field">
                <label className="form-label" htmlFor="auth-name">Name</label>
                <input
                  className="form-input"
                  id="auth-name"
                  autoComplete="name"
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
                value={values.email}
                onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="auth-password">Password</label>
              <input
                className="form-input"
                id="auth-password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={values.password}
                onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
              />
            </div>

            {error ? <div className="form-error auth-message" style={{ display: 'block' }}>{error}</div> : null}
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
