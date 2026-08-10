import React, { useState, useEffect } from 'react';
import { Users, FolderPlus, UserPlus, Activity } from 'lucide-react';
import api from '../api/client';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [folders, setFolders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);

  // Form inputs
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderPath, setNewFolderPath] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, fRes, lRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/folders'),
        api.get('/admin/audit-logs')
      ]);
      setUsers(uRes.data);
      setFolders(fRes.data);
      setAuditLogs(lRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        folder_ids: selectedFolderIds
      });
      setShowUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setSelectedFolderIds([]);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/folders', {
        name: newFolderName,
        path: newFolderPath
      });
      setShowFolderModal(false);
      setNewFolderName('');
      setNewFolderPath('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create folder');
    }
  };

  const toggleFolderPermission = (folderId) => {
    if (selectedFolderIds.includes(folderId)) {
      setSelectedFolderIds(selectedFolderIds.filter(id => id !== folderId));
    } else {
      setSelectedFolderIds([...selectedFolderIds, folderId]);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '1.5rem auto', padding: '0 1rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Admin Control Center
          </h1>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Manage organization users, storage folders, and audit logs
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowFolderModal(true)} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            <FolderPlus size={14} /> New Folder
          </button>
          <button onClick={() => setShowUserModal(true)} className="btn-primary" style={{ fontSize: '0.8rem' }}>
            <UserPlus size={14} /> New User Account
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
        <button 
          onClick={() => setActiveTab('users')}
          className="btn-secondary"
          style={{
            background: activeTab === 'users' ? 'var(--primary-light)' : 'transparent',
            borderColor: activeTab === 'users' ? '#bfdbfe' : 'transparent',
            color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          <Users size={15} /> Users ({users.length})
        </button>

        <button 
          onClick={() => setActiveTab('folders')}
          className="btn-secondary"
          style={{
            background: activeTab === 'folders' ? 'var(--primary-light)' : 'transparent',
            borderColor: activeTab === 'folders' ? '#bfdbfe' : 'transparent',
            color: activeTab === 'folders' ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          <FolderPlus size={15} /> Folders ({folders.length})
        </button>

        <button 
          onClick={() => setActiveTab('logs')}
          className="btn-secondary"
          style={{
            background: activeTab === 'logs' ? 'var(--primary-light)' : 'transparent',
            borderColor: activeTab === 'logs' ? '#bfdbfe' : 'transparent',
            color: activeTab === 'logs' ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          <Activity size={15} /> Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Users Table */}
      {activeTab === 'users' && (
        <div className="card-panel">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Assigned Folder Rights</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong style={{ fontWeight: 600 }}>{u.name}</strong></td>
                  <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'ADMIN' ? 'badge-admin' : 'badge-user'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.assigned_folders && u.assigned_folders.length > 0 ? (
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {u.assigned_folders.map(f => {
                          const folderObj = folders.find(fd => fd.id === f.folder_id);
                          return (
                            <span key={f.folder_id} className="badge badge-neutral" style={{ fontSize: '0.725rem' }}>
                              {folderObj ? folderObj.name : f.folder_id}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Full System Access</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Folders Table */}
      {activeTab === 'folders' && (
        <div className="card-panel">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Folder Name</th>
                <th>GCS Prefix Path</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {folders.map(f => (
                <tr key={f.id}>
                  <td><strong style={{ fontWeight: 600 }}>{f.name}</strong></td>
                  <td className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>{f.path}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>{new Date(f.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Logs */}
      {activeTab === 'logs' && (
        <div className="card-panel" style={{ padding: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {auditLogs.map(log => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.825rem' }}>
                <div>
                  <span className="badge badge-status" style={{ fontSize: '0.65rem', marginRight: '0.5rem' }}>{log.action}</span>
                  <span>{log.details}</span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card-panel" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem' }}>Create User Account</h3>
            
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Full Name</label>
                <input type="text" className="form-input" value={newUserName} onChange={e => setNewUserName(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Email Address</label>
                <input type="email" className="form-input" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Initial Password</label>
                <input type="password" className="form-input" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Assign Folder Permissions</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {folders.map(f => (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedFolderIds.includes(f.id)} onChange={() => toggleFolderPermission(f.id)} />
                      <span>{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowUserModal(false)} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Folder Modal */}
      {showFolderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card-panel" style={{ width: '100%', maxWidth: '380px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem' }}>Create Storage Folder</h3>
            
            <form onSubmit={handleCreateFolder}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Folder Name</label>
                <input type="text" className="form-input" placeholder="e.g. Operations" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>GCS Prefix Path</label>
                <input type="text" className="form-input" placeholder="e.g. operations" value={newFolderPath} onChange={e => setNewFolderPath(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowFolderModal(false)} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>Save Folder</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
