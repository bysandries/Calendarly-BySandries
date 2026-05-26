import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNotes } from '../hooks/useNotes';
import { useExtracts } from '../hooks/useExtracts';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { fetchAreas, fetchExtractLinks, addExtractLink, removeExtractLink } from '../utils/api';

const HIGHLIGHT_COLORS = [
  { hex: '#F1C40F', label: 'Yellow' },
  { hex: '#2ECC71', label: 'Green' },
  { hex: '#3498DB', label: 'Blue' },
  { hex: '#E91E63', label: 'Pink' },
  { hex: '#E67E22', label: 'Orange' },
  { hex: '#9B59B6', label: 'Purple' },
  { hex: '', label: 'None' },
];

export default function NotesPage() {
  // ── Tabs ──
  const [activeTab, setActiveTab] = useState('extracts');

  // ── Notes (existing) ──
  const { notes, loading: notesLoading, error: notesError, createNote, updateNote, deleteNote, refetch: refetchNotes } = useNotes();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const [areas, setAreas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [noteEditData, setNoteEditData] = useState({ title: '', content: '', type: '', tags: '', linked_task_id: '' });
  const [showCreateNoteForm, setShowCreateNoteForm] = useState(false);

  // ── Extracts (new) ──
  const {
    extracts,
    loading: extractsLoading,
    error: extractsError,
    createExtract,
    updateExtract,
    deleteExtract,
    linkResource,
    unlinkResource,
    refetch: refetchExtracts,
  } = useExtracts();
  const [extractSearch, setExtractSearch] = useState('');
  const [selectedExtract, setSelectedExtract] = useState(null);
  const [isEditingExtract, setIsEditingExtract] = useState(false);
  const [extractEditData, setExtractEditData] = useState({
    content: '', bibliography: '', chapter_section: '', position: '',
    tags: '', created_at: '', highlight_color: '', note_id: '', resource_ids: [],
  });
  const [showCreateExtractForm, setShowCreateExtractForm] = useState(false);
  const [extractLinks, setExtractLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => {});
  }, []);

  // Notes filters
  useEffect(() => {
    const filters = {};
    if (searchQuery) filters.search = searchQuery;
    if (typeFilter) filters.type = typeFilter;
    const timer = setTimeout(() => refetchNotes(filters), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, typeFilter]);

  // Extracts filters
  useEffect(() => {
    const filters = {};
    if (extractSearch) filters.search = extractSearch;
    const timer = setTimeout(() => refetchExtracts(filters), 300);
    return () => clearTimeout(timer);
  }, [extractSearch]);

  // Fetch Zettelkasten links when selected extract changes
  useEffect(() => {
    if (!selectedExtract) { setExtractLinks([]); return; }
    setLinksLoading(true);
    fetchExtractLinks(selectedExtract.id)
      .then(setExtractLinks)
      .catch(() => setExtractLinks([]))
      .finally(() => setLinksLoading(false));
  }, [selectedExtract?.id]);

  const uniqueTypes = [...new Set(notes.map(n => n.type).filter(Boolean))];

  const parseTags = (tagsStr) => {
    if (!tagsStr) return [];
    return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  };

  // ── Notes handlers ──
  const openNoteDetail = (note) => {
    setSelectedNote(note);
    setNoteEditData({
      title: note.title || '',
      content: note.content || '',
      type: note.type || '',
      tags: note.tags || '',
      linked_task_id: note.linked_task_id || '',
    });
    setIsEditing(false);
  };

  const handleSaveNote = async () => {
    if (selectedNote) {
      await updateNote(selectedNote.id, noteEditData);
      setSelectedNote({ ...selectedNote, ...noteEditData });
      setIsEditing(false);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    const note = await createNote(noteEditData);
    setShowCreateNoteForm(false);
    setNoteEditData({ title: '', content: '', type: '', tags: '', linked_task_id: '' });
    openNoteDetail(note);
  };

  const handleDeleteNote = async () => {
    if (selectedNote && confirm('Delete this note?')) {
      await deleteNote(selectedNote.id);
      setSelectedNote(null);
    }
  };

  // ── Extracts handlers ──
  const openExtractDetail = (extract) => {
    setSelectedExtract(extract);
    setExtractEditData({
      content: extract.content || '',
      bibliography: extract.bibliography || '',
      chapter_section: extract.chapter_section || '',
      position: extract.position || '',
      tags: extract.tags || '',
      created_at: extract.created_at || '',
      highlight_color: extract.highlight_color || '',
      note_id: extract.note_id || '',
      resource_ids: extract.resources || [],
    });
    setIsEditingExtract(false);
    setLinkSearch('');
  };

  const handleSaveExtract = async () => {
    if (selectedExtract) {
      await updateExtract(selectedExtract.id, extractEditData);
      setSelectedExtract({ ...selectedExtract, ...extractEditData });
      setIsEditingExtract(false);
    }
  };

  const handleCreateExtract = async (e) => {
    e.preventDefault();
    try {
      const data = { ...extractEditData };
      // Convert temporary resource_ids array for the API
      if (Array.isArray(data.resource_ids) && data.resource_ids.length > 0) {
        data.resource_ids = data.resource_ids.map(r => ({
          project_id: r.project_id || null,
          task_id: r.task_id || null,
        }));
      }
      const extract = await createExtract(data);
      setShowCreateExtractForm(false);
      setExtractEditData({
        content: '', bibliography: '', chapter_section: '', position: '',
        tags: '', created_at: '', highlight_color: '', note_id: '', resource_ids: [],
      });
      openExtractDetail(extract);
    } catch (err) {
      alert('Failed to create extract: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteExtract = async () => {
    if (selectedExtract && confirm('Delete this extract?')) {
      await deleteExtract(selectedExtract.id);
      setSelectedExtract(null);
    }
  };

  const handleAddResource = async (extractId, resource) => {
    try {
      await linkResource(extractId, resource);
      // Refresh selectedExtract so resources render immediately
      const updated = extracts.find(e => e.id === extractId);
      if (updated) {
        const fresh = { ...updated, resources: [...(updated.resources || []), resource] };
        setSelectedExtract(fresh);
      }
    } catch (err) {
      alert('Failed to link resource: ' + (err.message || 'Unknown error'));
    }
  };

  const handleRemoveResource = async (extractId, resource) => {
    try {
      await unlinkResource(extractId, resource);
      // Refresh selectedExtract so resources render immediately
      const updated = extracts.find(e => e.id === extractId);
      if (updated) {
        setSelectedExtract(updated);
      }
    } catch (err) {
      alert('Failed to unlink resource: ' + (err.message || 'Unknown error'));
    }
  };

  const handleAddLink = async (targetId) => {
    try {
      await addExtractLink(selectedExtract.id, targetId);
      const links = await fetchExtractLinks(selectedExtract.id);
      setExtractLinks(links);
      setLinkSearch('');
    } catch (err) {
      alert('Failed to add link: ' + (err.message || 'Unknown error'));
    }
  };

  const handleRemoveLink = async (targetId) => {
    try {
      await removeExtractLink(selectedExtract.id, targetId);
      setExtractLinks(prev => prev.filter(e => e.id !== targetId));
    } catch (err) {
      alert('Failed to remove link: ' + (err.message || 'Unknown error'));
    }
  };

  // Helper for create-form resource management
  const addCreateResource = (resource) => {
    setExtractEditData(prev => ({
      ...prev,
      resource_ids: [...(prev.resource_ids || []), resource],
    }));
  };

  const removeCreateResource = (resource) => {
    setExtractEditData(prev => ({
      ...prev,
      resource_ids: (prev.resource_ids || []).filter(r =>
        !(r.project_id === resource.project_id && r.task_id === resource.task_id)
      ),
    }));
  };

  const getProjectTitle = (id) => projects.find(p => p.id === id)?.title || id;
  const getTaskTitle = (id) => tasks.find(t => t.id === id)?.title || id;

  const linkedIds = new Set([selectedExtract?.id, ...extractLinks.map(e => e.id)]);
  const linkCandidates = linkSearch.trim()
    ? extracts.filter(e => !linkedIds.has(e.id) && (
        (e.content?.toLowerCase().includes(linkSearch.toLowerCase())) ||
        (e.bibliography?.toLowerCase().includes(linkSearch.toLowerCase()))
      )).slice(0, 8)
    : [];

  const currentLoading = activeTab === 'notes' ? notesLoading : extractsLoading;
  const currentError = activeTab === 'notes' ? notesError : extractsError;

  return (
    <div>
      <div className="page-header">
        <h2>Extracts</h2>
        <p className="page-description">Browse research extracts</p>
      </div>

      <>
          {/* Extracts Filter Bar */}
          <div className="filter-bar">
            <div className="search-wrapper">
              <span className="search-icon">⌕</span>
              <input
                className="search-input"
                placeholder="Search extracts..."
                value={extractSearch}
                onChange={(e) => setExtractSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Extracts Grid */}
          {extractsLoading ? (
            <div className="cards-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton skeleton-card" />
              ))}
            </div>
          ) : extractsError ? (
            <div className="glass-panel" style={{ padding: '24px', color: 'var(--accent-danger)' }}>
              Error loading extracts: {extractsError}
            </div>
          ) : extracts.length === 0 ? (
            <div className="glass-panel">
              <div className="empty-state">
                <div className="empty-icon">✎</div>
                <h3>No extracts found</h3>
                <p>Create your first research extract from a book, paper, or source.</p>
              </div>
            </div>
          ) : (
            <div className="cards-grid">
              {extracts.map(extract => (
                <div
                  key={extract.id}
                  className="extract-card"
                  style={{ borderLeftColor: extract.highlight_color || 'transparent' }}
                  onClick={() => openExtractDetail(extract)}
                >
                  <div className="extract-content">
                    {extract.content || 'Untitled Extract'}
                  </div>
                  {extract.bibliography && (
                    <div className="extract-bibliography">{extract.bibliography}</div>
                  )}
                  <div className="extract-meta">
                    {extract.chapter_section && (
                      <span className="extract-chapter-badge">{extract.chapter_section}</span>
                    )}
                    {parseTags(extract.tags).slice(0, 3).map((tag, i) => (
                      <span key={i} className="tag-pill">{tag}</span>
                    ))}
                    {extract.resources && extract.resources.length > 0 && (
                      <span className="resource-badge">
                        {extract.resources.length} link{extract.resources.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>

      {/* Note Detail Overlay */}
      {selectedNote && (
        <div
          className="note-detail-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedNote(null); }}
        >
          <div className="note-detail-panel">
            <div className="note-detail-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isEditing ? (
                  <input
                    className="form-input"
                    value={noteEditData.title}
                    onChange={(e) => setNoteEditData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Note title"
                    style={{ fontSize: '1.1rem', fontWeight: 600, maxWidth: '400px' }}
                  />
                ) : (
                  <h3>{selectedNote.title || 'Untitled Note'}</h3>
                )}
                {selectedNote.type && !isEditing && (
                  <span className="type-badge">{selectedNote.type}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isEditing ? (
                  <>
                    <button className="btn btn-primary" onClick={handleSaveNote}>Save</button>
                    <button className="btn btn-ghost" onClick={() => setIsEditing(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-ghost" onClick={() => setIsEditing(true)}>Edit</button>
                    <button className="btn btn-danger" onClick={handleDeleteNote}>Delete</button>
                  </>
                )}
                <button className="btn-icon" onClick={() => setSelectedNote(null)}>✕</button>
              </div>
            </div>

            {isEditing && (
              <div style={{ padding: '0 24px 12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label className="form-label">Type</label>
                  <input
                    className="form-input"
                    value={noteEditData.type}
                    onChange={(e) => setNoteEditData(prev => ({ ...prev, type: e.target.value }))}
                    placeholder="extract, note, idea..."
                  />
                </div>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label className="form-label">Tags (comma-separated)</label>
                  <input
                    className="form-input"
                    value={noteEditData.tags}
                    onChange={(e) => setNoteEditData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="math, chapter-5, calculus"
                  />
                </div>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label className="form-label">Linked Task</label>
                  <select
                    className="form-select"
                    value={noteEditData.linked_task_id}
                    onChange={(e) => setNoteEditData(prev => ({ ...prev, linked_task_id: e.target.value }))}
                  >
                    <option value="">No linked task</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="note-detail-body">
              {isEditing ? (
                <>
                  <div className="note-editor-pane">
                    <textarea
                      className="note-editor-textarea"
                      value={noteEditData.content}
                      onChange={(e) => setNoteEditData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Write markdown content..."
                    />
                  </div>
                  <div className="note-preview-pane">
                    <div className="markdown-body">
                      <ReactMarkdown>
                        {noteEditData.content || '*No content yet*'}
                      </ReactMarkdown>
                    </div>
                  </div>
                </>
              ) : (
                <div className="note-preview-pane" style={{ flex: '1' }}>
                  {selectedNote.task_title && (
                    <div style={{ marginBottom: '16px' }}>
                      <span className="linked-task-badge" style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                        <span className="dot" style={{ background: 'var(--accent-primary)' }} />
                        Linked to: {selectedNote.task_title}
                      </span>
                    </div>
                  )}
                  {parseTags(selectedNote.tags).length > 0 && (
                    <div style={{ marginBottom: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {parseTags(selectedNote.tags).map((tag, i) => (
                        <span key={i} className="tag-pill">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="markdown-body">
                    <ReactMarkdown>
                      {selectedNote.content || '*No content*'}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Extract Detail Overlay */}
      {selectedExtract && (
        <div
          className="note-detail-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedExtract(null); }}
        >
          <div className="note-detail-panel" style={{ maxWidth: '1200px' }}>
            <div className="note-detail-header">
              <h3>Extract</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isEditingExtract ? (
                  <>
                    <button className="btn btn-primary" onClick={handleSaveExtract}>Save</button>
                    <button className="btn btn-ghost" onClick={() => setIsEditingExtract(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-ghost" onClick={() => setIsEditingExtract(true)}>Edit</button>
                    <button className="btn btn-danger" onClick={handleDeleteExtract}>Delete</button>
                  </>
                )}
                <button className="btn-icon" onClick={() => setSelectedExtract(null)}>✕</button>
              </div>
            </div>

            {isEditingExtract && (
              <div style={{ padding: '0 24px 12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label className="form-label">Bibliography</label>
                  <input
                    className="form-input"
                    value={extractEditData.bibliography}
                    onChange={(e) => setExtractEditData(prev => ({ ...prev, bibliography: e.target.value }))}
                    placeholder="Author, Title..."
                  />
                </div>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label className="form-label">Chapter / Section</label>
                  <input
                    className="form-input"
                    value={extractEditData.chapter_section}
                    onChange={(e) => setExtractEditData(prev => ({ ...prev, chapter_section: e.target.value }))}
                    placeholder="Chapter 3 - ..."
                  />
                </div>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label className="form-label">Position</label>
                  <input
                    className="form-input"
                    value={extractEditData.position}
                    onChange={(e) => setExtractEditData(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="Page, paragraph..."
                  />
                </div>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label className="form-label">Created At</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={extractEditData.created_at ? extractEditData.created_at.slice(0, 16) : ''}
                    onChange={(e) => setExtractEditData(prev => ({ ...prev, created_at: e.target.value }))}
                  />
                </div>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label className="form-label">Tags</label>
                  <input
                    className="form-input"
                    value={extractEditData.tags}
                    onChange={(e) => setExtractEditData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="tag1, tag2"
                  />
                </div>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label className="form-label">Highlight Color</label>
                  <div className="color-swatch-picker">
                    {HIGHLIGHT_COLORS.map(c => (
                      <button
                        key={c.hex || 'none'}
                        className={`color-swatch ${extractEditData.highlight_color === c.hex ? 'active' : ''}`}
                        style={{ background: c.hex || 'var(--glass-bg-strong)' }}
                        onClick={() => setExtractEditData(prev => ({ ...prev, highlight_color: c.hex }))}
                        title={c.label}
                      >
                        {!c.hex && '—'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="note-detail-body">
              {/* Main content area */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
                {isEditingExtract ? (
                  <>
                    <div className="note-editor-pane">
                      <textarea
                        className="note-editor-textarea"
                        value={extractEditData.content}
                        onChange={(e) => setExtractEditData(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Paste or write the extract..."
                      />
                    </div>
                    <div className="note-preview-pane">
                      <div className="markdown-body">
                        <ReactMarkdown>
                          {extractEditData.content || '*No content yet*'}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="note-preview-pane" style={{ flex: '1' }}>
                    {selectedExtract.bibliography && (
                      <div className="extract-bibliography" style={{ marginBottom: '12px' }}>
                        {selectedExtract.bibliography}
                      </div>
                    )}
                    {selectedExtract.chapter_section && (
                      <span className="extract-chapter-badge" style={{ marginBottom: '12px', display: 'inline-block' }}>
                        {selectedExtract.chapter_section}
                      </span>
                    )}
                    {selectedExtract.position && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                        Position: {selectedExtract.position}
                      </div>
                    )}
                    {parseTags(selectedExtract.tags).length > 0 && (
                      <div style={{ marginBottom: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {parseTags(selectedExtract.tags).map((tag, i) => (
                          <span key={i} className="tag-pill">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="markdown-body">
                      <ReactMarkdown>
                        {selectedExtract.content || '*No content*'}
                      </ReactMarkdown>
                    </div>

                    {/* Resources */}
                    {selectedExtract.resources && selectedExtract.resources.length > 0 && (
                      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Linked Resources</h4>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {selectedExtract.resources.map((res, i) => (
                            <span key={i} className="resource-badge">
                              {res.project_id ? (
                                <>📁 {getProjectTitle(res.project_id)}</>
                              ) : (
                                <>✓ {getTaskTitle(res.task_id)}</>
                              )}
                              <button
                                className="resource-remove"
                                onClick={() => handleRemoveResource(selectedExtract.id, { project_id: res.project_id, task_id: res.task_id })}
                                title="Unlink"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Resource */}
                    <div style={{ marginTop: '16px' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Link to project</label>
                      <select
                        className="form-select"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddResource(selectedExtract.id, { project_id: e.target.value });
                            e.target.value = '';
                          }
                        }}
                        style={{ minWidth: '200px' }}
                      >
                        <option value="">Select project...</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Link to task</label>
                      <select
                        className="form-select"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddResource(selectedExtract.id, { task_id: e.target.value });
                            e.target.value = '';
                          }
                        }}
                        style={{ minWidth: '200px' }}
                      >
                        <option value="">Select task...</option>
                        {tasks.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Zettelkasten links side panel */}
              <div className="extract-links-panel">
                <div className="extract-links-header">
                  <span>Linked Extracts</span>
                  {extractLinks.length > 0 && (
                    <span className="extract-links-count">{extractLinks.length}</span>
                  )}
                </div>

                <div className="extract-links-search-wrap">
                  <input
                    className="form-input"
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                    placeholder="Search to link..."
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                  />
                  {linkCandidates.length > 0 && (
                    <div className="link-candidates-dropdown">
                      {linkCandidates.map(e => (
                        <div
                          key={e.id}
                          className="link-candidate-item"
                          onClick={() => handleAddLink(e.id)}
                        >
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {(e.content || '').slice(0, 80)}{(e.content?.length || 0) > 80 ? '…' : ''}
                          </div>
                          {e.bibliography && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{e.bibliography}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {linkSearch.trim() && linkCandidates.length === 0 && (
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', paddingTop: '6px' }}>
                      No matching extracts
                    </div>
                  )}
                </div>

                <div className="extract-links-list">
                  {linksLoading ? (
                    <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>Loading...</div>
                  ) : extractLinks.length === 0 ? (
                    <div style={{ padding: '12px 8px', color: 'var(--text-dimmed)', fontSize: '0.73rem', textAlign: 'center', marginTop: '8px' }}>
                      No linked extracts yet.<br />Search above to connect ideas.
                    </div>
                  ) : (
                    extractLinks.map(linked => (
                      <div
                        key={linked.id}
                        className="extract-link-item"
                        onClick={() => openExtractDetail(linked)}
                      >
                        <div className="extract-link-content">
                          {(linked.content || 'Untitled').slice(0, 100)}{(linked.content?.length || 0) > 100 ? '…' : ''}
                        </div>
                        {linked.bibliography && (
                          <div className="extract-link-biblio">{linked.bibliography}</div>
                        )}
                        <button
                          className="extract-link-remove"
                          onClick={(e) => { e.stopPropagation(); handleRemoveLink(linked.id); }}
                          title="Remove link"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Note Modal */}
      {showCreateNoteForm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateNoteForm(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Note</h3>
              <button className="btn-icon" onClick={() => setShowCreateNoteForm(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateNote}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  className="form-input"
                  value={noteEditData.title}
                  onChange={(e) => setNoteEditData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Note title"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Content (Markdown)</label>
                <textarea
                  className="form-textarea"
                  value={noteEditData.content}
                  onChange={(e) => setNoteEditData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your note in markdown..."
                  rows={6}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <input
                    className="form-input"
                    value={noteEditData.type}
                    onChange={(e) => setNoteEditData(prev => ({ ...prev, type: e.target.value }))}
                    placeholder="extract, note, idea"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <input
                    className="form-input"
                    value={noteEditData.tags}
                    onChange={(e) => setNoteEditData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="tag1, tag2"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Linked Task</label>
                <select
                  className="form-select"
                  value={noteEditData.linked_task_id}
                  onChange={(e) => setNoteEditData(prev => ({ ...prev, linked_task_id: e.target.value }))}
                >
                  <option value="">No linked task</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateNoteForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Extract Modal */}
      {showCreateExtractForm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateExtractForm(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Extract</h3>
              <button className="btn-icon" onClick={() => setShowCreateExtractForm(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateExtract}>
              <div className="form-group">
                <label className="form-label">Extract Content</label>
                <textarea
                  className="form-textarea"
                  value={extractEditData.content}
                  onChange={(e) => setExtractEditData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Paste the text you want to extract..."
                  rows={5}
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Bibliography</label>
                  <input
                    className="form-input"
                    value={extractEditData.bibliography}
                    onChange={(e) => setExtractEditData(prev => ({ ...prev, bibliography: e.target.value }))}
                    placeholder="Author, Title..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Chapter / Section</label>
                  <input
                    className="form-input"
                    value={extractEditData.chapter_section}
                    onChange={(e) => setExtractEditData(prev => ({ ...prev, chapter_section: e.target.value }))}
                    placeholder="Chapter 3 - ..."
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Position</label>
                  <input
                    className="form-input"
                    value={extractEditData.position}
                    onChange={(e) => setExtractEditData(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="Page, paragraph..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <input
                    className="form-input"
                    value={extractEditData.tags}
                    onChange={(e) => setExtractEditData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="tag1, tag2"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Highlight Color</label>
                <div className="color-swatch-picker">
                  {HIGHLIGHT_COLORS.map(c => (
                    <button
                      key={c.hex || 'none'}
                      className={`color-swatch ${extractEditData.highlight_color === c.hex ? 'active' : ''}`}
                      style={{ background: c.hex || 'var(--glass-bg-strong)' }}
                      onClick={() => setExtractEditData(prev => ({ ...prev, highlight_color: c.hex }))}
                      title={c.label}
                    >
                      {!c.hex && '—'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Create-form resources */}
              <div className="form-group">
                <label className="form-label">Linked Resources</label>
                {(extractEditData.resource_ids || []).length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {extractEditData.resource_ids.map((res, i) => (
                      <span key={i} className="resource-badge">
                        {res.project_id ? (
                          <>📁 {getProjectTitle(res.project_id)}</>
                        ) : (
                          <>✓ {getTaskTitle(res.task_id)}</>
                        )}
                        <button
                          className="resource-remove"
                          onClick={() => removeCreateResource(res)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <select
                    className="form-select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addCreateResource({ project_id: e.target.value });
                        e.target.value = '';
                      }
                    }}
                    style={{ minWidth: '180px' }}
                  >
                    <option value="">+ Link project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addCreateResource({ task_id: e.target.value });
                        e.target.value = '';
                      }
                    }}
                    style={{ minWidth: '180px' }}
                  >
                    <option value="">+ Link task...</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateExtractForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAB */}
      <button className="fab" onClick={() => {
        setExtractEditData({
          content: '', bibliography: '', chapter_section: '', position: '',
          tags: '', created_at: '', highlight_color: '', note_id: '', resource_ids: [],
        });
        setShowCreateExtractForm(true);
      }} title="Create new extract">
        +
      </button>
    </div>
  );
}
