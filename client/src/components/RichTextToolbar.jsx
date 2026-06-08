import './RichTextToolbar.css';

const HEADING_OPTIONS = [
  { tag: 'p',  label: 'Normal',    cls: 'md-opt-normal' },
  { tag: 'h1', label: 'Heading 1', cls: 'md-opt-h1' },
  { tag: 'h2', label: 'Heading 2', cls: 'md-opt-h2' },
  { tag: 'h3', label: 'Heading 3', cls: 'md-opt-h3' },
  { tag: 'h4', label: 'Heading 4', cls: 'md-opt-h4' },
];

// Simple toolbar button
function TBtn({ title, onClick, children, active }) {
  return (
    <button
      type="button"
      className={`md-toolbar-btn${active ? ' active' : ''}`}
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    >
      {children}
    </button>
  );
}

// Split button: main click applies last color, arrow opens picker
function SplitColorBtn({ icon, lastHex, pickerOpen, onApply, onTogglePicker, title }) {
  return (
    <div className="md-split-btn">
      <button
        type="button"
        className="md-split-main"
        title={`${title} (${lastHex ? `#${lastHex}` : 'pick a color'})`}
        onMouseDown={(e) => { e.preventDefault(); if (lastHex) onApply(lastHex); else onTogglePicker(); }}
      >
        {icon}
        <span className="md-split-bar" style={{ background: lastHex ? `#${lastHex}` : 'transparent' }} />
      </button>
      <button
        type="button"
        className={`md-split-arrow${pickerOpen ? ' active' : ''}`}
        title="Pick color"
        onMouseDown={(e) => { e.preventDefault(); onTogglePicker(); }}
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
    </div>
  );
}

// Color swatch popover
function ColorPopover({ colors, onSelect }) {
  return (
    <div className="md-color-popover">
      {colors.map(c => (
        <button
          key={c.hex}
          type="button"
          className="md-color-swatch"
          style={{ background: `#${c.hex}` }}
          title={c.name}
          onMouseDown={(e) => { e.preventDefault(); onSelect(c.hex); }}
        />
      ))}
    </div>
  );
}

export default function RichTextToolbar({ rte }) {
  return (
    <div className="md-toolbar">

      {/* Heading selector */}
      <div className="md-popover-wrapper" ref={rte.headingRef}>
        <button
          type="button"
          className={`md-heading-selector${rte.headingOpen ? ' active' : ''}`}
          title="Heading style"
          onMouseDown={(e) => { e.preventDefault(); rte.toggleHeading(); }}
        >
          <span className="md-heading-label">{rte.blockLabel}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {rte.headingOpen && (
          <div className="md-heading-popover">
            {HEADING_OPTIONS.map(opt => (
              <button
                key={opt.tag}
                type="button"
                className={`md-heading-opt${rte.currentBlock === opt.tag ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); rte.applyHeading(opt.tag); }}
              >
                <span className={opt.cls}>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="md-toolbar-divider" />

      {/* Inline formatting */}
      <div className="md-toolbar-group">
        <TBtn title="Bold" onClick={() => rte.fmt('bold')}><strong>B</strong></TBtn>
        <TBtn title="Italic" onClick={() => rte.fmt('italic')}><em>I</em></TBtn>
        <TBtn title="Underline" onClick={() => rte.fmt('underline')}>
          <span style={{ textDecoration: 'underline' }}>U</span>
        </TBtn>
      </div>

      <div className="md-toolbar-divider" />

      {/* Lists */}
      <div className="md-toolbar-group">
        <TBtn title="Bullet list" onClick={() => rte.fmt('insertUnorderedList')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </TBtn>
        <TBtn title="Numbered list" onClick={() => rte.fmt('insertOrderedList')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
            <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1.</text>
            <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2.</text>
            <text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3.</text>
          </svg>
        </TBtn>
        <TBtn title="Checklist" active={rte.isInChecklist} onClick={rte.insertChecklist}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="6" height="6" rx="1.2"/>
            <polyline points="4.2 7 5.8 9 8.8 5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="13" y1="7" x2="21" y2="7"/>
            <rect x="3" y="14" width="6" height="6" rx="1.2"/>
            <line x1="13" y1="17" x2="21" y2="17"/>
          </svg>
        </TBtn>
      </div>

      <div className="md-toolbar-divider" />

      {/* Highlight (background only) */}
      <div className="md-popover-wrapper" ref={rte.highlightRef}>
        <SplitColorBtn
          title="Highlight"
          lastHex={rte.lastHighlight}
          pickerOpen={rte.highlightOpen}
          onApply={rte.applyHighlight}
          onTogglePicker={rte.toggleHighlightPicker}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15.5 2.1L21.9 8.5l-11 11-8.9.9.9-8.9z"/>
              <line x1="3" y1="21" x2="21" y2="21" strokeWidth="2"/>
            </svg>
          }
        />
        {rte.highlightOpen && (
          <ColorPopover colors={rte.colors} onSelect={rte.applyHighlight} />
        )}
      </div>

      {/* Text color (foreground only) */}
      <div className="md-popover-wrapper" ref={rte.textColorRef}>
        <SplitColorBtn
          title="Text color"
          lastHex={rte.lastTextColor}
          pickerOpen={rte.textColorOpen}
          onApply={rte.applyTextColor}
          onTogglePicker={rte.toggleTextColorPicker}
          icon={
            <span className="md-textcolor-icon" style={{ '--tc': rte.lastTextColor ? `#${rte.lastTextColor}` : 'currentColor' }}>
              A
            </span>
          }
        />
        {rte.textColorOpen && (
          <ColorPopover colors={rte.colors} onSelect={rte.applyTextColor} />
        )}
      </div>

    </div>
  );
}
