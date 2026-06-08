import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchProfilingPerson,
  updateProfilingPerson,
  deleteProfilingPerson,
  fetchCategoryHistory,
  fetchPersonMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  fetchAttachments,
  uploadAttachment,
  deleteAttachment,
  updateAttachment,
  downloadAttachmentUrl,
} from '../utils/api/profilingPeople';
import { fetchProfilingCategories } from '../utils/api/profilingPeople';
import ProfilingCategoryPicker from '../components/ProfilingCategoryPicker';
import MarkdownEditor from '../components/MarkdownEditor';
import EventPicker from '../components/EventPicker';
import { markdownToHtml } from '../utils/mdEditor';
import './ProfilingPeople.css';

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log2(bytes) / 10);
  const size = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${size} ${units[i]}`;
}

export default function ProfilingPersonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [categories, setCategories] = useState([]);
  const [memories, setMemories] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('memories'); // memories | history

  // Editing states
  const [editingField, setEditingField] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  // Memory form
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [memoryForm, setMemoryForm] = useState({ memory_date: '', title: '', details: '', event_id: '' });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [savingMemory, setSavingMemory] = useState(false);

  // File upload refs
  const avatarInputRef = useRef(null);
  const generalFileInputRef = useRef(null);
  const filesDropRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Editing memory
  const [editingMemoryId, setEditingMemoryId] = useState(null);

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [p, c, m, a] = await Promise.all([
        fetchProfilingPerson(id),
        fetchProfilingCategories(),
        fetchPersonMemories(id),
        fetchAttachments(id),
      ]);
      if (!p) { setError('Person not found'); setLoading(false); return; }
      setPerson(p);
      setCategories(c);
      setMemories(m);
      setAttachments(a);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleUpdateField(field, value) {
    try {
      const updated = await updateProfilingPerson(id, { [field]: value });
      setPerson(updated);
    } catch (e) { alert(e.message); }
  }

  async function handleSaveEdit(field) {
    const value = editDraft.trim();
    if (field === 'name' && !value) return;
    await handleUpdateField(field, value);
    setEditingField(null);
    setEditDraft('');
  }

  async function handleSetAvatar(attachmentId) {
    try {
      const updated = await updateProfilingPerson(id, { avatar_file_id: attachmentId });
      setPerson(updated);
    } catch (e) { alert(e.message); }
  }

  async function handleAddMemory(e) {
    e.preventDefault();
    if (!memoryForm.title.trim()) return;
    setSavingMemory(true);
    try {
      await createMemory(id, {
        memory_date: memoryForm.memory_date || null,
        title: memoryForm.title.trim(),
        details: memoryForm.details.trim(),
        event_ids: memoryForm.event_id ? [memoryForm.event_id] : [],
      });
      setShowMemoryForm(false);
      setMemoryForm({ memory_date: '', title: '', details: '', event_id: '' });
      setSelectedEvent(null);
      const m = await fetchPersonMemories(id);
      setMemories(m);
    } catch (err) { alert(err.message); }
    finally { setSavingMemory(false); }
  }

  async function handleUpdateMemory(memoryId, updates) {
    try {
      await updateMemory(memoryId, updates);
      const m = await fetchPersonMemories(id);
      setMemories(m);
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteMemory(memoryId) {
    if (!window.confirm('Delete this memory?')) return;
    try {
      await deleteMemory(memoryId);
      const m = await fetchPersonMemories(id);
      setMemories(m);
      const a = await fetchAttachments(id);
      setAttachments(a);
    } catch (err) { alert(err.message); }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await uploadAttachment(id, formData);
      const a = await fetchAttachments(id);
      setAttachments(a);
    } catch (err) { alert(err.message); }
    finally { setUploading(false); }
  }

  async function handleDeleteAttachment(attId) {
    if (!window.confirm('Delete this file?')) return;
    try {
      await deleteAttachment(attId);
      const a = await fetchAttachments(id);
      setAttachments(a);
      // If it was the avatar, refresh person
      if (person?.avatar_file_id === attId) {
        const p = await fetchProfilingPerson(id);
        setPerson(p);
      }
    } catch (err) { alert(err.message); }
  }

  async function handleLinkAttachmentToMemory(attId, memoryId) {
    try {
      await updateAttachment(attId, { memory_id: memoryId || null });
      const a = await fetchAttachments(id);
      setAttachments(a);
    } catch (err) { alert(err.message); }
  }

  if (loading) return (
    <div className="page-container">
      <div className="pp-detail-grid">
        <div className="pp-detail-col" style={{ height: '300px' }}><div className="skeleton" style={{ height: '100%' }} /></div>
        <div className="pp-detail-col" style={{ height: '300px' }}><div className="skeleton" style={{ height: '100%' }} /></div>
        <div className="pp-detail-col" style={{ height: '300px' }}><div className="skeleton" style={{ height: '100%' }} /></div>
      </div>
    </div>
  );

  if (error) return (
    <div className="page-container">
      <div className="dashboard-panel" style={{ borderColor: 'var(--accent-danger)', textAlign: 'center', padding: '24px' }}>
        <div style={{ color: 'var(--accent-danger)' }}>{error}</div>
        <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => navigate('/personal-care/people')}>
          ← Back to People
        </button>
      </div>
    </div>
  );

  const category = categories.find(c => c.id === person.category_id);

  return (
    <div className="page-container">
      <button className="pp-back-btn" onClick={() => navigate('/personal-care/people')}>
        ← Back to People
      </button>

      <div className="pp-detail-grid">
        {/* ── COLUMN 1: Profile ── */}
        <div className="pp-detail-col pp-profile-col">
          <div className="pp-profile-header">
            <div
              className="pp-profile-avatar"
              onClick={() => avatarInputRef.current?.click()}
              title="Click to upload avatar"
            >
              {person.avatar_file_id ? (
                <img src={downloadAttachmentUrl(person.avatar_file_id)} alt={person.name} />
              ) : (
                <span className="pp-profile-initial">{person.name.charAt(0).toUpperCase()}</span>
              )}
              <div className="pp-profile-avatar-overlay">📷</div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                try {
                  const uploaded = await uploadAttachment(id, formData);
                  await handleSetAvatar(uploaded.id);
                  const a = await fetchAttachments(id);
                  setAttachments(a);
                } catch (err) { alert(err.message); }
              }}
            />

            {editingField === 'name' ? (
              <input
                className="pp-inline-input"
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                onBlur={() => handleSaveEdit('name')}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit('name'); if (e.key === 'Escape') { setEditingField(null); setEditDraft(''); }}}
                autoFocus
              />
            ) : (
              <h2 className="pp-profile-name" onDoubleClick={() => { setEditingField('name'); setEditDraft(person.name); }}>
                {person.name}
              </h2>
            )}

            <div className="pp-profile-category">
              <ProfilingCategoryPicker
                value={person.category_id}
                onSelect={cid => handleUpdateField('category_id', cid)}
                onCategoriesChanged={() => fetchProfilingCategories().then(setCategories)}
                compact={false}
              />
            </div>

            {editingField === 'description' ? (
              <textarea
                className="pp-inline-textarea"
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                onBlur={() => handleSaveEdit('description')}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit('description'); } if (e.key === 'Escape') { setEditingField(null); setEditDraft(''); }}}
                rows={3}
                autoFocus
              />
            ) : (
              <p className="pp-profile-desc" onDoubleClick={() => { setEditingField('description'); setEditDraft(person.description || ''); }}>
                {person.description || <span className="pp-placeholder">Double-click to add description…</span>}
              </p>
            )}

            <div className="pp-profile-meta">
              <span className="pp-meta-label">First met:</span>
              {editingField === 'first_met_date' ? (
                <input
                  type="date"
                  className="pp-inline-input"
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  onBlur={() => handleSaveEdit('first_met_date')}
                  autoFocus
                />
              ) : (
                <span onDoubleClick={() => { setEditingField('first_met_date'); setEditDraft(person.first_met_date || ''); }}>
                  {person.first_met_date || <span className="pp-placeholder">—</span>}
                </span>
              )}
            </div>

            <button
              className="pp-history-link"
              onClick={() => setActiveTab(activeTab === 'history' ? 'memories' : 'history')}
            >
              {activeTab === 'history' ? '← Back to memories' : '📋 View category history'}
            </button>

            <button
              className="btn btn-danger"
              style={{ marginTop: '16px', width: '100%' }}
              onClick={async () => {
                if (!window.confirm(`Delete ${person.name} and all their data?`)) return;
                try { await deleteProfilingPerson(id); navigate('/personal-care/people'); }
                catch (err) { alert(err.message); }
              }}
            >
              Delete Person
            </button>
          </div>
        </div>

        {/* ── COLUMN 2: Memories / History ── */}
        <div className="pp-detail-col pp-memories-col">
          {activeTab === 'memories' ? (
            <>
              <div className="pp-col-header">
                <h3>Memories</h3>
                <button className="btn btn-primary" onClick={() => setShowMemoryForm(true)}>+ Add Memory</button>
              </div>

              {showMemoryForm && (
                <form className="pp-memory-form glass-panel" onSubmit={handleAddMemory}>
                  <div className="pp-memory-date-editable">
                    <span style={{ fontSize: '12px', color: 'var(--text-dimmed)' }}>When it happened:</span>
                    <input
                      type="date"
                      value={memoryForm.memory_date}
                      onChange={e => setMemoryForm({ ...memoryForm, memory_date: e.target.value })}
                      placeholder="Optional — when did this happen?"
                    />
                  </div>
                  <input
                    placeholder="Title *"
                    value={memoryForm.title}
                    onChange={e => setMemoryForm({ ...memoryForm, title: e.target.value })}
                    required
                    autoFocus
                  />
                  <MarkdownEditor
                    value={memoryForm.details}
                    onChange={md => setMemoryForm({ ...memoryForm, details: md })}
                    placeholder="Describe the memory..."
                    minRows={4}
                  />

                  {/* Event Picker */}
                  <EventPicker
                    selectedEventId={memoryForm.event_id}
                    selectedEvent={selectedEvent}
                    onSelect={(ev) => {
                      setMemoryForm({ ...memoryForm, event_id: ev?.id || '' });
                      setSelectedEvent(ev);
                    }}
                    initialDate={memoryForm.memory_date}
                  />

                  <div className="pp-add-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowMemoryForm(false); }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={savingMemory}>
                      {savingMemory ? 'Saving…' : 'Save Memory'}
                    </button>
                  </div>
                </form>
              )}

              <div className="pp-memories-list">
                {memories.length === 0 ? (
                  <div className="no-analytics-data" style={{ padding: '32px 0' }}>
                    <span style={{ fontSize: '24px' }}>📝</span>
                    <span>No memories yet. Add your first memory above.</span>
                  </div>
                ) : (
                  memories.map(mem => (
                    <div key={mem.id} className="pp-memory-card glass-panel">
                      <div className="pp-memory-header">
                        <div className="pp-memory-actions">
                          <button type="button" onClick={() => { setEditingMemoryId(mem.id); }}>✎</button>
                          <button type="button" onClick={() => handleDeleteMemory(mem.id)}>×</button>
                        </div>
                      </div>

                      {editingMemoryId === mem.id ? (
                        <MemoryEditor
                          memory={mem}
                          onSave={async (updates) => {
                            await handleUpdateMemory(mem.id, updates);
                            setEditingMemoryId(null);
                          }}
                          onCancel={() => setEditingMemoryId(null)}
                        />
                      ) : (
                        <>
                          <div className="pp-memory-dates">
                            <span className="pp-memory-created" title={mem.created_at}>
                              Created {new Date(mem.created_at).toLocaleDateString()}
                            </span>
                            {mem.memory_date && (
                              <span className="pp-memory-date-editable">
                                <span>·</span>
                                <span style={{ color: '#FF6B9D', fontWeight: 600 }}>{mem.memory_date}</span>
                              </span>
                            )}
                          </div>
                          <h4 className="pp-memory-title">{mem.title}</h4>
                          <div
                            className="pp-memory-details"
                            dangerouslySetInnerHTML={{ __html: markdownToHtml(mem.details || '') }}
                          />
                          {mem.linked_events?.length > 0 ? (
                            <div className="pp-memory-events">
                              {mem.linked_events.map(ev => (
                                <span key={ev.id} className="pp-event-pill">{ev.date_string} · {ev.title}</span>
                              ))}
                            </div>
                          ) : (
                            <div className="pp-event-link-empty" style={{ marginTop: '8px' }}>
                              No calendar events linked
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <CategoryHistory personId={id} onBack={() => setActiveTab('memories')} />
          )}
        </div>

        {/* ── COLUMN 3: Files ── */}
        <div className="pp-detail-col pp-files-col">
          <div className="pp-col-header">
            <h3>Files</h3>
            <button
              className="btn btn-primary"
              onClick={() => generalFileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : '+ Upload'}
            </button>
          </div>

          <input
            ref={generalFileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          <div
            ref={filesDropRef}
            className={`pp-files-dropzone ${dragOver ? 'active' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
            onDrop={async e => {
              e.preventDefault();
              setDragOver(false);
              const files = Array.from(e.dataTransfer.files);
              if (files.length === 0) return;
              setUploading(true);
              try {
                for (const file of files) {
                  const formData = new FormData();
                  formData.append('file', file);
                  await uploadAttachment(id, formData);
                }
                const a = await fetchAttachments(id);
                setAttachments(a);
              } catch (err) { alert(err.message); }
              finally { setUploading(false); }
            }}
          >
            <div className="pp-files-grid">
              {attachments.length === 0 ? (
                <div className="pp-files-empty">
                  <span className="pp-files-empty-icon">📎</span>
                  <span>Drag & drop files here or click Upload</span>
                  <span className="pp-files-empty-hint">Photos, .txt, .md, .pdf, .zip…</span>
                </div>
              ) : (
                attachments.map(att => {
                  const ext = att.file_name.split('.').pop().toLowerCase();
                  const isImage = att.file_type?.startsWith('image/') || ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
                  const isText = ['txt','md','markdown','rst'].includes(ext);
                  const isDoc = ['pdf','doc','docx','odt'].includes(ext);
                  const isArchive = ['zip','tar','gz','tgz','rar','7z'].includes(ext);
                  const isAudio = ['mp3','wav','ogg','flac','m4a'].includes(ext);
                  const isVideo = ['mp4','mov','avi','mkv','webm'].includes(ext);

                  let icon = '📎';
                  if (isImage) icon = '🖼';
                  else if (isText) icon = '📝';
                  else if (isDoc) icon = '📄';
                  else if (isArchive) icon = '🗜';
                  else if (isAudio) icon = '🎵';
                  else if (isVideo) icon = '🎬';

                  const isLinked = !!att.memory_id;

                  return (
                    <div key={att.id} className={`pp-file-card ${isLinked ? 'linked' : ''}`}>
                      {isImage ? (
                        <img src={downloadAttachmentUrl(att.id)} alt={att.file_name} className="pp-file-thumb" loading="lazy" />
                      ) : (
                        <div className="pp-file-icon" title={`.${ext}`}>{icon}</div>
                      )}
                      <div className="pp-file-info">
                        <span className="pp-file-name" title={att.file_name}>{att.file_name}</span>
                        {isLinked && (
                          <span className="pp-file-memory-link">🔗 {att.memory_title || 'Linked'}</span>
                        )}
                        <span className="pp-file-meta">
                          <span className="pp-file-size">{formatFileSize(att.file_size)}</span>
                          <span className="pp-file-ext">.{ext}</span>
                        </span>
                      </div>
                      <div className="pp-file-actions">
                        <a href={downloadAttachmentUrl(att.id)} download className="pp-file-btn" title="Download">⬇</a>
                        {isImage && (
                          <button className="pp-file-btn" title="Set as avatar" onClick={() => handleSetAvatar(att.id)}>🖼</button>
                        )}
                        <select
                          className="pp-file-btn-select"
                          title="Link to memory"
                          value={att.memory_id || ''}
                          onChange={e => handleLinkAttachmentToMemory(att.id, e.target.value || null)}
                        >
                          <option value="">General file</option>
                          {memories.map(m => (
                            <option key={m.id} value={m.id}>{m.title}</option>
                          ))}
                        </select>
                        <button className="pp-file-btn" title="Delete" onClick={() => handleDeleteAttachment(att.id)}>🗑</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoryEditor({ memory, onSave, onCancel }) {
  const [form, setForm] = useState({
    memory_date: memory.memory_date || '',
    title: memory.title,
    details: memory.details || '',
    event_id: memory.linked_events?.[0]?.id || '',
  });
  const [selectedEvent, setSelectedEvent] = useState(memory.linked_events?.[0] || null);

  return (
    <div className="pp-memory-editor">
      <div className="pp-memory-date-editable">
        <span style={{ fontSize: '12px', color: 'var(--text-dimmed)' }}>When it happened:</span>
        <input
          type="date"
          value={form.memory_date}
          onChange={e => setForm({ ...form, memory_date: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <div className="pp-memory-title-input-wrapper">
        <input
          className="pp-memory-title-input"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          required
        />
      </div>
      <MarkdownEditor
        value={form.details}
        onChange={md => setForm({ ...form, details: md })}
        placeholder="Describe the memory..."
        minRows={4}
      />

      <EventPicker
        selectedEventId={form.event_id}
        selectedEvent={selectedEvent}
        onSelect={(ev) => {
          setForm({ ...form, event_id: ev?.id || '' });
          setSelectedEvent(ev);
        }}
        initialDate={form.memory_date}
      />

      <div className="pp-add-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={() => onSave({ ...form, event_ids: form.event_id ? [form.event_id] : [] })}>Save</button>
      </div>
    </div>
  );
}

function CategoryHistory({ personId, onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategoryHistory(personId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [personId]);

  return (
    <>
      <div className="pp-col-header">
        <h3>Category History</h3>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: '120px' }} />
      ) : history.length === 0 ? (
        <div className="no-analytics-data" style={{ padding: '32px 0' }}>
          <span>No category changes recorded.</span>
        </div>
      ) : (
        <div className="pp-history-list">
          {history.map(h => (
            <div key={h.id} className="pp-history-row">
              <span className="pp-history-date">{new Date(h.changed_at).toLocaleDateString()}</span>
              <span className="pp-history-arrow">→</span>
              <span className="pp-history-old">{h.old_category_name || 'None'}</span>
              <span className="pp-history-arrow">→</span>
              <span className="pp-history-new" style={{ color: h.new_category_color || 'var(--text-primary)' }}>
                {h.new_category_name || 'None'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
