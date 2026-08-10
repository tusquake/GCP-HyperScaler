import React, { useState, useRef } from 'react';
import { UploadCloud, File, CheckCircle, AlertCircle, ArrowUpRight, Pause, Play, RotateCcw } from 'lucide-react';
import api from '../api/client';

export default function LargeFileUploader({ folder, onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const startTimeRef = useRef(null);
  const xhrRef = useRef(null);
  const uploadSessionRef = useRef({ uploadUrl: '', objectPath: '', loadedOffset: 0 });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError('');
      setSuccess(false);
      setProgress(0);
      setIsPaused(false);
      setUploading(false);
      uploadSessionRef.current = { uploadUrl: '', objectPath: '', loadedOffset: 0 };
    }
  };

  const startUpload = async () => {
    if (!selectedFile || !folder) return;

    setUploading(true);
    setIsPaused(false);
    setError('');
    setSuccess(false);
    setProgress(0);

    try {
      let uploadUrl = uploadSessionRef.current.uploadUrl;
      let objectPath = uploadSessionRef.current.objectPath;

      if (!uploadUrl) {
        const res = await api.post('/files/generate-upload-url', {
          folder_id: folder.id,
          file_name: selectedFile.name,
          file_size_bytes: selectedFile.size,
          content_type: selectedFile.type || 'application/octet-stream'
        });

        uploadUrl = res.data.upload_url;
        objectPath = res.data.object_path;
        uploadSessionRef.current = { uploadUrl, objectPath, loadedOffset: 0 };
      }

      startTimeRef.current = Date.now();
      performUploadXHR(uploadUrl, objectPath, selectedFile, 0);

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initialize GCS upload session');
      setUploading(false);
    }
  };

  const performUploadXHR = (uploadUrl, objectPath, file, offset) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    const fileChunk = offset > 0 ? file.slice(offset) : file;

    xhr.open('PUT', uploadUrl, true);
    if (offset > 0) {
      xhr.setRequestHeader('Content-Range', `bytes ${offset}-${file.size - 1}/${file.size}`);
    } else {
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const currentLoaded = offset + e.loaded;
        const pct = Math.min(99, Math.round((currentLoaded / file.size) * 100));
        setProgress(pct);
        uploadSessionRef.current.loadedOffset = currentLoaded;

        const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
        if (elapsedSec > 0) {
          setSpeed(((currentLoaded / (1024 * 1024)) / elapsedSec).toFixed(1));
        }
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200 || xhr.status === 201 || xhr.status === 308) {
        if (xhr.status === 308) {
          // Incomplete response - resume offset
          const rangeHeader = xhr.getResponseHeader('Range');
          if (rangeHeader) {
            const match = rangeHeader.match(/bytes=0-(\d+)/);
            if (match) {
              const lastByte = parseInt(match[1], 10);
              uploadSessionRef.current.loadedOffset = lastByte + 1;
            }
          }
          return;
        }

        setProgress(100);
        await api.post('/files/confirm-upload', {
          folder_id: folder.id,
          file_name: file.name,
          file_size_bytes: file.size,
          object_path: objectPath
        });

        setUploading(false);
        setIsPaused(false);
        setSuccess(true);
        setSelectedFile(null);
        uploadSessionRef.current = { uploadUrl: '', objectPath: '', loadedOffset: 0 };
        if (onUploadSuccess) onUploadSuccess();
      } else {
        setError(`Upload server returned status ${xhr.status}`);
        setUploading(false);
      }
    };

    xhr.onerror = () => {
      setError('Upload interrupted or connection lost');
      setUploading(false);
    };

    xhr.send(fileChunk);
  };

  const handlePause = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setUploading(false);
    setIsPaused(true);
  };

  const handleResume = () => {
    if (!uploadSessionRef.current.uploadUrl || !selectedFile) return;

    setUploading(true);
    setIsPaused(false);
    setError('');

    // Query GCS for current uploaded range status
    const xhr = new XMLHttpRequest();
    const { uploadUrl, objectPath } = uploadSessionRef.current;

    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Range', `bytes */${selectedFile.size}`);

    xhr.onload = () => {
      let offset = uploadSessionRef.current.loadedOffset || 0;
      const rangeHeader = xhr.getResponseHeader('Range');
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=0-(\d+)/);
        if (match) {
          offset = parseInt(match[1], 10) + 1;
        }
      }

      uploadSessionRef.current.loadedOffset = offset;
      startTimeRef.current = Date.now();
      performUploadXHR(uploadUrl, objectPath, selectedFile, offset);
    };

    xhr.onerror = () => {
      // Direct resume attempt with saved offset
      const offset = uploadSessionRef.current.loadedOffset || 0;
      startTimeRef.current = Date.now();
      performUploadXHR(uploadUrl, objectPath, selectedFile, offset);
    };

    xhr.send();
  };

  const handleCancel = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setSelectedFile(null);
    setUploading(false);
    setIsPaused(false);
    setProgress(0);
    uploadSessionRef.current = { uploadUrl: '', objectPath: '', loadedOffset: 0 };
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
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Direct Resumable GCS Upload (Up to 1.5GB+)
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: {folder?.name}</span>
      </div>

      {!selectedFile && !uploading && !isPaused && (
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
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Direct GCS Resumable Upload with Pause & Resume support</div>
        </label>
      )}

      {selectedFile && !uploading && !isPaused && (
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', padding: '0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <File size={20} color="#64748b" />
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{selectedFile.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatBytes(selectedFile.size)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={handleCancel} className="btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>Cancel</button>
            <button onClick={startUpload} className="btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}>
              <ArrowUpRight size={13} /> Start Upload
            </button>
          </div>
        </div>
      )}

      {uploading && (
        <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <File size={15} color="#2563eb" /> {selectedFile?.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>{progress}% ({speed} MB/s)</span>
              <button onClick={handlePause} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <Pause size={12} /> Pause
              </button>
              <button onClick={handleCancel} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: 'var(--danger)' }}>
                Cancel
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.15s' }} />
          </div>
        </div>
      )}

      {isPaused && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '0.85rem', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Pause size={15} color="#d97706" /> Upload Paused ({progress}% uploaded)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={handleResume} className="btn-primary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Play size={12} /> Resume Upload
              </button>
              <button onClick={handleCancel} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                Cancel
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: '6px', background: '#fcd34d', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#d97706' }} />
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
