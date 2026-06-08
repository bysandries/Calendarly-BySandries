import { useRef, useState, useCallback } from 'react';
import { markdownToHtml, htmlToMarkdown } from '../utils/mdEditor';
import useRichTextEditor from '../hooks/useRichTextEditor';
import RichTextToolbar from './RichTextToolbar';

export default function MarkdownEditor({ value, onChange, placeholder = 'Write something…', minRows = 4 }) {
  const editorRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(!value);

  const handleNotify = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    const md = htmlToMarkdown(html);
    setIsEmpty(!md.trim());
    onChange(md);
  }, [onChange]);

  const rte = useRichTextEditor(editorRef, { onInput: handleNotify });

  // Initialize from markdown value
  const [initialized, setInitialized] = useState(false);
  if (!initialized && editorRef.current) {
    const html = markdownToHtml(value || '');
    editorRef.current.innerHTML = html;
    setIsEmpty(!value);
    setInitialized(true);
  }

  const handleKeyDown = (e) => {
    if (rte.handleEditorKeyDown(e)) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      rte.fmt('bold');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      rte.fmt('italic');
    }
  };

  return (
    <div className="md-editor-wrapper">
      <RichTextToolbar rte={rte} />
      <div
        ref={editorRef}
        className={`md-editor ${isEmpty ? 'empty' : ''}`}
        contentEditable
        suppressContentEditableWarning
        onInput={rte.handleEditorInput}
        onClick={rte.handleEditorClick}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        style={{ minHeight: `${minRows * 24}px` }}
      />
    </div>
  );
}
