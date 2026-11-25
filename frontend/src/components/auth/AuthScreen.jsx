import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const AuthScreen = () => {
  const { login, register, error, setError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');

  const handleFieldChange = (setValue) => (e) => {
    setValue(e.target.value);
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const normalizedEmailOrUsername = emailOrUsername.trim();
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim();
    const normalizedFullName = fullName.trim();

    if (isRegister && normalizedFullName.length === 0) {
      setError('Please enter your full name.');
      return;
    }

    if (isRegister && normalizedUsername.length < 3) {
      setError('Username must contain at least 3 non-space characters.');
      return;
    }

    if (!isRegister && normalizedEmailOrUsername.length === 0) {
      setError('Please enter your email or username.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register({
          username: normalizedUsername,
          email: normalizedEmail,
          password,
          fullName: normalizedFullName
        });
      } else {
        await login(normalizedEmailOrUsername, password);
      }
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h1>Chat & Collaboration</h1>
          <p className="auth-subtitle">Real-time messaging, team groups, presence & collaboration</p>
        </div>

        {/* Tab switch */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(false);
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${isRegister ? 'active' : ''}`}
            onClick={() => {
              setIsRegister(true);
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister ? (
            <>
              <div className="form-group">
                <label htmlFor="reg-fullname">Full Name</label>
                <input
                  id="reg-fullname"
                  type="text"
                  placeholder="e.g. Your Name"
                  autoComplete="name"
                  value={fullName}
                  onChange={handleFieldChange(setFullName)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-username">Username</label>
                <input
                  id="reg-username"
                  type="text"
                  placeholder="e.g. username"
                  autoComplete="username"
                  value={username}
                  onChange={handleFieldChange(setUsername)}
                  minLength={3}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="user@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={handleFieldChange(setEmail)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-password">Password (min 6 characters)</label>
                <input
                  id="reg-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={password}
                  onChange={handleFieldChange(setPassword)}
                  minLength={6}
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="login-identity">Email or Username</label>
                <input
                  id="login-identity"
                  type="text"
                  placeholder="user@example.com or username"
                  autoComplete="username"
                  value={emailOrUsername}
                  onChange={handleFieldChange(setEmailOrUsername)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={handleFieldChange(setPassword)}
                  required
                />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary auth-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="spinner-sm"></span>
            ) : isRegister ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
