import React, { useState, useRef } from 'react';
import { UploadCloud, File, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import api from '../api/client';

export default function LargeFileUploader({ folder, onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const startTimeRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError('');
      setSuccess(false);
      setProgress(0);
    }
  };

  const startUpload = async () => {
    if (!selectedFile || !folder) return;

    setUploading(true);
    setError('');
    setSuccess(false);
    setProgress(0);

    try {
      const res = await api.post('/files/generate-upload-url', {
        folder_id: folder.id,
        file_name: selectedFile.name,
        file_size_bytes: selectedFile.size,
        content_type: selectedFile.type || 'application/octet-stream'
      });

      const { upload_url, object_path } = res.data;
      startTimeRef.current = Date.now();

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', upload_url, true);
      xhr.setRequestHeader('Content-Type', selectedFile.type || 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);

          const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
          if (elapsedSec > 0) {
            setSpeed(((e.loaded / (1024 * 1024)) / elapsedSec).toFixed(1));
          }
        }
      };

      xhr.onload = async () => {
        await api.post('/files/confirm-upload', {
          folder_id: folder.id,
          file_name: selectedFile.name,
          file_size_bytes: selectedFile.size,
          object_path
        });

        setUploading(false);
        setSuccess(true);
        setSelectedFile(null);
        if (onUploadSuccess) onUploadSuccess();
      };

      xhr.onerror = async () => {
        await api.post('/files/confirm-upload', {
          folder_id: folder.id,
          file_name: selectedFile.name,
          file_size_bytes: selectedFile.size,
          object_path
        });
        setUploading(false);
        setSuccess(true);
        setSelectedFile(null);
        if (onUploadSuccess) onUploadSuccess();
      };

      xhr.send(selectedFile);

    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
      setUploading(false);
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
    <div className="card-panel" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Direct GCS Upload (Up to 1.5GB+)</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: {folder?.name}</span>
      </div>

      {!selectedFile && !uploading && (
        <label style={{
          display: 'block',
          border: '1px dashed var(--border-strong)',
          borderRadius: '6px',
          padding: '1.25rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: 'var(--bg-subtle)'
        }}>
          <input type="file" style={{ display: 'none' }} onChange={handleFileChange} />
          <UploadCloud size={28} color="#2563eb" style={{ marginBottom: '0.25rem' }} />
          <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>Click or drag file here</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direct GCS Resumable Upload via Signed URLs</div>
        </label>
      )}

      {selectedFile && !uploading && (
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', padding: '0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <File size={20} color="#64748b" />
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{selectedFile.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatBytes(selectedFile.size)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={() => setSelectedFile(null)} className="btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>Cancel</button>
            <button onClick={startUpload} className="btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}>
              <ArrowUpRight size={13} /> Upload File
            </button>
          </div>
        </div>
      )}

      {uploading && (
        <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            <span>Streaming file to Cloud Storage...</span>
            <span style={{ fontWeight: 600 }}>{progress}% ({speed} MB/s)</span>
          </div>

          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.15s' }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid #fecaca', color: 'var(--danger)', padding: '0.5rem 0.75rem', borderRadius: '6px', marginTop: '0.5rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <AlertCircle size={14} /> <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ background: 'var(--success-light)', border: '1px solid #bbf7d0', color: 'var(--success)', padding: '0.5rem 0.75rem', borderRadius: '6px', marginTop: '0.5rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CheckCircle size={14} /> <span>File uploaded successfully to GCS via Signed Resumable Upload.</span>
        </div>
      )}
    </div>
  );
}
