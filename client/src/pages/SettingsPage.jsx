import React, { useState, useEffect } from 'react';
import './SettingsPage.css';

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Europe/Moscow',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC'
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  
  // Settings states
  const [dbSettings, setDbSettings] = useState({
    base_timezone: 'America/Los_Angeles',
    first_day_of_week: 'sunday',
    default_slot_duration: '30',
    time_format: '12h',
    date_format: 'YYYY-MM-DD',
    theme: 'midnight-abyss',
    palm_pillars: {
      Kindness: 'Kindness',
      Authenticity: 'Authenticity',
      Resilience: 'Resilience',
      Innovation: 'Innovation'
    }
  });

  const [envSettings, setEnvSettings] = useState({
    PORT: '3000',
    NODE_ENV: 'development',
    DB_ENCRYPTION_KEY: '',
    GEMINI_API_KEY: '',
    hasDbKey: false,
    hasGeminiKey: false
  });

  const [envEdits, setEnvEdits] = useState({});
  const [visibleSecrets, setVisibleSecrets] = useState({});
  
  // Backups and git status
  const [gitStatus, setGitStatus] = useState({ secure: true, missing: [] });
  const [dbStats, setDbStats] = useState({ size: '0.00 MB', rows: 0, integrity: 'Unknown' });
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [dbProfiles, setDbProfiles] = useState([]);
  
  // Decryption verification modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [uploadedBase64, setUploadedBase64] = useState(null);
  const [uploadedFilename, setUploadedFilename] = useState('');
  const [backupCandidateKey, setBackupCandidateKey] = useState('');
  const [uploadActionType, setUploadActionType] = useState('add_profile'); // 'add_profile' or 'activate'

  // Rename modal states
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingTarget, setRenamingTarget] = useState('');
  const [renameInputValue, setRenameInputValue] = useState('');

  // Choose action modal states (Activate vs Profile List on drop)
  const [showChooseActionModal, setShowChooseActionModal] = useState(false);

  // Fetch settings from server on mount
  const fetchAllSettings = async () => {
    setLoading(true);
    try {
      // 1. Get settings, env vars, and database profiles
      const settingsRes = await fetch('/api/settings');
      const settingsData = await settingsRes.json();
      
      if (settingsData.success) {
        if (settingsData.database) {
          setDbSettings(prev => ({
            ...prev,
            ...settingsData.database,
            palm_pillars: settingsData.database.palm_pillars || prev.palm_pillars
          }));
          
          // Apply theme from settings
          const selectedTheme = settingsData.database.theme || 'midnight-abyss';
          applyThemeClass(selectedTheme);
        }
        if (settingsData.environment) {
          setEnvSettings(settingsData.environment);
          setEnvEdits(settingsData.environment);
        }
        if (settingsData.databases) {
          setDbProfiles(settingsData.databases);
          
          // Set active DB statistics from active item
          const activeDb = settingsData.databases.find(db => db.isActive);
          if (activeDb) {
            setDbStats(prev => ({
              ...prev,
              size: activeDb.size
            }));
          }
        }
      }

      // 2. Get git health shield status
      const gitRes = await fetch('/api/settings/gitignore-status');
      const gitData = await gitRes.json();
      if (gitData.success) {
        setGitStatus(gitData);
      }

      // 3. Get database quick integrity stats
      const statsRes = await fetch('/api/health/integrity-check?check_only=true');
      const statsData = await statsRes.json();
      if (statsData.status === 'healthy' && statsData.details) {
        setDbStats(prev => ({
          ...prev,
          rows: statsData.details.eventsChecked || 0,
          integrity: 'Secure & Fully Intact'
        }));
      } else {
        setDbStats(prev => ({
          ...prev,
          rows: 'Unknown',
          integrity: 'Anomalies Detected / Needs Check'
        }));
      }
    } catch (err) {
      console.error(err);
      triggerAlert('error', 'Failed to retrieve settings from local Express server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const applyThemeClass = (themeName) => {
    const root = document.documentElement;
    // Reset theme classes
    root.classList.remove('midnight-abyss', 'slate-minimal', 'classic-light');
    
    if (themeName === 'midnight-abyss') {
      root.classList.add('midnight-abyss');
    } else if (themeName === 'slate-minimal') {
      root.classList.add('slate-minimal');
    } else if (themeName === 'classic-light') {
      root.classList.add('classic-light');
    }
  };

  // ── Database Settings Form Submission ──
  const handleSaveDbSettings = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbSettings)
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert('success', 'Local scheduling preferences saved successfully.');
        applyThemeClass(dbSettings.theme);
      } else {
        triggerAlert('error', data.error || 'Failed to apply preferences.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error connecting to Express database schema.');
    } finally {
      setSaving(false);
    }
  };

  // ── Environmental Secrets Submission ──
  const handleSaveEnvSettings = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envEdits)
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert('success', 'Environmental variables rewritten. Connection hot-reloaded successfully!');
        setEnvSettings(data.environment);
        setEnvEdits(data.environment);
      } else {
        triggerAlert('error', data.error || 'Failed to write environment secrets.');
      }
    } catch (err) {
      triggerAlert('error', 'Failed to communicate with Express server configuration file.');
    } finally {
      setSaving(false);
    }
  };

  // ── Manual DB Backup Download Trigger ──
  const handleDownloadBackup = (filename = null) => {
    if (filename && filename !== 'calendarly.db') {
      // Stream specific profile backup download by opening its URL or writing a download route
      window.open(`/api/settings/backup/download?file=${encodeURIComponent(filename)}`, '_blank');
    } else {
      window.open('/api/settings/backup/download', '_blank');
    }
    triggerAlert('success', 'Generating database backup copy... Download started.');
  };

  // ── Manual Trigger DB Health Integrity Check ──
  const handleIntegrityCheck = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/health/integrity-check');
      const data = await res.json();
      if (data.status === 'healthy' || data.status === 'recovered') {
        triggerAlert('success', `Integrity check complete: ${data.message}`);
        setDbStats(prev => ({ ...prev, integrity: 'Secure & Fully Intact' }));
      } else {
        triggerAlert('error', `Integrity anomalies found: ${data.message}`);
        setDbStats(prev => ({ ...prev, integrity: 'Warning: Anomalies Detected' }));
      }
    } catch (err) {
      triggerAlert('error', 'Integrity verification request failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Drag & Drop Database Restore Upload ──
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processBackupFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      processBackupFile(files[0]);
    }
  };

  // Process selected backup DB file
  const processBackupFile = (file) => {
    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
      triggerAlert('error', 'Incompatible format. Please upload a SQLite database file (.db).');
      return;
    }

    setUploadProgress('Reading backup database...');
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1];
      setUploadedBase64(base64);
      setUploadedFilename(file.name);
      setUploadProgress(null);
      
      // Open action choice modal: Let them decide if they want to activate immediately or just add to list!
      setShowChooseActionModal(true);
    };
    reader.onerror = () => {
      triggerAlert('error', 'Error reading database file.');
      setUploadProgress(null);
    };
    reader.readAsDataURL(file);
  };

  // Trigger server-side upload verification
  const uploadBackupToServer = async (base64Data, name, key, activateNow) => {
    setSaving(true);
    setUploadProgress('Verifying SQLite database integrity...');
    try {
      const res = await fetch('/api/settings/backup/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: base64Data,
          filename: name,
          candidateKey: key !== null && key !== '' ? key : undefined,
          activateImmediately: activateNow
        })
      });
      const data = await res.json();
      
      setUploadProgress(null);

      if (data.status === 'key_required') {
        // Backup is encrypted with a different key! Prompt user for decryption key.
        setUploadActionType(activateNow ? 'activate' : 'add_profile');
        setShowKeyModal(true);
      } else if (data.success) {
        triggerAlert('success', data.message || 'Database backup processed successfully!');
        setShowKeyModal(false);
        setShowChooseActionModal(false);
        setBackupCandidateKey('');
        setUploadedBase64(null);
        // Refresh settings & profiles
        fetchAllSettings();
      } else {
        triggerAlert('error', data.error || 'Failed to process database.');
        setShowKeyModal(false);
        setShowChooseActionModal(false);
        setBackupCandidateKey('');
      }
    } catch (err) {
      triggerAlert('error', 'Database operation failed. Local server rolled back safely.');
      setUploadProgress(null);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyModalSubmit = () => {
    if (!backupCandidateKey) {
      triggerAlert('error', 'Please provide a valid encryption key.');
      return;
    }
    const activateNow = uploadActionType === 'activate';
    uploadBackupToServer(uploadedBase64, uploadedFilename, backupCandidateKey, activateNow);
  };

  const handleKeyModalCancel = () => {
    setShowKeyModal(false);
    setBackupCandidateKey('');
    setUploadedBase64(null);
    triggerAlert('error', 'Database operation aborted by user.');
  };

  // ── Database Profile Actions ──
  const handleActivateProfile = async (filename) => {
    if (filename === 'calendarly.db') return;
    setSaving(true);
    setUploadProgress(`Activating database profile '${filename}'...`);
    try {
      const res = await fetch('/api/settings/backup/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const data = await res.json();
      setUploadProgress(null);
      if (data.success) {
        triggerAlert('success', data.message);
        fetchAllSettings();
      } else {
        triggerAlert('error', data.error || 'Failed to activate profile.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error activating profile.');
      setUploadProgress(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (filename) => {
    if (filename === 'calendarly.db') return;
    if (!window.confirm(`Are you sure you want to permanently delete the profile '${filename}'?`)) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/settings/backup/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert('success', data.message);
        fetchAllSettings();
      } else {
        triggerAlert('error', data.error || 'Failed to delete profile.');
      }
    } catch (err) {
      triggerAlert('error', 'Error sending delete request.');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameProfileClick = (filename) => {
    setRenamingTarget(filename);
    setRenameInputValue(filename);
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async () => {
    if (!renameInputValue.trim()) {
      triggerAlert('error', 'Filename cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings/backup/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldFilename: renamingTarget,
          newFilename: renameInputValue.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert('success', data.message);
        setShowRenameModal(false);
        setRenameInputValue('');
        fetchAllSettings();
      } else {
        triggerAlert('error', data.error || 'Failed to rename profile.');
      }
    } catch (err) {
      triggerAlert('error', 'Error sending rename request.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSecretVisibility = (key) => {
    setVisibleSecrets(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePillarChange = (key, value) => {
    setDbSettings(prev => ({
      ...prev,
      palm_pillars: {
        ...prev.palm_pillars,
        [key]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="settings-container text-center" style={{ paddingTop: '100px' }}>
        <div className="spinner">⚙️</div>
        <p style={{ marginTop: '16px', color: '#94a3b8' }}>Syncing local settings modules...</p>
      </div>
    );
  }

  return (
    <div className="settings-container">
      {/* Settings Header */}
      <header className="settings-header">
        <h1>Settings Center</h1>
        <p>Manage your local-first scheduling preferences, database sync backups, and environment configurations.</p>
      </header>

      {/* Git Shield Alerts */}
      <div className="git-shield-container">
        <div className={`git-shield-icon ${gitStatus.secure ? 'secure' : 'warning'}`}>
          {gitStatus.secure ? '🛡️' : '⚠️'}
        </div>
        <div className="git-shield-details">
          <h4>Git Security Shield</h4>
          {gitStatus.secure ? (
            <p>Your local backup files, environment credentials, and AI tools are fully isolated and ignored from Git commits.</p>
          ) : (
            <p style={{ color: '#f87171' }}>
              Warning: Unprotected files detected! The following directories are vulnerable to commit: <br />
              <strong>{gitStatus.missing.join(', ')}</strong>. Please review your `.gitignore` configuration immediately.
            </p>
          )}
        </div>
      </div>

      {alert && (
        <div className={`settings-alert ${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '❌'}</span>
          <p>{alert.message}</p>
        </div>
      )}

      {/* Upload Progress Loader */}
      {uploadProgress && (
        <div className="settings-alert success" style={{ animation: 'pulse 1.5s infinite' }}>
          <span>⚙️</span>
          <p>{uploadProgress}</p>
        </div>
      )}

      {/* Settings Panel Grid */}
      <div className="settings-grid">
        {/* Sidebar Nav Tabs */}
        <aside className="settings-tabs-sidebar">
          <button 
            className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <span className="tab-btn-icon">📅</span>
            <span>General Settings</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'backups' ? 'active' : ''}`}
            onClick={() => setActiveTab('backups')}
          >
            <span className="tab-btn-icon">🗄️</span>
            <span>Database Backups</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'secrets' ? 'active' : ''}`}
            onClick={() => setActiveTab('secrets')}
          >
            <span className="tab-btn-icon">🔑</span>
            <span>System Credentials</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'personalization' ? 'active' : ''}`}
            onClick={() => setActiveTab('personalization')}
          >
            <span className="tab-btn-icon">🎨</span>
            <span>Personalization</span>
          </button>
        </aside>

        {/* Dynamic Panels */}
        <main className="settings-panel">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveDbSettings}>
              <div className="panel-header">
                <h2>General & Localization</h2>
                <p>Configure calendar view alignments, default slot times, and base timezone displays.</p>
              </div>

              <div className="form-group">
                <label htmlFor="base_timezone">Base Time Zone</label>
                <select 
                  id="base_timezone"
                  className="form-select"
                  value={dbSettings.base_timezone}
                  onChange={(e) => setDbSettings({ ...dbSettings, base_timezone: e.target.value })}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="first_day_of_week">First Day of the Week</label>
                <select 
                  id="first_day_of_week"
                  className="form-select"
                  value={dbSettings.first_day_of_week}
                  onChange={(e) => setDbSettings({ ...dbSettings, first_day_of_week: e.target.value })}
                >
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="default_slot_duration">Default Slot Duration</label>
                <select 
                  id="default_slot_duration"
                  className="form-select"
                  value={dbSettings.default_slot_duration}
                  onChange={(e) => setDbSettings({ ...dbSettings, default_slot_duration: e.target.value })}
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="time_format">Time Format</label>
                <select 
                  id="time_format"
                  className="form-select"
                  value={dbSettings.time_format}
                  onChange={(e) => setDbSettings({ ...dbSettings, time_format: e.target.value })}
                >
                  <option value="12h">12-hour (AM/PM)</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>

              <div style={{ marginTop: '30px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: BACKUPS & MULTIPLE DATABASES */}
          {activeTab === 'backups' && (
            <div>
              <div className="panel-header">
                <h2>Database Profiles & Backups</h2>
                <p>Upload multiple database profiles, toggle between active calendars, or download snapshots.</p>
              </div>

              {/* Stats Cards */}
              <div className="db-status-container">
                <div className="db-stat-card">
                  <div className="label">File Size</div>
                  <div className="value">{dbStats.size}</div>
                </div>
                <div className="db-stat-card">
                  <div className="label">Active Records</div>
                  <div className="value">{dbStats.rows} items</div>
                </div>
                <div className="db-stat-card">
                  <div className="label">Schema Integrity</div>
                  <div className="value" style={{ color: dbStats.integrity.includes('Intact') ? '#34d399' : '#f87171' }}>
                    {dbStats.integrity}
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div 
                className={`dropzone ${isDragOver ? 'dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('backup-file-input').click()}
              >
                <span className="dropzone-icon">📤</span>
                <p>Drag and drop a <strong>.db</strong> SQLite file to add multiple databases</p>
                <p className="hint">Upload work profiles, home backups, or previous calendars. You can hot-swap them instantly below.</p>
                <input 
                  type="file" 
                  id="backup-file-input"
                  className="file-input-hidden" 
                  accept=".db,.sqlite"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Database Profiles Section */}
              <h3 style={{ fontSize: '16px', margin: '24px 0 12px 0', color: '#ffffff', fontWeight: '500' }}>
                Available Database Profiles
              </h3>

              <div className="databases-list">
                {dbProfiles.map(profile => (
                  <div 
                    key={profile.filename} 
                    className={`db-profile-card ${profile.isActive ? 'active' : ''}`}
                  >
                    <div className="db-profile-meta">
                      <div className="db-profile-icon">
                        {profile.isActive ? '⚡' : '📂'}
                      </div>
                      <div className="db-profile-info">
                        <h4>
                          {profile.filename}
                          {profile.isActive && <span className="active-badge">Active</span>}
                        </h4>
                        <p>Size: {profile.size} • Last Modified: {new Date(profile.mtime).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="db-profile-actions">
                      {/* Activate Button */}
                      {!profile.isActive && (
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 12px', fontSize: '12.5px' }}
                          onClick={() => handleActivateProfile(profile.filename)}
                          disabled={saving}
                          title="Activate calendar profile"
                        >
                          Activate
                        </button>
                      )}
                      
                      {/* Rename Button */}
                      {!profile.isActive && (
                        <button 
                          className="icon-btn"
                          onClick={() => handleRenameProfileClick(profile.filename)}
                          disabled={saving}
                          title="Rename profile"
                        >
                          ✏️
                        </button>
                      )}

                      {/* Download Snapshot */}
                      <button 
                        className="icon-btn"
                        onClick={() => handleDownloadBackup(profile.filename)}
                        title="Download backup file"
                      >
                        📥
                      </button>

                      {/* Delete Button */}
                      {!profile.isActive && (
                        <button 
                          className="icon-btn danger"
                          onClick={() => handleDeleteProfile(profile.filename)}
                          disabled={saving}
                          title="Delete profile"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="db-actions-group" style={{ marginTop: '24px' }}>
                <button className="btn btn-secondary" onClick={handleIntegrityCheck} disabled={saving}>
                  🛡️ Run Schema Integrity Check on Active DB
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SECRETS */}
          {activeTab === 'secrets' && (
            <form onSubmit={handleSaveEnvSettings}>
              <div className="panel-header">
                <h2>Environment Configurations (.env)</h2>
                <p>Modify port assignments and active AI/encryption tokens. Keys are written directly to your isolated configuration files.</p>
              </div>

              <div className="secrets-grid">
                <div className="form-group">
                  <div className="secret-row-label">
                    <label htmlFor="env-port">PORT</label>
                  </div>
                  <input 
                    type="text" 
                    id="env-port"
                    className="form-input"
                    value={envEdits.PORT || ''}
                    onChange={(e) => setEnvEdits({ ...envEdits, PORT: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <div className="secret-row-label">
                    <label htmlFor="env-node-env">NODE_ENV</label>
                  </div>
                  <select 
                    id="env-node-env"
                    className="form-select"
                    value={envEdits.NODE_ENV || 'development'}
                    onChange={(e) => setEnvEdits({ ...envEdits, NODE_ENV: e.target.value })}
                  >
                    <option value="development">development</option>
                    <option value="production">production</option>
                  </select>
                </div>

                <div className="form-group">
                  <div className="secret-row-label">
                    <label htmlFor="env-db-key">DB_ENCRYPTION_KEY</label>
                    <span className={`secret-badge ${envSettings.hasDbKey ? 'configured' : 'empty'}`}>
                      {envSettings.hasDbKey ? 'Configured' : 'Empty'}
                    </span>
                  </div>
                  <div className="input-with-action">
                    <input 
                      type={visibleSecrets.dbKey ? 'text' : 'password'} 
                      id="env-db-key"
                      className="form-input"
                      value={envEdits.DB_ENCRYPTION_KEY || ''}
                      placeholder={envSettings.hasDbKey ? '••••••••••••••••••••••••' : 'Enter pass key passphrase'}
                      onChange={(e) => setEnvEdits({ ...envEdits, DB_ENCRYPTION_KEY: e.target.value })}
                    />
                    <button 
                      type="button" 
                      className="toggle-visibility-btn"
                      onClick={() => toggleSecretVisibility('dbKey')}
                    >
                      {visibleSecrets.dbKey ? '👁️' : '🕶️'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <div className="secret-row-label">
                    <label htmlFor="env-gemini-key">GEMINI_API_KEY</label>
                    <span className={`secret-badge ${envSettings.hasGeminiKey ? 'configured' : 'empty'}`}>
                      {envSettings.hasGeminiKey ? 'Configured' : 'Empty'}
                    </span>
                  </div>
                  <div className="input-with-action">
                    <input 
                      type={visibleSecrets.geminiKey ? 'text' : 'password'} 
                      id="env-gemini-key"
                      className="form-input"
                      value={envEdits.GEMINI_API_KEY || ''}
                      placeholder={envSettings.hasGeminiKey ? '••••••••••••••••••••••••' : 'Enter Gemini API key'}
                      onChange={(e) => setEnvEdits({ ...envEdits, GEMINI_API_KEY: e.target.value })}
                    />
                    <button 
                      type="button" 
                      className="toggle-visibility-btn"
                      onClick={() => toggleSecretVisibility('geminiKey')}
                    >
                      {visibleSecrets.geminiKey ? '👁️' : '🕶️'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '30px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Rewriting Credentials...' : 'Save Secrets'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: PERSONALIZATION */}
          {activeTab === 'personalization' && (
            <form onSubmit={handleSaveDbSettings}>
              <div className="panel-header">
                <h2>Aesthetics & Personalization</h2>
                <p>Toggle high-contrast theme variations or customize methodology pillars labels.</p>
              </div>

              {/* Theme Customization Cards */}
              <div className="form-group">
                <label>Theme Selection</label>
                <div className="theme-selector-grid">
                  <div 
                    className={`theme-card midnight-abyss ${dbSettings.theme === 'midnight-abyss' ? 'active' : ''}`}
                    onClick={() => setDbSettings({ ...dbSettings, theme: 'midnight-abyss' })}
                  >
                    <h4>Midnight Abyss</h4>
                    <p style={{ fontSize: '11px', margin: '4px 0 0 0', color: '#64748b' }}>Sleek Neon Dark</p>
                    <div className="theme-preview-dots">
                      <span style={{ background: '#c084fc' }} />
                      <span style={{ background: '#0f172a' }} />
                    </div>
                  </div>

                  <div 
                    className={`theme-card slate-minimal ${dbSettings.theme === 'slate-minimal' ? 'active' : ''}`}
                    onClick={() => setDbSettings({ ...dbSettings, theme: 'slate-minimal' })}
                  >
                    <h4>Slate Minimal</h4>
                    <p style={{ fontSize: '11px', margin: '4px 0 0 0', color: '#64748b' }}>Monochrome Grayscale</p>
                    <div className="theme-preview-dots">
                      <span style={{ background: '#94a3b8' }} />
                      <span style={{ background: '#1e1e24' }} />
                    </div>
                  </div>

                  <div 
                    className={`theme-card classic-light ${dbSettings.theme === 'classic-light' ? 'active' : ''}`}
                    onClick={() => setDbSettings({ ...dbSettings, theme: 'classic-light' })}
                  >
                    <h4>Classic Light</h4>
                    <p style={{ fontSize: '11px', margin: '4px 0 0 0', color: '#94a3b8' }}>Daylight Paper</p>
                    <div className="theme-preview-dots">
                      <span style={{ background: '#6366f1' }} />
                      <span style={{ background: '#f8fafc' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* GTD Custom Pillars */}
              <div className="form-group" style={{ marginTop: '30px' }}>
                <label>GTD Methodology Pillars</label>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 12px 0' }}>
                  Align project objectives to your key life pillars. Rename them below:
                </p>

                <div className="pillar-row">
                  <span className="pillar-color-indicator" style={{ background: '#3498db' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    value={dbSettings.palm_pillars.Kindness}
                    onChange={(e) => handlePillarChange('Kindness', e.target.value)}
                  />
                </div>

                <div className="pillar-row">
                  <span className="pillar-color-indicator" style={{ background: '#9b59b6' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    value={dbSettings.palm_pillars.Authenticity}
                    onChange={(e) => handlePillarChange('Authenticity', e.target.value)}
                  />
                </div>

                <div className="pillar-row">
                  <span className="pillar-color-indicator" style={{ background: '#2ecc71' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    value={dbSettings.palm_pillars.Resilience}
                    onChange={(e) => handlePillarChange('Resilience', e.target.value)}
                  />
                </div>

                <div className="pillar-row">
                  <span className="pillar-color-indicator" style={{ background: '#e67e22' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    value={dbSettings.palm_pillars.Innovation}
                    onChange={(e) => handlePillarChange('Innovation', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: '30px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Apply Aesthetics'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* MODAL 1: Choose Action Modal (On Drop / File selection) */}
      {showChooseActionModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal" style={{ maxWidth: '460px' }}>
            <h3>📂 Database Upload Action</h3>
            <p>
              You are importing the database profile <strong>'{uploadedFilename}'</strong>. Would you like to add it directly to your profile list, or activate it immediately as your live calendar?
            </p>
            <div className="modal-actions" style={{ flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-primary btn-full"
                onClick={() => {
                  setShowChooseActionModal(false);
                  uploadBackupToServer(uploadedBase64, uploadedFilename, null, false);
                }}
                disabled={saving}
              >
                Add to Backup Profiles List Only
              </button>
              <button 
                className="btn btn-secondary btn-full"
                style={{ background: 'rgba(192, 132, 252, 0.12)', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }}
                onClick={() => {
                  setShowChooseActionModal(false);
                  uploadBackupToServer(uploadedBase64, uploadedFilename, null, true);
                }}
                disabled={saving}
              >
                ⚡ Upload & Activate Calendar Immediately
              </button>
              <button 
                className="btn btn-secondary btn-full"
                style={{ marginTop: '10px' }}
                onClick={() => {
                  setShowChooseActionModal(false);
                  setUploadedBase64(null);
                  setUploadedFilename('');
                }}
              >
                Cancel Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Decryption Key Request Modal */}
      {showKeyModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal">
            <h3>🔑 Decryption Key Required</h3>
            <p>
              The database backup <strong>'{uploadedFilename}'</strong> is encrypted. Please supply the key originally used to secure it to decrypt and convert it to match your current server active key.
            </p>
            <div className="form-group">
              <label htmlFor="candidate-modal-key">Backup Encryption Key</label>
              <input 
                type="password" 
                id="candidate-modal-key" 
                className="form-input"
                value={backupCandidateKey}
                onChange={(e) => setBackupCandidateKey(e.target.value)}
                placeholder="Enter passphrase..."
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={handleKeyModalCancel}>
                Cancel Restore
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleKeyModalSubmit} 
                disabled={saving}
              >
                {saving ? 'Decrypting...' : 'Verify & Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Rename Profile Modal */}
      {showRenameModal && (
        <div className="settings-modal-overlay">
          <div className="settings-modal">
            <h3>✏️ Rename Database Profile</h3>
            <p>Rename your database profile file. Please ensure it ends with <strong>.db</strong>.</p>
            <div className="form-group">
              <label htmlFor="rename-input">Profile Filename</label>
              <input 
                type="text" 
                id="rename-input" 
                className="form-input"
                value={renameInputValue}
                onChange={(e) => setRenameInputValue(e.target.value)}
                placeholder="e.g., my_work_calendar.db"
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameInputValue('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleRenameSubmit}
                disabled={saving}
              >
                {saving ? 'Renaming...' : 'Rename File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
