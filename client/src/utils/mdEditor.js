// Converts Markdown → editor HTML and back.
// Supports: headings, bold, italic, underline (inline HTML), bullet/ordered
// lists, checklists (- [ ] / - [x]), highlight and color spans (inline HTML).

// ── Markdown → HTML ──────────────────────────────────────────────────────────

function inlineToHtml(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function markdownToHtml(md) {
  if (!md) return '';
  // Legacy HTML notes: pass through unchanged
  if (md.trimStart().startsWith('<')) return md;

  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith('#### ')) { out.push(`<h4>${inlineToHtml(line.slice(5))}</h4>`); i++; continue; }
    if (line.startsWith('### '))  { out.push(`<h3>${inlineToHtml(line.slice(4))}</h3>`); i++; continue; }
    if (line.startsWith('## '))   { out.push(`<h2>${inlineToHtml(line.slice(3))}</h2>`); i++; continue; }
    if (line.startsWith('# '))    { out.push(`<h1>${inlineToHtml(line.slice(2))}</h1>`); i++; continue; }

    // Checklist: - [ ] or - [x] / - [X]
    if (/^- \[[ xX]\] /.test(line)) {
      const items = [];
      while (i < lines.length && /^- \[[ xX]\] /.test(lines[i])) {
        const checked = lines[i][3] !== ' ';
        const text = inlineToHtml(lines[i].slice(6));
        items.push(
          `<li class="${checked ? 'dp-checked' : ''}">` +
          `<span class="dp-checkbox${checked ? ' checked' : ''}" contenteditable="false"></span>` +
          `${text}</li>`
        );
        i++;
      }
      out.push(`<ul class="dp-checklist">${items.join('')}</ul>`);
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(`<li>${inlineToHtml(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineToHtml(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') { out.push('<p><br></p>'); i++; continue; }

    // Paragraph
    out.push(`<p>${inlineToHtml(line)}</p>`);
    i++;
  }

  return out.join('');
}

// ── HTML → Markdown ──────────────────────────────────────────────────────────

function nodeToMd(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return '';

  const tag = node.tagName.toLowerCase();
  const kids = () => Array.from(node.childNodes).map(nodeToMd).join('');

  switch (tag) {
    case 'h1': return `# ${kids()}\n`;
    case 'h2': return `## ${kids()}\n`;
    case 'h3': return `### ${kids()}\n`;
    case 'h4': return `#### ${kids()}\n`;
    case 'strong': case 'b': return `**${kids()}**`;
    case 'em': case 'i': return `*${kids()}*`;
    case 'u': return `<u>${kids()}</u>`;
    case 'br': return '\n';
    case 'p': {
      const inner = kids();
      return inner === '\n' ? '\n' : `${inner}\n`;
    }
    case 'ul': {
      if (node.classList.contains('dp-checklist')) {
        return Array.from(node.children).map(li => {
          const checked = li.classList.contains('dp-checked');
          const text = Array.from(li.childNodes)
            .filter(n => !(n.nodeType === 1 && n.classList?.contains('dp-checkbox')))
            .map(nodeToMd).join('').trim();
          return `- [${checked ? 'x' : ' '}] ${text}\n`;
        }).join('');
      }
      return Array.from(node.children)
        .map(li => `- ${Array.from(li.childNodes).map(nodeToMd).join('').trim()}\n`)
        .join('');
    }
    case 'ol':
      return Array.from(node.children)
        .map((li, idx) => `${idx + 1}. ${Array.from(li.childNodes).map(nodeToMd).join('').trim()}\n`)
        .join('');
    case 'li': return kids();
    case 'span': {
      const style = node.getAttribute('style') || '';
      if (style) return `<span style="${style}">${kids()}</span>`;
      return kids();
    }
    case 'div': return `${kids()}\n`;
    default: return kids();
  }
}

export function htmlToMarkdown(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return Array.from(div.childNodes).map(nodeToMd).join('').trimEnd();
}
