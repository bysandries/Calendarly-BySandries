import React, { useState, useEffect, useRef } from 'react';
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
  // Context preset editor state
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetItems, setNewPresetItems] = useState([]);

  const [dbSettings, setDbSettings] = useState({
    base_timezone: 'America/Los_Angeles',
    first_day_of_week: 'sunday',
    default_slot_duration: '30',
    time_format: '12h',
    date_format: 'YYYY-MM-DD',
    theme: 'midnight-abyss',
    default_assignee: '',
    context_presets: [],
    navigation_config: {
      groups: [
        { id: 'Workspace', label: 'Workspace', enabled: true },
        { id: 'Work',    label: 'Work',    enabled: true },
        { id: 'Capture', label: 'Capture', enabled: true },
        { id: 'Life',    label: 'Life',    enabled: true },
        { id: 'System',  label: 'System',  enabled: true },
      ],
      items: [
        { id: '/focus',         label: 'Workspace',            enabled: true, group: 'Workspace' },
        { id: '/pomodoro',      label: 'Pomodoro',             enabled: true, group: 'Workspace' },
        { id: '/tasks',         label: 'Tasks',                enabled: true, group: 'Work'    },
        { id: '/projects',      label: 'Projects',             enabled: true, group: 'Work'    },
        { id: '/team',          label: 'Team',                 enabled: true, group: 'Work'    },
        { id: '/gtd',           label: 'GTD Inbox',            enabled: true, group: 'Capture' },
        { id: '/kanban',        label: 'Kanban Board',         enabled: true, group: 'Capture' },
        { id: '/notes',         label: 'Extracts',             enabled: true, group: 'Capture' },
        { id: '/omni-history',  label: 'Omni History',         enabled: true, group: 'Capture' },
        { id: '/habits',        label: 'Habits',               enabled: true, group: 'Life'    },
        { id: '/personal-care', label: 'Personal Care',        enabled: true, group: 'Life'    },
        { id: '/calendar',      label: 'Calendar Tracking',    enabled: true, group: 'Life'    },
        { id: '/timeline',      label: 'Life Map',             enabled: true, group: 'Life'    },
        { id: '/analytics',     label: 'Reflection Dashboard', enabled: true, group: 'System'  },
        { id: '/agents',        label: 'Code Agents',          enabled: true, group: 'System'  },
        { id: '/settings',      label: 'Settings',             enabled: true, group: 'System'  },
      ],
    },
    palm_pillars: {
      Kindness: 'Kindness',
      Authenticity: 'Authenticity',
      Resilience: 'Resilience',
      Innovation: 'Innovation'
    }
  });

  // Keep a live ref to dbSettings so async save handlers always read the latest state
  const dbSettingsRef = useRef(dbSettings);
  useEffect(() => { dbSettingsRef.current = dbSettings; }, [dbSettings]);

  // Broadcast nav config changes to the Sidebar for live preview (without saving)
  useEffect(() => {
    if (!navConfigDirtyRef.current) return;
    navConfigDirtyRef.current = false;
    window.dispatchEvent(new CustomEvent('nav-preview-changed', { detail: dbSettings.navigation_config }));
  }, [dbSettings.navigation_config]);

  const [people, setPeople] = useState([]);

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
  const [draggedGroupId, setDraggedGroupId] = useState(null);
  const [draggedItemId, setDraggedItemId] = useState(null);
  const navConfigDirtyRef = useRef(false);
  
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
    console.log('[Settings] Syncing local modules...');
    
    // Core data: Settings and People
    try {
      const [settingsRes, peopleRes] = await Promise.all([
        fetch('/api/settings').catch(e => { console.error('Settings fetch failed', e); return null; }),
        fetch('/api/people').catch(e => { console.error('People fetch failed', e); return null; })
      ]);

      if (settingsRes && settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.success) {
          if (settingsData.database) {
            setDbSettings(prev => {
              const base = {
                ...prev,
                ...settingsData.database,
                palm_pillars: (settingsData.database.palm_pillars && typeof settingsData.database.palm_pillars === 'object') 
                  ? settingsData.database.palm_pillars 
                  : prev.palm_pillars,
                default_assignee: settingsData.database.default_assignee || ''
              };

              // Parse context_presets
              if (settingsData.database.context_presets) {
                let cp = settingsData.database.context_presets;
                if (typeof cp === 'string') {
                  try { cp = JSON.parse(cp); } catch { cp = []; }
                }
                if (Array.isArray(cp)) base.context_presets = cp;
              }

              // Merge navigation_config — handles both old flat-array and new {groups,items} format
              if (settingsData.database.navigation_config) {
                let saved = settingsData.database.navigation_config;
                if (typeof saved === 'string') {
                  try { saved = JSON.parse(saved); } catch { saved = null; }
                }

                if (saved) {
                  const defaultCfg = prev.navigation_config;

                  if (Array.isArray(saved)) {
                    // Old format → migrate: keep user's label/enabled, add group from default
                    const migratedItems = defaultCfg.items.map(def => {
                      const s = saved.find(x => x.id === def.id);
                      return s ? { ...def, label: s.label, enabled: s.enabled } : def;
                    });
                    base.navigation_config = { groups: defaultCfg.groups, items: migratedItems };
                  } else if (saved.groups && saved.items) {
                    // New format → merge in any items/groups that were added since last save
                    const mergedItems = [...saved.items];
                    defaultCfg.items.forEach(def => {
                      if (!mergedItems.find(m => m.id === def.id)) mergedItems.push(def);
                    });
                    const mergedGroups = [...saved.groups];
                    defaultCfg.groups.forEach(def => {
                      if (!mergedGroups.find(g => g.id === def.id)) mergedGroups.push(def);
                    });
                    base.navigation_config = { groups: mergedGroups, items: mergedItems };
                  }
                }
              }
              return base;
            });
            const selectedTheme = settingsData.database.theme || 'midnight-abyss';
            applyThemeClass(selectedTheme);
          }
          if (settingsData.environment) {
            setEnvSettings(settingsData.environment);
            setEnvEdits(settingsData.environment);
          }
          if (settingsData.databases) {
            setDbProfiles(settingsData.databases);
            const activeDb = settingsData.databases.find(db => db.isActive);
            if (activeDb) {
              setDbStats(prev => ({ ...prev, size: activeDb.size }));
            }
          }
        }
      }

      if (peopleRes && peopleRes.ok) {
        const peopleData = await peopleRes.json();
        if (Array.isArray(peopleData)) {
          setPeople(peopleData);
        }
      }
    } catch (err) {
      console.error('[Settings] Core fetch error:', err);
      triggerAlert('error', 'Failed to retrieve core settings.');
    } finally {
      // SET LOADING TO FALSE IMMEDIATELY AFTER CORE DATA
      setLoading(false);
    }

    // DEFERRED DATA: Slow checks run in background
    fetchDeferredSettings();
  };

  const fetchDeferredSettings = async () => {
    console.log('[Settings] Running background health checks...');
    
    // 1. Git health shield status
    fetch('/api/settings/gitignore-status')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.success) setGitStatus(data);
      })
      .catch(e => console.error('Git status fetch failed', e));

    // 2. Database integrity check (The slow one)
    fetch('/api/health/integrity-check?check_only=true')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.status === 'healthy' && data.details) {
          setDbStats(prev => ({
            ...prev,
            rows: data.details.eventsChecked || 0,
            integrity: 'Secure & Fully Intact'
          }));
        } else {
          setDbStats(prev => ({
            ...prev,
            rows: 'Unknown',
            integrity: 'Anomalies Detected / Needs Check'
          }));
        }
      })
      .catch(e => console.error('Integrity check fetch failed', e));
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
      const settings = dbSettingsRef.current;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert('success', 'Local scheduling preferences saved successfully.');
        applyThemeClass(settings.theme);
        window.dispatchEvent(new CustomEvent('nav-settings-saved'));
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

  const handleBatchAssignDefault = async () => {
    if (!dbSettings.default_assignee) {
      triggerAlert('error', 'Please select a Default Assignee first.');
      return;
    }

    if (!window.confirm('This will assign the default team member to ALL currently unassigned tasks and projects. Continue?')) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings/batch-assign-default', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        triggerAlert('success', `${data.message} Updated ${data.details.projectsUpdated} projects and ${data.details.tasksUpdated} tasks.`);
      } else {
        triggerAlert('error', data.error || 'Batch assignment failed.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error during batch assignment.');
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
        ...(prev.palm_pillars || {}),
        [key]: value
      }
    }));
  };

  // ── UI Navigation Customization ──
  const setNavCfg = (updater) => {
    navConfigDirtyRef.current = true;
    setDbSettings(prev => ({ ...prev, navigation_config: updater(prev.navigation_config) }));
  };

  // Group handlers
  const handleGroupLabel   = (id, label) => setNavCfg(c => ({ ...c, groups: c.groups.map(g => g.id === id ? { ...g, label } : g) }));
  const handleGroupToggle  = (id)        => setNavCfg(c => ({ ...c, groups: c.groups.map(g => g.id === id ? { ...g, enabled: !g.enabled } : g) }));

  const handleGroupDragStart = (e, id) => { setDraggedGroupId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleGroupDragOver  = (e, id) => {
    e.preventDefault();
    if (!draggedGroupId || draggedGroupId === id) return;
    setNavCfg(c => {
      const groups = [...c.groups];
      const from = groups.findIndex(g => g.id === draggedGroupId);
      const to   = groups.findIndex(g => g.id === id);
      if (from < 0 || to < 0) return c;
      const [moved] = groups.splice(from, 1);
      groups.splice(to, 0, moved);
      return { ...c, groups };
    });
  };
  const handleGroupDragEnd = () => setDraggedGroupId(null);

  // Item handlers
  const handleItemLabel  = (id, label) => setNavCfg(c => ({ ...c, items: c.items.map(i => i.id === id ? { ...i, label } : i) }));
  const handleItemToggle = (id)        => setNavCfg(c => ({ ...c, items: c.items.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i) }));
  const handleItemGroup  = (id, group) => setNavCfg(c => ({ ...c, items: c.items.map(i => i.id === id ? { ...i, group } : i) }));

  const handleItemDragStart = (e, id) => { e.stopPropagation(); setDraggedItemId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleItemDragOver  = (e, id, groupId) => {
    e.preventDefault(); e.stopPropagation();
    if (!draggedItemId || draggedItemId === id) return;
    setNavCfg(c => {
      const dragged = c.items.find(i => i.id === draggedItemId);
      if (!dragged || dragged.group !== groupId) return c; // only within same group
      const items = [...c.items];
      const from = items.findIndex(i => i.id === draggedItemId);
      const to   = items.findIndex(i => i.id === id);
      if (from < 0 || to < 0) return c;
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...c, items };
    });
  };
  const handleItemDragEnd = () => setDraggedItemId(null);

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
              <strong>{(gitStatus.missing || []).join(', ') || gitStatus.error || 'Unknown'}</strong>. Please review your `.gitignore` configuration immediately.
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
          <button 
            className={`tab-btn ${activeTab === 'ui' ? 'active' : ''}`}
            onClick={() => setActiveTab('ui')}
          >
            <span className="tab-btn-icon">📱</span>
            <span>Interface & Navigation</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <span className="tab-btn-icon">👥</span>
            <span>Team Settings</span>
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

              <div className="db-actions-group" style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={handleIntegrityCheck} disabled={saving}>
                  🛡️ Run Schema Integrity Check on Active DB
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('calendarly_api_token') || '';
                      const res = await fetch('/api/export', {
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                      });
                      if (!res.ok) throw new Error('Export failed');
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `calendarly-export-${new Date().toISOString().split('T')[0]}.zip`;
                      a.click();
                      URL.revokeObjectURL(url);
                      triggerAlert('success', 'Export downloaded successfully.');
                    } catch {
                      triggerAlert('error', 'Export failed. Try again.');
                    }
                  }}
                >
                  📦 Export All Data (CSV / JSON / Markdown)
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
                    value={dbSettings.palm_pillars?.Kindness || ''}
                    onChange={(e) => handlePillarChange('Kindness', e.target.value)}
                  />
                </div>

                <div className="pillar-row">
                  <span className="pillar-color-indicator" style={{ background: '#9b59b6' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    value={dbSettings.palm_pillars?.Authenticity || ''}
                    onChange={(e) => handlePillarChange('Authenticity', e.target.value)}
                  />
                </div>

                <div className="pillar-row">
                  <span className="pillar-color-indicator" style={{ background: '#2ecc71' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    value={dbSettings.palm_pillars?.Resilience || ''}
                    onChange={(e) => handlePillarChange('Resilience', e.target.value)}
                  />
                </div>

                <div className="pillar-row">
                  <span className="pillar-color-indicator" style={{ background: '#e67e22' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    value={dbSettings.palm_pillars?.Innovation || ''}
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

          {/* TAB 5: UI & NAVIGATION */}
          {activeTab === 'ui' && (
            <form onSubmit={handleSaveDbSettings}>
              <div className="panel-header">
                <h2>Interface &amp; Navigation</h2>
                <p>Organize your sidebar into groups. Drag to reorder groups and tabs, rename labels, hide what you don't need, or move tabs between groups.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(dbSettings.navigation_config?.groups || []).map(group => {
                  const groupItems = (dbSettings.navigation_config?.items || []).filter(i => i.group === group.id);
                  const isDraggingThisGroup = draggedGroupId === group.id;
                  return (
                    <div
                      key={group.id}
                      draggable
                      onDragStart={e => handleGroupDragStart(e, group.id)}
                      onDragOver={e => handleGroupDragOver(e, group.id)}
                      onDragEnd={handleGroupDragEnd}
                      style={{
                        border: `1px solid ${isDraggingThisGroup ? 'rgba(52,152,219,0.45)' : 'var(--glass-border)'}`,
                        borderRadius: '10px',
                        background: 'var(--glass-bg)',
                        overflow: 'hidden',
                        opacity: isDraggingThisGroup ? 0.45 : 1,
                        transition: 'opacity 120ms',
                      }}
                    >
                      {/* Group header row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: group.enabled && groupItems.length ? '1px solid var(--glass-border)' : 'none', cursor: 'grab' }}>
                        <span style={{ color: 'var(--text-dimmed)', fontSize: '13px', flexShrink: 0 }}>☰</span>
                        <input
                          type="text"
                          value={group.label}
                          onChange={e => handleGroupLabel(group.id, e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          placeholder="Group name…"
                          style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700,
                            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'text',
                          }}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-dimmed)', flexShrink: 0 }}>
                          {groupItems.filter(i => i.enabled).length}/{groupItems.length} visible
                        </span>
                        <label className="switch-toggle" style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={group.enabled} onChange={() => handleGroupToggle(group.id)} />
                          <span className="slider-round" />
                        </label>
                      </div>

                      {/* Items within group */}
                      {group.enabled && (
                        <div>
                          {groupItems.length === 0 && (
                            <div style={{ padding: '10px 44px', fontSize: '12px', color: 'var(--text-dimmed)', fontStyle: 'italic' }}>
                              No tabs — move some here using the group selector on each tab.
                            </div>
                          )}
                          {groupItems.map(item => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={e => handleItemDragStart(e, item.id)}
                              onDragOver={e => handleItemDragOver(e, item.id, group.id)}
                              onDragEnd={handleItemDragEnd}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '7px 14px 7px 32px',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                opacity: draggedItemId === item.id ? 0.35 : (item.enabled ? 1 : 0.4),
                                background: draggedItemId === item.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                                cursor: 'grab',
                              }}
                            >
                              <span style={{ color: 'var(--text-dimmed)', fontSize: '12px', flexShrink: 0 }}>☰</span>
                              <input
                                type="text"
                                value={item.label}
                                onChange={e => handleItemLabel(item.id, e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                onClick={e => e.stopPropagation()}
                                onMouseDown={e => e.stopPropagation()}
                                style={{
                                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                                  color: item.enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                                  fontSize: '13px', padding: '1px 0', cursor: 'text',
                                }}
                              />
                              <span style={{ fontSize: '10px', color: 'var(--text-dimmed)', flexShrink: 0, fontFamily: 'monospace' }}>
                                {item.id}
                              </span>
                              {/* Move to group */}
                              <select
                                value={item.group}
                                onChange={e => handleItemGroup(item.id, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                title="Move to group"
                                style={{
                                  background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
                                  borderRadius: '4px', color: 'var(--text-muted)', fontSize: '11px',
                                  padding: '2px 4px', cursor: 'pointer', flexShrink: 0,
                                }}
                              >
                                {(dbSettings.navigation_config?.groups || []).map(g => (
                                  <option key={g.id} value={g.id}>{g.label}</option>
                                ))}
                              </select>
                              <label className="switch-toggle" style={{ flexShrink: 0, transform: 'scale(0.8)', transformOrigin: 'right' }} onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={item.enabled} onChange={() => handleItemToggle(item.id)} />
                                <span className="slider-round" />
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Navigation'}
                </button>
              </div>

              {/* Focus Context Presets */}
              <div style={{ marginTop: '40px', borderTop: '1px solid var(--border-subtle)', paddingTop: '32px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>Focus Context Presets</h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
                  Save named nav subsets. Activate a context from the sidebar to instantly filter navigation to only those sections.
                </p>

                {/* Existing presets */}
                {(dbSettings.context_presets || []).map(preset => (
                  <div key={preset.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', marginBottom: '8px',
                    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '120px' }}>{preset.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>
                      {(preset.navItems || []).join(', ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (dbSettings.context_presets || []).filter(p => p.id !== preset.id);
                        setDbSettings(prev => ({ ...prev, context_presets: updated }));
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)', fontSize: '14px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* New preset form */}
                <div style={{
                  padding: '16px', background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)', borderRadius: '8px', marginTop: '12px',
                }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      placeholder="Context name (e.g. Deep Work, Wellness)"
                      value={newPresetName}
                      onChange={e => setNewPresetName(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {(dbSettings.navigation_config?.items || []).filter(i => i.enabled).map(item => {
                      const selected = newPresetItems.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setNewPresetItems(prev =>
                            selected ? prev.filter(x => x !== item.id) : [...prev, item.id]
                          )}
                          style={{
                            fontSize: '11px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                            border: `1px solid ${selected ? 'rgba(52,152,219,0.5)' : 'rgba(255,255,255,0.1)'}`,
                            background: selected ? 'rgba(52,152,219,0.15)' : 'transparent',
                            color: selected ? 'var(--accent-primary)' : 'var(--text-muted)',
                            fontWeight: selected ? 600 : 400,
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!newPresetName.trim() || newPresetItems.length === 0}
                    onClick={() => {
                      const preset = {
                        id: `ctx-${Date.now()}`,
                        name: newPresetName.trim(),
                        navItems: newPresetItems,
                      };
                      setDbSettings(prev => ({
                        ...prev,
                        context_presets: [...(prev.context_presets || []), preset],
                      }));
                      setNewPresetName('');
                      setNewPresetItems([]);
                    }}
                  >
                    + Save Context Preset
                  </button>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={handleSaveDbSettings}
                  >
                    {saving ? 'Saving...' : 'Save Presets'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 6: TEAM */}
          {activeTab === 'team' && (
            <form onSubmit={handleSaveDbSettings}>
              <div className="panel-header">
                <h2>Team & Assignments</h2>
                <p>Configure default behaviors for team member assignments and collaboration.</p>
              </div>

              <div className="form-group">
                <label htmlFor="default_assignee">Default Assignee</label>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 12px 0' }}>
                  Select the person who will be automatically assigned to new tasks and projects if no one else is specified.
                </p>
                <select 
                  id="default_assignee"
                  className="form-select"
                  value={dbSettings.default_assignee}
                  onChange={(e) => setDbSettings({ ...dbSettings, default_assignee: e.target.value })}
                >
                  <option value="">Unassigned (None)</option>
                  {people.map(person => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: '30px', display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Team Settings'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleBatchAssignDefault}
                  disabled={saving || !dbSettings.default_assignee}
                >
                  🚀 Assign default to all unassigned items
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
