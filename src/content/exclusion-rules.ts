const BLOCKED_TAGS = new Set([
  'PRE', 'CODE', 'TEXTAREA', 'INPUT', 'SCRIPT', 'STYLE', 'SVG', 'CANVAS', 'NOSCRIPT', 'IFRAME', 'KBD', 'SAMP', 'VAR'
]);
const CODE_HINTS = /(?:^|[-_\s])(code|editor|terminal|console|monaco|ace|cm-|codemirror|xterm|output|stdin|stdout|playground|repl|source|syntax)(?:$|[-_\s])/i;
const IDENTIFIER = /^(?:[a-z]+[A-Z][A-Za-z0-9]*|[A-Za-z_$][\w$]*\d[\w$]*|[A-Z][A-Z0-9_]{1,}|[a-z]+(?:_[a-z0-9]+)+)$/;
const URL_OR_PATH = /^(?:https?:\/\/|\/|[A-Za-z]:\\)[^\s]+$|^[\w.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i;
const CODE_SYNTAX = /[{};]|=>|<\/?[A-Za-z][^>]*>|^(?:const|let|var|function|return|import|export|class|def|print|SELECT)\b/i;
const SENSITIVE_TEXT = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(?:\b(?:sk-[A-Za-z0-9_-]{12,}|AKIA[A-Z0-9]{12,})\b)|(?:\+?\d[\d\s().-]{6,}\d)/i;

export function isUnsafeText(value: string): boolean {
  const trimmed = value.trim();
  return IDENTIFIER.test(trimmed) || URL_OR_PATH.test(trimmed) || CODE_SYNTAX.test(trimmed) || SENSITIVE_TEXT.test(trimmed)
    || /^(?:npm|pnpm|yarn|pip|git|python|node|curl|sudo|docker)\s/i.test(trimmed);
}

export function shouldTranslateNode(node: Text): boolean {
  const value = node.nodeValue ?? '';
  if (!value.trim() || value.trim().length < 2 || value.length > 1200) return false;
  if (!/[A-Za-z\u00C0-\u024F]/.test(value)) return false;
  const parent = node.parentElement;
  if (!parent || !parent.isConnected) return false;
  if (BLOCKED_TAGS.has(parent.tagName) || parent.closest('pre,code,textarea,input,script,style,svg,canvas,noscript,iframe,[contenteditable="true"],[role="textbox"],[data-language],.monaco-editor,.CodeMirror,.cm-editor,.xterm')) return false;
  let element: Element | null = parent;
  while (element) {
    if (CODE_HINTS.test(`${element.id} ${element.className?.toString?.() ?? ''}`)) return false;
    element = element.parentElement;
  }
  return !isUnsafeText(value);
}
