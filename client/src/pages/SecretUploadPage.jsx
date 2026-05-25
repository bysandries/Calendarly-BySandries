import { useState, useRef, useCallback } from 'react';

const API_BASE = '/api';

function isValidArchive(filename) {
  const f = filename.toLowerCase();
  return f.endsWith('.zip') || f.endsWith('.tar') || f.endsWith('.tar.gz') || f.endsWith('.tgz');
}

async function uploadFile(file, password) {
  const formData = new FormData();
  formData.append('archive', file);

  const response = await fetch(`${API_BASE}/upload/graphify`, {
    method: 'POST',
    headers: {
      'x-upload-password': password,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok) {
    throw new Error(data.error || `Upload failed: ${response.status}`);
  }
  return data;
}

async function checkStatus(password) {
  const response = await fetch(`${API_BASE}/upload/graphify/status`, {
    headers: {
      'x-upload-password': password,
    },
  });
  const data = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok) {
    throw new Error(data.error || `Status check failed: ${response.status}`);
  }
  return data;
}

export default function SecretUploadPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const inputRef = useRef(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const s = await checkStatus(password);
      setStatus(s);
      setAuthenticated(true);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError('');
      setResult(null);
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const data = await uploadFile(file, password);
      setResult(data);
      const s = await checkStatus(password);
      setStatus(s);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="secret-upload-page">
        <div className="glass-panel-strong secret-upload-card">
          <div className="page-header" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.5rem' }}>Secret Upload</h2>
            <p className="page-description">Authenticate to access the graphify archive uploader.</p>
          </div>
          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label className="form-label">Upload Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter secret password..."
                autoFocus
              />
            </div>
            {authError && (
              <div style={{ color: '#ff8a7a', fontSize: '0.85rem', marginBottom: '12px' }}>
                {authError}
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="secret-upload-page">
      <div className="page-header">
        <h2>Secret Upload</h2>
        <p className="page-description">
          Upload your compressed <code>graphify-out</code> archive. It will be extracted to the workspace root.
        </p>
      </div>

      <div className="glass-panel-strong secret-upload-card">
        {/* Dropzone */}
        <div
          className={`secret-dropzone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.tar,.tar.gz,.tgz"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div className="secret-dropzone-icon">📦</div>
          {file ? (
            <div className="secret-dropzone-file">
              <strong>{file.name}</strong>
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          ) : (
            <>
              <div className="secret-dropzone-text">
                Drop your archive here or click to browse
              </div>
              <div className="secret-dropzone-hint">
                Supports .zip, .tar, .tar.gz, .tgz
              </div>
            </>
          )}
        </div>

        {file && !isValidArchive(file.name) && (
          <div className="secret-upload-error">
            Unsupported file type. Please upload a .zip, .tar, .tar.gz, or .tgz archive.
          </div>
        )}

        {error && (
          <div className="secret-upload-error">
            {error}
          </div>
        )}

        {result && (
          <div className="secret-upload-success">
            <strong>Success!</strong> Extracted {result.extractedCount} files to <code>graphify-out/</code>.
          </div>
        )}

        <div className="secret-upload-actions">
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || uploading || !isValidArchive(file.name)}
          >
            {uploading ? 'Extracting...' : 'Upload & Extract'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setFile(null);
              setError('');
              setResult(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            disabled={uploading}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Status Panel */}
      {status && (
        <div className="glass-panel secret-upload-card" style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
            Current graphify-out Status
          </h3>
          {status.exists ? (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '8px' }}>
                Folder exists with <strong>{status.stats.entryCount}</strong> top-level entries.
              </p>
              <div className="secret-status-list">
                {status.stats.topEntries.map((entry) => (
                  <span key={entry} className="tag-pill">{entry}</span>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No <code>graphify-out</code> folder found yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
