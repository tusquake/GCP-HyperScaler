import React from 'react';
import { Shield, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header style={{
      background: '#ffffff',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0.75rem 1.5rem'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Shield size={20} color="#2563eb" />
          <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>
            Enterprise File Vault
          </span>
          <span className="badge badge-status" style={{ marginLeft: '0.5rem' }}>
            IAM Managed Identity
          </span>
        </div>

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{user.name}</span>
            <span className={`badge ${user.role === 'ADMIN' ? 'badge-admin' : 'badge-user'}`} style={{ marginLeft: '0.5rem' }}>
              {user.role}
            </span>
          </div>

          <button onClick={logout} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>

      </div>
    </header>
  );
}
