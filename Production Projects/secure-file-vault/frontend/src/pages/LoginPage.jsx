import React, { useState } from 'react';
import { Shield, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.response?.data?.error || (isRegistering ? 'Registration failed' : 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'var(--primary-light)',
            border: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem auto'
          }}>
            <Shield size={22} color="#2563eb" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Enterprise File Vault
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {isRegistering ? 'Create new account' : 'Sign in to access corporate storage'}
          </p>
        </div>

        {/* Card */}
        <div className="card-panel" style={{ padding: '1.5rem' }}>
          
          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '0.2rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => { setIsRegistering(false); setError(''); }}
              style={{
                flex: 1,
                padding: '0.4rem',
                border: 'none',
                borderRadius: '4px',
                background: !isRegistering ? '#ffffff' : 'transparent',
                boxShadow: !isRegistering ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                fontWeight: !isRegistering ? 600 : 500,
                fontSize: '0.8rem',
                color: !isRegistering ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegistering(true); setError(''); }}
              style={{
                flex: 1,
                padding: '0.4rem',
                border: 'none',
                borderRadius: '4px',
                background: isRegistering ? '#ffffff' : 'transparent',
                boxShadow: isRegistering ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                fontWeight: isRegistering ? 600 : 500,
                fontSize: '0.8rem',
                color: isRegistering ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {isRegistering && (
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  Full Name
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  required={isRegistering}
                />
              </div>
            )}

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Corporate Email
              </label>
              <input 
                type="email" 
                className="form-input" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@organization.com"
                required
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Password
              </label>
              <input 
                type="password" 
                className="form-input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>

            {error && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid #fecaca', color: 'var(--danger)', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.6rem' }}>
              {loading ? (isRegistering ? 'Creating Account...' : 'Authenticating...') : (
                <>
                  {isRegistering ? <UserPlus size={15} /> : <LogIn size={15} />}
                  <span>{isRegistering ? 'Register Account' : 'Sign In'}</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
