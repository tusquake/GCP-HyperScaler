import React, { useState, useEffect } from 'react';
import { Users, FolderPlus, UserPlus, Activity, ShieldAlert, Edit3 } from 'lucide-react';
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
  const [showEditPermsModal, setShowEditPermsModal] = useState(false);
  const [selectedUserForPerms, setSelectedUserForPerms] = useState(null);

  // Form inputs
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  
  // Folder permissions map: { [folder_id]: { can_read: boolean, can_upload: boolean } }
  const [folderPermsMap, setFolderPermsMap] = useState({});

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

  const handleOpenUserModal = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    const initialMap = {};
    folders.forEach(f => {
      initialMap[f.id] = { can_read: true, can_upload: true };
    });
    setFolderPermsMap(initialMap);
    setShowUserModal(true);
  };

  const handleOpenEditPerms = (user) => {
    setSelectedUserForPerms(user);
    const existingMap = {};
    folders.forEach(f => {
      const existing = (user.assigned_folders || []).find(af => af.folder_id === f.id);
      existingMap[f.id] = {
        can_read: existing ? existing.can_read : false,
        can_upload: existing ? existing.can_upload : false
      };
    });
    setFolderPermsMap(existingMap);
    setShowEditPermsModal(true);
  };

  const handleToggleRead = (folderId) => {
    setFolderPermsMap(prev => ({
      ...prev,
      [folderId]: {
        ...prev[folderId],
        can_read: !prev[folderId]?.can_read
      }
    }));
  };

  const handleToggleUpload = (folderId) => {
    setFolderPermsMap(prev => ({
      ...prev,
      [folderId]: {
        ...prev[folderId],
        can_upload: !prev[folderId]?.can_upload
      }
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const formattedPerms = Object.keys(folderPermsMap).map(fId => ({
        folder_id: fId,
        can_read: folderPermsMap[fId].can_read,
        can_upload: folderPermsMap[fId].can_upload
      }));

      await api.post('/admin/users', {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        folder_permissions: formattedPerms
      });

      setShowUserModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleSaveUserPermissions = async (e) => {
    e.preventDefault();
    if (!selectedUserForPerms) return;

    try {
      const formattedPerms = Object.keys(folderPermsMap).map(fId => ({
        folder_id: fId,
        can_read: folderPermsMap[fId].can_read,
        can_upload: folderPermsMap[fId].can_upload
      }));

      await api.post('/admin/permissions', {
        user_id: selectedUserForPerms.id,
        folder_permissions: formattedPerms
      });

      setShowEditPermsModal(false);
      setSelectedUserForPerms(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user permissions');
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

  return (
    <div style={{ maxWidth: '1020px', margin: '1.5rem auto', padding: '0 1rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Admin Control Center
          </h1>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Manage organization accounts, granular Read/Upload folder permissions, and audit logs
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowFolderModal(true)} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            <FolderPlus size={14} /> New Folder
          </button>
          <button onClick={handleOpenUserModal} className="btn-primary" style={{ fontSize: '0.8rem' }}>
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
                <th>Granular Folder Rights</th>
                <th>Action</th>
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
                    {u.role === 'ADMIN' ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Full System Access</span>
                    ) : u.assigned_folders && u.assigned_folders.length > 0 ? (
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {u.assigned_folders.map(f => {
                          const folderObj = folders.find(fd => fd.id === f.folder_id);
                          const permsLabel = [];
                          if (f.can_read) permsLabel.push('View');
                          if (f.can_upload) permsLabel.push('Upload');
                          return (
                            <span key={f.folder_id} className="badge badge-neutral" style={{ fontSize: '0.725rem' }}>
                              {folderObj ? folderObj.name : f.folder_id}: <strong>{permsLabel.join('+') || 'None'}</strong>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>No Folders Assigned</span>
                    )}
                  </td>
                  <td>
                    {u.role !== 'ADMIN' && (
                      <button onClick={() => handleOpenEditPerms(u)} className="btn-secondary" style={{ padding: '0.25rem 0.55rem', fontSize: '0.725rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Edit3 size={12} /> Edit Permissions
                      </button>
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
          <div className="card-panel" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem' }}>
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
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Granular Folder Rights (View vs Upload)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', background: 'var(--bg-subtle)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  {folders.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', paddingBottom: '0.3rem', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontWeight: 500 }}>{f.name}</span>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!folderPermsMap[f.id]?.can_read} onChange={() => handleToggleRead(f.id)} />
                          <span>View/Download</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!folderPermsMap[f.id]?.can_upload} onChange={() => handleToggleUpload(f.id)} />
                          <span>Upload</span>
                        </label>
                      </div>
                    </div>
                  ))}
                  {folders.length === 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No storage folders created yet. Create a folder first.</span>
                  )}
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

      {/* Edit Permissions Modal */}
      {showEditPermsModal && selectedUserForPerms && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card-panel" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Edit Folder Permissions
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Updating access rights for <strong>{selectedUserForPerms.name}</strong> ({selectedUserForPerms.email})
            </p>
            
            <form onSubmit={handleSaveUserPermissions}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto', background: 'var(--bg-subtle)', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  {folders.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', paddingBottom: '0.3rem', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontWeight: 500 }}>{f.name}</span>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!folderPermsMap[f.id]?.can_read} onChange={() => handleToggleRead(f.id)} />
                          <span>View/Download</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!folderPermsMap[f.id]?.can_upload} onChange={() => handleToggleUpload(f.id)} />
                          <span>Upload</span>
                        </label>
                      </div>
                    </div>
                  ))}
                  {folders.length === 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No storage folders created yet.</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowEditPermsModal(false)} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>Update Permissions</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
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
