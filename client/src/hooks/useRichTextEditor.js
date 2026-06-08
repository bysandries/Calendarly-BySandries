import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchAreas } from '../utils/api/areas';

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

const BLOCK_LABEL = { p: 'Normal', div: 'Normal', h1: 'H1', h2: 'H2', h3: 'H3', h4: 'H4' };

// ── Checklist helpers (used by tryChecklistShortcut + insertChecklist) ──

const makeItem = (checked = false) => {
  const li = document.createElement('li');
  if (checked) li.classList.add('dp-checked');
  return li;
};

const ensureFiller = (li) => {
  if (!li.firstChild) li.appendChild(document.createElement('br'));
};

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

const stripLeadingMarker = (el) => {
  let n = el.firstChild;
  while (n?.nodeType === 3 && n.textContent === '') n = n.nextSibling;
  if (n?.nodeType === 3) n.textContent = n.textContent.replace(/^(?:- )?\[[ xX]?\]\s?/, '');
};

const fillItem = (li, source) => {
  Array.from(source.childNodes).forEach(n => {
    if (n.nodeType === 1 && n.nodeName === 'BR') return;
    li.appendChild(n);
  });
  stripLeadingMarker(li);
  ensureFiller(li);
};

export default function useRichTextEditor(editorRef, { onInput }) {
  const [colors, setColors] = useState(DEFAULT_COLORS);

  // Heading selector state
  const [currentBlock, setCurrentBlock] = useState('p');
  const [headingOpen, setHeadingOpen] = useState(false);

  // Highlight / text color state
  const [lastHighlight, setLastHighlight] = useState(null);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [lastTextColor, setLastTextColor] = useState(null);
  const [textColorOpen, setTextColorOpen] = useState(false);

  // Checklist cursor tracking
  const [isInChecklist, setIsInChecklist] = useState(false);

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
  }, [editorRef]);

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

  // ── Format commands ───────────────────────────────────────────

  const fmt = useCallback((cmd, value = null) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    onInput();
  }, [editorRef, onInput]);

  const applyHeading = useCallback((tag) => {
    const toApply = tag === currentBlock ? 'p' : tag;
    document.execCommand('formatBlock', false, toApply);
    setCurrentBlock(toApply);
    setHeadingOpen(false);
    editorRef.current?.focus();
    onInput();
  }, [currentBlock, editorRef, onInput]);

  const applyHighlight = useCallback((hex) => {
    const [r, g, b] = hexToRgb(hex);
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('hiliteColor', false, `rgba(${r},${g},${b},0.35)`);
    setLastHighlight(hex);
    setHighlightOpen(false);
    editorRef.current?.focus();
    onInput();
  }, [editorRef, onInput]);

  const applyTextColor = useCallback((hex) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, `#${hex}`);
    setLastTextColor(hex);
    setTextColorOpen(false);
    editorRef.current?.focus();
    onInput();
  }, [editorRef, onInput]);

  // ── Checklist ─────────────────────────────────────────────────

  const tryChecklistShortcut = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return false;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return false;
    const startNode = sel.getRangeAt(0).startContainer;
    const el = startNode.nodeType === 1 ? startNode : startNode.parentElement;
    if (el?.closest('.dp-checklist')) return false;

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
          break;
        }
      }
      while (block.firstChild) li.appendChild(block.firstChild);
    } else {
      const remaining = text.slice(prefixLen);
      if (remaining) li.appendChild(document.createTextNode(remaining));
    }
    ensureFiller(li);

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
  }, [editorRef]);

  const insertChecklist = useCallback(() => {
    const editor = editorRef.current;
    editor?.focus();
    const sel = window.getSelection();
    if (!sel?.rangeCount || !editor || !editor.contains(sel.anchorNode)) return;
    const node = sel.getRangeAt(0).startContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;

    // 1) Already a checklist item → toggle back to paragraph
    const existingLi = el?.closest('.dp-checklist li');
    if (existingLi) {
      const ul = existingLi.closest('.dp-checklist');
      const p = document.createElement('p');
      Array.from(existingLi.childNodes).forEach(n => {
        if (n.nodeType === 1 && n.nodeName === 'BR') return;
        p.appendChild(n);
      });
      if (!p.textContent.trim()) p.innerHTML = '<br>';
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
      onInput();
      return;
    }

    // 2) Inside a plain list → convert the whole list to checklist
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
      onInput();
      return;
    }

    // 3) A top-level block or the empty editor
    let block = el;
    while (block && block !== editor && block.parentElement !== editor) block = block.parentElement;
    const target = block && block !== editor ? block : null;

    const li = makeItem();
    if (target) fillItem(li, target);
    else ensureFiller(li);

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
    onInput();
  }, [editorRef, onInput]);

  // Toggle a checklist item by clicking its CSS checkbox (left ~22px zone)
  const handleEditorClick = useCallback((e) => {
    const li = e.target.closest?.('.dp-checklist li');
    if (!li) return;
    const rect = li.getBoundingClientRect();
    if (e.clientX - rect.left <= 22) {
      li.classList.toggle('dp-checked');
      onInput();
    }
  }, [onInput]);

  // Enter inside checklist: new item or exit list
  const handleEditorKeyDown = useCallback((e) => {
    if (e.key !== 'Enter') return false;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return false;
    const node = sel.getRangeAt(0).startContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    const li = el?.closest('.dp-checklist li');
    if (!li) return false;
    e.preventDefault();

    if (li.textContent.trim() === '') {
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
    onInput();
    return true;
  }, [onInput]);

  const handleEditorInput = useCallback(() => {
    tryChecklistShortcut();
    onInput();
  }, [tryChecklistShortcut, onInput]);

  const blockLabel = BLOCK_LABEL[currentBlock] ?? 'Normal';

  return {
    // Refs
    headingRef,
    highlightRef,
    textColorRef,

    // State
    headingOpen,
    currentBlock,
    isInChecklist,
    highlightOpen,
    textColorOpen,
    lastHighlight,
    lastTextColor,
    colors: uniqueColors,
    blockLabel,

    // Actions
    setHeadingOpen,
    toggleHeading: () => setHeadingOpen(p => !p),
    applyHeading,
    fmt,
    applyHighlight,
    applyTextColor,
    toggleHighlightPicker: () => setHighlightOpen(p => !p),
    toggleTextColorPicker: () => setTextColorOpen(p => !p),
    insertChecklist,

    // Editor event handlers
    handleEditorInput,
    handleEditorClick,
    handleEditorKeyDown,
  };
}
