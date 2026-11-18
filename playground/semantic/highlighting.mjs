import * as lexer from '../../examples/v2-aeon-roundtrip/node_modules/@altopelago/aeon-lexer/dist/index.js';
import { createAeonHighlighter } from './vendor/aeon-token-highlight.mjs';

export const escapeHtml = (source) => source.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const wrap = (role, source) => `<span class="tok-${role}">${escapeHtml(source)}</span>`;
const shared = createAeonHighlighter(lexer);
export const highlightAeon = (source) => shared.highlightAeon(source);
const keywords = new Set(['from', 'where', 'select', 'order', 'by', 'asc', 'desc', 'limit', 'offset', 'and', 'or', 'not', 'as', 'in', 'is']);

export function highlightSansa(source) {
  // Only lexer identifiers can be query keywords: quoted text, symbols, paths,
  // and comments retain their original lexical meaning and spelling.
  const tokens = lexer.tokenize(source).tokens.filter((token) => token.type === lexer.TokenType.Identifier && keywords.has(token.value));
  let offset = 0;
  const parts = [];
  for (const token of tokens) {
    parts.push(highlightAeon(source.slice(offset, token.span.start.offset)), wrap('keyword', source.slice(token.span.start.offset, token.span.end.offset)));
    offset = token.span.end.offset;
  }
  parts.push(highlightAeon(source.slice(offset)));
  return parts.join('');
}

function inlineAnd(source) {
  // Tolerant presentation lexer: show syntax while a document is incomplete.
  // Validation remains exclusively in and-core, not in this renderer.
  const pattern = /\\[^\n]|\[(?:\([A-Za-z0-9._:-]+\)|[*/$@#~!?:+="'_^%<>.n-])|\[[ x,;]\]|\]|\|/g;
  let offset = 0;
  const parts = [];
  for (let match; (match = pattern.exec(source));) {
    parts.push(escapeHtml(source.slice(offset, match.index)));
    const value = match[0];
    if (value === '[:') {
      // Each closer search consumes the interval it examines. A missing closer
      // consumes the rest of this line once, including any further openers.
      const close = source.indexOf(']', pattern.lastIndex);
      const end = close < 0 ? source.length : close;
      parts.push(wrap('punct', value), highlightAeon(source.slice(pattern.lastIndex, end)));
      if (close >= 0) parts.push(wrap('punct', ']'));
      offset = close < 0 ? end : close + 1;
      pattern.lastIndex = offset;
    } else {
      parts.push(wrap(value.startsWith('\\') ? 'type' : value.startsWith('[') ? 'tag' : 'punct', value));
      offset = match.index + value.length;
    }
  }
  parts.push(escapeHtml(source.slice(offset)));
  return parts.join('');
}

export function highlightAnd(source) {
  let opaque = null;
  let fallback = false;
  return source.split('\n').map((line) => {
    if (opaque) {
      if (line.trim().startsWith(opaque)) { opaque = null; return wrap('punct', line); }
      return wrap('string', line);
    }
    const fence = /^\s*(`{3,}|~~~\$|\+\+\+)(.*)$/.exec(line);
    if (fence) {
      // A fallback region contains ordinary &ND, unlike extension payloads.
      if (fence[1] === '+++' && fence[2].trim() === 'fallback') fallback = true;
      else if (fence[1] === '+++' && fallback && !fence[2].trim()) fallback = false;
      else opaque = fence[1];
      return wrap('type', line);
    }
    if (/^\s*~~~/.test(line)) return wrap('tag', line);
    const prefix = /^(\s*)(?:(&ND\s+v\d+)|(#{1,6}\s+)|(-\s+|\d+\.\s+)|(>\s*)|(---\s*$))/.exec(line);
    if (prefix) return wrap(prefix[2] ? 'keyword' : 'type', prefix[0]) + inlineAnd(line.slice(prefix[0].length));
    return inlineAnd(line);
  }).join('\n');
}

export function highlight(source, language) {
  if (source.length > 262_144) return escapeHtml(source);
  try { return ({ and: highlightAnd, aeon: highlightAeon, sansa: highlightSansa }[language])(source); }
  catch { return escapeHtml(source); }
}

export function attachEditor(textarea, language) {
  const editor = document.createElement('div');
  editor.className = `highlight-editor${language === 'sansa' ? ' light-code' : ''}`;
  textarea.before(editor);
  const backdrop = document.createElement('pre');
  backdrop.className = 'highlight-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  const code = document.createElement('code');
  backdrop.append(code);
  const gutter = document.createElement('div');
  gutter.className = 'highlight-line-numbers';
  gutter.setAttribute('aria-hidden', 'true');
  editor.append(backdrop, gutter, textarea);
  textarea.wrap = 'off';
  const scroll = () => {
    backdrop.scrollTop = gutter.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  };
  const sync = () => {
    code.innerHTML = highlight(textarea.value, language) + '\n';
    const lines = document.createDocumentFragment();
    const count = textarea.value.split('\n').length;
    for (let index = 0; index < count; index++) {
      const line = document.createElement('span');
      line.textContent = index + 1;
      lines.append(line);
    }
    gutter.replaceChildren(lines);
    scroll();
  };
  textarea.addEventListener('input', sync);
  textarea.addEventListener('scroll', scroll);
  sync();
  return sync;
}

export function renderOutput(element, source) {
  // Only the escaped, lexer-backed renderer supplies HTML; query text is never
  // inserted directly as markup. textContent remains the exact Aeon output.
  element.innerHTML = highlight(source, 'aeon');
}
