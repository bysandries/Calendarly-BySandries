import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DateTime } from 'luxon';
import { api } from '../utils/api/core';
import { fetchAreas } from '../utils/api/areas';
import { markdownToHtml, htmlToMarkdown } from '../utils/mdEditor';
import './DayPlannerPanel.css';

// ── Helpers ──────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function dedupeColors(list) {
  const seen = new Set();
  return list.filter(c => {
    const key = c.hex.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const DEFAULT_COLORS = [
  { id: 'r', hex: 'E74C3C', name: 'Red' },
  { id: 'o', hex: 'E67E22', name: 'Orange' },
  { id: 'y', hex: 'F1C40F', name: 'Yellow' },
  { id: 'g', hex: '2ECC71', name: 'Green' },
  { id: 'b', hex: '3498DB', name: 'Blue' },
  { id: 'p', hex: '9B59B6', name: 'Purple' },
  { id: 'w', hex: 'FFFFFF', name: 'White' },
];

const HEADING_OPTIONS = [
  { tag: 'p',  label: 'Normal',    cls: 'dp-opt-normal' },
  { tag: 'h1', label: 'Heading 1', cls: 'dp-opt-h1' },
  { tag: 'h2', label: 'Heading 2', cls: 'dp-opt-h2' },
  { tag: 'h3', label: 'Heading 3', cls: 'dp-opt-h3' },
  { tag: 'h4', label: 'Heading 4', cls: 'dp-opt-h4' },
];

const BLOCK_LABEL = { p: 'Normal', div: 'Normal', h1: 'H1', h2: 'H2', h3: 'H3', h4: 'H4' };

// ── Toolbar helpers ───────────────────────────────────────────────
const TBtn = ({ title, onClick, children, active }) => (
  <button
    type="button"
    className={`dp-toolbar-btn${active ? ' active' : ''}`}
    title={title}
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
  >
    {children}
  </button>
);

// Split button: main click applies last color, arrow opens picker
const SplitColorBtn = ({ icon, lastHex, pickerOpen, onApply, onTogglePicker, title }) => (
  <div className="dp-split-btn">
    <button
      type="button"
      className="dp-split-main"
      title={`${title} (${lastHex ? `#${lastHex}` : 'pick a color'})`}
      onMouseDown={(e) => { e.preventDefault(); if (lastHex) onApply(lastHex); else onTogglePicker(); }}
    >
      {icon}
      <span className="dp-split-bar" style={{ background: lastHex ? `#${lastHex}` : 'transparent' }} />
    </button>
    <button
      type="button"
      className={`dp-split-arrow${pickerOpen ? ' active' : ''}`}
      title="Pick color"
      onMouseDown={(e) => { e.preventDefault(); onTogglePicker(); }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>
  </div>
);

// Color swatch popover
const ColorPopover = ({ colors, onSelect }) => (
  <div className="dp-color-popover">
    {colors.map(c => (
      <button
        key={c.hex}
        type="button"
        className="dp-color-swatch"
        style={{ background: `#${c.hex}` }}
        title={c.name}
        onMouseDown={(e) => { e.preventDefault(); onSelect(c.hex); }}
      />
    ))}
  </div>
);

// ── Component ────────────────────────────────────────────────────
const DayPlannerPanel = ({ isOpen, onToggle }) => {
  const [saveStatus, setSaveStatus] = useState('idle');
  const [currentDate, setCurrentDate] = useState(() => DateTime.now().startOf('day'));
  const [colors, setColors] = useState(DEFAULT_COLORS);

  // Heading selector state
  const [currentBlock, setCurrentBlock] = useState('p');
  const [headingOpen, setHeadingOpen] = useState(false);

  // Highlight state (background only)
  const [lastHighlight, setLastHighlight] = useState(null);
  const [highlightOpen, setHighlightOpen] = useState(false);

  // Text color state (foreground only)
  const [lastTextColor, setLastTextColor] = useState(null);
  const [textColorOpen, setTextColorOpen] = useState(false);

  // Checklist cursor tracking
  const [isInChecklist, setIsInChecklist] = useState(false);

  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const loadedDateRef = useRef(null);
  const headingRef = useRef(null);
  const highlightRef = useRef(null);
  const textColorRef = useRef(null);

  const uniqueColors = useMemo(() => dedupeColors(colors), [colors]);

  // Seed last-used colors from area palette once loaded
  useEffect(() => {
    if (uniqueColors.length > 0) {
      setLastHighlight(prev => prev ?? uniqueColors[0].hex);
      setLastTextColor(prev => prev ?? uniqueColors[0].hex);
    }
  }, [uniqueColors]);

  // Load area colors
  useEffect(() => {
    fetchAreas()
      .then(areas => {
        const colored = areas.filter(a => a.color_hex);
        if (colored.length > 0)
          setColors(colored.map(a => ({
            id: a.id,
            hex: a.color_hex.replace(/^#/, ''),
            name: a.name,
          })));
      })
      .catch(() => {});
  }, []);

  // Detect current block level and checklist state from selection
  useEffect(() => {
    const handler = () => {
      if (!editorRef.current) return;
      const sel = window.getSelection();
      if (!sel?.rangeCount || !editorRef.current.contains(sel.anchorNode)) return;
      const node = sel.getRangeAt(0).startContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      const block = el?.closest('h1,h2,h3,h4,p,div');
      if (block) setCurrentBlock(block.tagName.toLowerCase());
      setIsInChecklist(!!el?.closest('.dp-checklist'));
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!headingRef.current?.contains(e.target)) setHeadingOpen(false);
      if (!highlightRef.current?.contains(e.target)) setHighlightOpen(false);
      if (!textColorRef.current?.contains(e.target)) setTextColorOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load note for current date
  useEffect(() => {
    if (!isOpen || !editorRef.current) return;
    loadedDateRef.current = dateId;
    setSaveStatus('idle');
    api.get('/daily-logs', { date: dateId })
      .then(rows => {
        if (loadedDateRef.current !== dateId) return;
        editorRef.current.innerHTML = markdownToHtml(rows[0]?.note || '');
      })
      .catch(() => {});
  }, [currentDate, isOpen]); // eslint-disable-line

  const dateId = currentDate.toFormat('yyyy-MM-dd');

  const saveNote = useCallback((html, dId) => {
    setSaveStatus('saving');
    const note = htmlToMarkdown(html);
    api.post('/daily-logs', { date_id: dId, note })
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('idle'));
  }, []);

  const triggerSave = useCallback(() => {
    setSaveStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (editorRef.current) saveNote(editorRef.current.innerHTML, dateId);
    }, 800);
  }, [saveNote, dateId]);

  const handleInput = () => {
    tryChecklistShortcut();
    triggerSave();
  };

  const handleSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (editorRef.current) saveNote(editorRef.current.innerHTML, dateId);
  };

  // ── Format commands ───────────────────────────────────────────

  const fmt = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    triggerSave();
  };

  const applyHeading = (tag) => {
    const toApply = tag === currentBlock ? 'p' : tag;
    document.execCommand('formatBlock', false, toApply);
    setCurrentBlock(toApply);
    setHeadingOpen(false);
    editorRef.current?.focus();
    triggerSave();
  };

  const applyHighlight = (hex) => {
    const [r, g, b] = hexToRgb(hex);
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('hiliteColor', false, `rgba(${r},${g},${b},0.35)`);
    setLastHighlight(hex);
    setHighlightOpen(false);
    editorRef.current?.focus();
    triggerSave();
  };

  const applyTextColor = (hex) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, `#${hex}`);
    setLastTextColor(hex);
    setTextColorOpen(false);
    editorRef.current?.focus();
    triggerSave();
  };

  const handlePrevDay = () => setCurrentDate(d => d.minus({ days: 1 }));
  const handleNextDay = () => setCurrentDate(d => d.plus({ days: 1 }));
  const handleToday = () => setCurrentDate(DateTime.now().startOf('day'));

  // ── Checklist ─────────────────────────────────────────────────

  // A checklist item is a PLAIN editable <li>; its checkbox is drawn in CSS
  // (li::before). There is no contenteditable=false node inside it — that is what
  // keeps the caret alive and the line typeable (the earlier "frozen line" bug).
  // Empty items carry a bogus <br> so the browser gives them a caret line.
  const makeItem = (checked = false) => {
    const li = document.createElement('li');
    if (checked) li.classList.add('dp-checked');
    return li;
  };

  const ensureFiller = (li) => {
    if (!li.firstChild) li.appendChild(document.createElement('br'));
  };

  // Drop the caret into a line: at the end of real content, or at the start when
  // the line is empty (before its bogus <br>).
  const caretInto = (li) => {
    const sel = window.getSelection();
    if (!li || !sel) return;
    const range = document.createRange();
    if (li.lastChild && li.lastChild.nodeName !== 'BR') {
      range.selectNodeContents(li);
      range.collapse(false);
    } else {
      range.setStart(li, 0);
      range.collapse(true);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  };

  // Strip a leading literal "[ ] " / "[x] " / "- [ ] " from a line's first text node.
  const stripLeadingMarker = (el) => {
    let n = el.firstChild;
    while (n?.nodeType === 3 && n.textContent === '') n = n.nextSibling;
    if (n?.nodeType === 3) n.textContent = n.textContent.replace(/^(?:- )?\[[ xX]?\]\s?/, '');
  };

  // Move a source block's inline content into a checklist <li> (drop <br> fillers),
  // then clean a leading literal marker and ensure the item stays caret-friendly.
  const fillItem = (li, source) => {
    Array.from(source.childNodes).forEach(n => {
      if (n.nodeType === 1 && n.nodeName === 'BR') return;
      li.appendChild(n);
    });
    stripLeadingMarker(li);
    ensureFiller(li);
  };

  // Live markdown shortcut: typing "- [ ] " / "- [x] " at the start of a line
  // converts that line into a checklist item with the caret in the text.
  const tryChecklistShortcut = () => {
    const editor = editorRef.current;
    if (!editor) return false;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return false;
    const startNode = sel.getRangeAt(0).startContainer;
    const el = startNode.nodeType === 1 ? startNode : startNode.parentElement;
    if (el?.closest('.dp-checklist')) return false; // already a checklist item

    // The "line" we transform: a top-level block, or a bare text node child of the editor.
    let block = el?.closest('h1,h2,h3,h4,p,div');
    if (block && block !== editor) {
      while (block.parentElement && block.parentElement !== editor) block = block.parentElement;
      if (block.parentElement !== editor) block = null;
    } else {
      block = null;
    }

    let text, replaceTarget, fromBlock;
    if (block) {
      text = block.textContent;
      replaceTarget = block;
      fromBlock = true;
    } else {
      if (startNode.nodeType !== 3 || startNode.parentNode !== editor) return false;
      text = startNode.textContent;
      replaceTarget = startNode;
      fromBlock = false;
    }

    const m = text.match(/^- \[([ xX]?)\] /);
    if (!m) return false;
    const checked = /[xX]/.test(m[1]);
    const prefixLen = m[0].length;

    const li = makeItem(checked);

    if (fromBlock) {
      // Strip the "- [ ] " prefix from the leading text node(s), keep formatting after it.
      // Leading <br> (empty placeholder paragraphs render as <p><br></p>) are removed too.
      let toRemove = prefixLen;
      let n = block.firstChild;
      while (n && toRemove > 0) {
        if (n.nodeType === 3) {
          const len = n.textContent.length;
          if (len <= toRemove) { toRemove -= len; const next = n.nextSibling; n.remove(); n = next; }
          else { n.textContent = n.textContent.slice(toRemove); toRemove = 0; }
        } else if (n.nodeName === 'BR') {
          const next = n.nextSibling; n.remove(); n = next;
        } else {
          break; // hit formatted content before the prefix was consumed
        }
      }
      while (block.firstChild) li.appendChild(block.firstChild);
    } else {
      const remaining = text.slice(prefixLen);
      if (remaining) li.appendChild(document.createTextNode(remaining));
    }
    ensureFiller(li);

    // Append to an adjacent checklist if one precedes this line, else make a new one.
    const prev = replaceTarget.previousSibling;
    if (prev?.nodeType === 1 && prev.classList?.contains('dp-checklist')) {
      prev.appendChild(li);
      replaceTarget.remove();
    } else {
      const ul = document.createElement('ul');
      ul.className = 'dp-checklist';
      ul.appendChild(li);
      editor.replaceChild(ul, replaceTarget);
    }

    caretInto(li);
    return true;
  };

  // Toolbar checklist button: convert the current line/list in place (and toggle back).
  const insertChecklist = () => {
    const editor = editorRef.current;
    editor?.focus();
    const sel = window.getSelection();
    if (!sel?.rangeCount || !editor || !editor.contains(sel.anchorNode)) return;
    const node = sel.getRangeAt(0).startContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;

    // 1) Already a checklist item → toggle it back to a paragraph, in place.
    const existingLi = el?.closest('.dp-checklist li');
    if (existingLi) {
      const ul = existingLi.closest('.dp-checklist');
      const p = document.createElement('p');
      Array.from(existingLi.childNodes).forEach(n => {
        if (n.nodeType === 1 && n.nodeName === 'BR') return;
        p.appendChild(n);
      });
      if (!p.textContent.trim()) p.innerHTML = '<br>';
      // Split the list around this item so order is preserved wherever it sat.
      const after = document.createElement('ul');
      after.className = 'dp-checklist';
      let s = existingLi.nextSibling;
      while (s) { const next = s.nextSibling; after.appendChild(s); s = next; }
      existingLi.remove();
      ul.parentNode.insertBefore(p, ul.nextSibling);
      if (after.children.length) ul.parentNode.insertBefore(after, p.nextSibling);
      if (ul.children.length === 0) ul.remove();
      const range = document.createRange();
      range.setStart(p, 0); range.collapse(true);
      sel.removeAllRanges(); sel.addRange(range);
      triggerSave();
      return;
    }

    // 2) Inside a plain bullet/numbered list → convert the whole list to a checklist.
    const plainLi = el?.closest('li');
    if (plainLi) {
      const list = plainLi.closest('ul,ol');
      const ul = document.createElement('ul');
      ul.className = 'dp-checklist';
      let firstItem = null;
      Array.from(list.children).forEach(srcLi => {
        if (srcLi.nodeName !== 'LI') return;
        const li = makeItem();
        fillItem(li, srcLi);
        ul.appendChild(li);
        firstItem = firstItem || li;
      });
      list.parentNode.replaceChild(ul, list);
      caretInto(firstItem);
      triggerSave();
      return;
    }

    // 3) A top-level block (p/div/heading) or the empty editor.
    let block = el;
    while (block && block !== editor && block.parentElement !== editor) block = block.parentElement;
    const target = block && block !== editor ? block : null;

    const li = makeItem();
    if (target) fillItem(li, target);
    else ensureFiller(li);

    // Merge with an adjacent checklist if one touches this line; else make a new list.
    const prev = target?.previousSibling;
    const next = target?.nextSibling;
    if (prev?.nodeType === 1 && prev.classList?.contains('dp-checklist')) {
      prev.appendChild(li);
      target.remove();
    } else if (next?.nodeType === 1 && next.classList?.contains('dp-checklist')) {
      next.insertBefore(li, next.firstChild);
      target.remove();
    } else {
      const ul = document.createElement('ul');
      ul.className = 'dp-checklist';
      ul.appendChild(li);
      if (target) editor.replaceChild(ul, target);
      else editor.appendChild(ul);
    }

    caretInto(li);
    triggerSave();
  };

  // Toggle a checklist item by clicking its CSS checkbox (the left ~22px zone).
  const handleEditorClick = (e) => {
    const li = e.target.closest?.('.dp-checklist li');
    if (!li) return;
    const rect = li.getBoundingClientRect();
    if (e.clientX - rect.left <= 22) {
      li.classList.toggle('dp-checked');
      triggerSave();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const node = sel.getRangeAt(0).startContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    const li = el?.closest('.dp-checklist li');
    if (!li) return;
    e.preventDefault();

    if (li.textContent.trim() === '') {
      // Empty item → exit checklist, insert a paragraph after the list.
      const ul = li.closest('.dp-checklist');
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      ul.parentNode.insertBefore(p, ul.nextSibling);
      li.remove();
      if (ul.children.length === 0) ul.remove();
      const range = document.createRange();
      range.setStart(p, 0);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      const newLi = makeItem();
      ensureFiller(newLi);
      li.parentNode.insertBefore(newLi, li.nextSibling);
      caretInto(newLi);
    }
    triggerSave();
  };

  const isToday = currentDate.hasSame(DateTime.now(), 'day');
  const blockLabel = BLOCK_LABEL[currentBlock] ?? 'Normal';

  return (
    <div className="day-planner-panel">
      <button type="button" className="day-planner-toggle" onClick={onToggle}
        title={isOpen ? 'Collapse Planner' : 'Open Day Planner'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isOpen ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
        </svg>
        {!isOpen && <span className="day-planner-toggle-label">Plan</span>}
      </button>

      {isOpen && (
        <div className="day-planner-content">

          {/* ── Header ── */}
          <div className="day-planner-header">
            <div className="day-planner-nav">
              <button className="day-planner-nav-btn" onClick={handlePrevDay} title="Previous day">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button className={`day-planner-today-btn${isToday ? ' is-today' : ''}`} onClick={handleToday}>Today</button>
              <button className="day-planner-nav-btn" onClick={handleNextDay} title="Next day">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            <div className="day-planner-header-row2">
              <div className="day-planner-date">{currentDate.toFormat('EEEE, LLL d, yyyy')}</div>
              <button type="button" className={`day-planner-save-btn${saveStatus === 'saved' ? ' saved' : ''}`} onClick={handleSave}>
                {saveStatus === 'saved' ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save</>
                )}
              </button>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="dp-toolbar">

            {/* Heading selector */}
            <div className="dp-popover-wrapper" ref={headingRef}>
              <button
                type="button"
                className={`dp-heading-selector${headingOpen ? ' active' : ''}`}
                title="Heading style"
                onMouseDown={(e) => { e.preventDefault(); setHeadingOpen(p => !p); }}
              >
                <span className="dp-heading-label">{blockLabel}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {headingOpen && (
                <div className="dp-heading-popover">
                  {HEADING_OPTIONS.map(opt => (
                    <button
                      key={opt.tag}
                      type="button"
                      className={`dp-heading-opt${currentBlock === opt.tag ? ' active' : ''}`}
                      onMouseDown={(e) => { e.preventDefault(); applyHeading(opt.tag); }}
                    >
                      <span className={opt.cls}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="dp-toolbar-divider" />

            {/* Inline formatting */}
            <div className="dp-toolbar-group">
              <TBtn title="Bold" onClick={() => fmt('bold')}><strong>B</strong></TBtn>
              <TBtn title="Italic" onClick={() => fmt('italic')}><em>I</em></TBtn>
              <TBtn title="Underline" onClick={() => fmt('underline')}>
                <span style={{ textDecoration: 'underline' }}>U</span>
              </TBtn>
            </div>

            <div className="dp-toolbar-divider" />

            {/* Lists */}
            <div className="dp-toolbar-group">
              <TBtn title="Bullet list" onClick={() => fmt('insertUnorderedList')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
                  <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
              </TBtn>
              <TBtn title="Numbered list" onClick={() => fmt('insertOrderedList')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
                  <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1.</text>
                  <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2.</text>
                  <text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3.</text>
                </svg>
              </TBtn>
              <TBtn title="Checklist" active={isInChecklist} onClick={insertChecklist}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="6" height="6" rx="1.2"/>
                  <polyline points="4.2 7 5.8 9 8.8 5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="13" y1="7" x2="21" y2="7"/>
                  <rect x="3" y="14" width="6" height="6" rx="1.2"/>
                  <line x1="13" y1="17" x2="21" y2="17"/>
                </svg>
              </TBtn>
            </div>

            <div className="dp-toolbar-divider" />

            {/* Highlight (background only) */}
            <div className="dp-popover-wrapper" ref={highlightRef}>
              <SplitColorBtn
                title="Highlight"
                lastHex={lastHighlight}
                pickerOpen={highlightOpen}
                onApply={applyHighlight}
                onTogglePicker={() => setHighlightOpen(p => !p)}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M15.5 2.1L21.9 8.5l-11 11-8.9.9.9-8.9z"/>
                    <line x1="3" y1="21" x2="21" y2="21" strokeWidth="2"/>
                  </svg>
                }
              />
              {highlightOpen && (
                <ColorPopover colors={uniqueColors} onSelect={applyHighlight} />
              )}
            </div>

            {/* Text color (foreground only) */}
            <div className="dp-popover-wrapper" ref={textColorRef}>
              <SplitColorBtn
                title="Text color"
                lastHex={lastTextColor}
                pickerOpen={textColorOpen}
                onApply={applyTextColor}
                onTogglePicker={() => setTextColorOpen(p => !p)}
                icon={
                  <span className="dp-textcolor-icon" style={{ '--tc': lastTextColor ? `#${lastTextColor}` : 'currentColor' }}>
                    A
                  </span>
                }
              />
              {textColorOpen && (
                <ColorPopover colors={uniqueColors} onSelect={applyTextColor} />
              )}
            </div>

          </div>

          {/* ── Editor ── */}
          <div className="day-planner-body">
            <div
              ref={editorRef}
              className="day-planner-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onClick={handleEditorClick}
              onKeyDown={handleKeyDown}
              data-placeholder="What's important today?"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DayPlannerPanel;
