import React, { useState, useEffect } from 'react';
import { Folder, File, Download, Lock } from 'lucide-react';
import api from '../api/client';
import LargeFileUploader from '../components/LargeFileUploader';

export default function UserDashboard() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const res = await api.get('/files/my-folders');
      setFolders(res.data);
      if (res.data.length > 0) {
        setSelectedFolder(res.data[0]);
        fetchFiles(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  const fetchFiles = async (folderId) => {
    try {
      const res = await api.get(`/files/folder/${folderId}`);
      setFiles(res.data);
    } catch (err) {
      console.error('Error fetching files:', err);
    }
  };

  const handleSelectFolder = (folder) => {
    setSelectedFolder(folder);
    fetchFiles(folder.id);
  };

  const handleDownload = async (file) => {
    setDownloadingId(file.id);
    try {
      const res = await api.get(`/files/download-url/${file.id}`);
      const link = document.createElement('a');
      link.href = res.data.download_url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '1.5rem auto', padding: '0 1rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
          User Workspace
        </h1>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
          Browse assigned folders, view files, and download documents
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.25rem' }}>
        
        {/* Left Sidebar */}
        <div className="card-panel" style={{ padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
            Assigned Folders
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {folders.map(f => (
              <div 
                key={f.id}
                onClick={() => handleSelectFolder(f)}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: selectedFolder?.id === f.id ? 'var(--primary-light)' : 'transparent',
                  color: selectedFolder?.id === f.id ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                  fontWeight: selectedFolder?.id === f.id ? 600 : 400
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Folder size={15} color={selectedFolder?.id === f.id ? '#2563eb' : '#64748b'} />
                  <span>{f.name}</span>
                </div>
                {!f.can_upload && (
                  <span className="badge badge-neutral" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                    View Only
                  </span>
                )}
              </div>
            ))}

            {folders.length === 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
                No storage folders assigned yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Main Content */}
        <div>
          {selectedFolder ? (
            <>
              {selectedFolder.can_upload ? (
                <LargeFileUploader folder={selectedFolder} onUploadSuccess={() => fetchFiles(selectedFolder.id)} />
              ) : (
                <div className="card-panel" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#64748b', fontSize: '0.825rem' }}>
                  <Lock size={16} color="#64748b" />
                  <span><strong>Read-Only Access:</strong> You have permission to view and download files in {selectedFolder.name}, but uploading is restricted by Admin.</span>
                </div>
              )}

              <div className="card-panel">
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.9rem' }}>
                  Files in {selectedFolder.name}
                </div>

                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Size</th>
                      <th>Uploaded Date</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(file => (
                      <tr key={file.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <File size={15} color="#64748b" />
                            <strong style={{ fontWeight: 500 }}>{file.name}</strong>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                          {formatBytes(file.size_bytes)}
                        </td>
                        <td style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                          {new Date(file.uploaded_at).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDownload(file)} 
                            disabled={downloadingId === file.id}
                            className="btn-secondary" 
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                          >
                            <Download size={13} />
                            <span>{downloadingId === file.id ? 'Signing...' : 'Download'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {files.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                          No files uploaded to this folder yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="card-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a folder to view files.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
