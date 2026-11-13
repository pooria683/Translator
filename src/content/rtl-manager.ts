const KEEP_LTR = 'pre,code,kbd,samp,var,textarea,input,button,[contenteditable="true"],[role="textbox"],.monaco-editor,.CodeMirror,.cm-editor,.xterm,[dir="ltr"]';
const INLINE_CHILDREN = new Set(['A', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'MARK', 'SUB', 'SUP', 'BR']);
let rootWasSet = false;
let originalLang: string | null = null;
let bodyHadClass = false;
let directionObserver: MutationObserver | undefined;
const adjustedElements = new Map<HTMLElement, string | null>();

function isSafeTextContainer(element: HTMLElement): boolean {
  if (!element.matches('div,span,p,h1,h2,h3,h4,h5,h6,li,label,a,button')) return false;
  if ([...element.children].some((child) => !INLINE_CHILDREN.has(child.tagName))) return false;
  return !/(?:flex|grid|table)/.test(getComputedStyle(element).display);
}

function applyToSubtree(root: ParentNode): void {
  const elements: HTMLElement[] = [];
  if (root instanceof HTMLElement) elements.push(root);
  elements.push(...root.querySelectorAll<HTMLElement>('div,span,p,h1,h2,h3,h4,h5,h6,li,label,a,button'));
  for (const element of elements) {
    if (!element.hasAttribute('dir') && !element.closest(KEEP_LTR) && isSafeTextContainer(element)) {
      adjustedElements.set(element, null);
      element.setAttribute('dir', 'auto');
    }
  }
}

function forgetRemovedSubtree(root: Node): void {
  const elements: HTMLElement[] = [];
  if (root instanceof HTMLElement) elements.push(root);
  if (root instanceof Element) elements.push(...root.querySelectorAll<HTMLElement>('[dir="auto"]'));
  for (const element of elements) {
    if (!adjustedElements.has(element)) continue;
    const original = adjustedElements.get(element) ?? null;
    if (element.getAttribute('dir') === 'auto') {
      if (original === null) element.removeAttribute('dir'); else element.setAttribute('dir', original);
    }
    adjustedElements.delete(element);
  }
}

export function setPersianDirection(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) {
    if (!rootWasSet) {
      originalLang = root.getAttribute('lang');
      bodyHadClass = document.body?.classList.contains('farsiflow-rtl') ?? false;
      rootWasSet = true;
    }
    root.setAttribute('lang', 'fa');
    document.body?.classList.add('farsiflow-rtl');
    if (document.body) applyToSubtree(document.body);
    if (!directionObserver && document.body) {
      directionObserver = new MutationObserver((records) => {
        for (const record of records) {
          record.removedNodes.forEach(forgetRemovedSubtree);
          record.addedNodes.forEach((node) => { if (node instanceof Element) applyToSubtree(node); });
        }
      });
      directionObserver.observe(document.body, { childList: true, subtree: true });
    }
  } else if (rootWasSet) {
    directionObserver?.disconnect();
    directionObserver = undefined;
    if (root.getAttribute('lang') === 'fa') {
      if (originalLang === null) root.removeAttribute('lang'); else root.setAttribute('lang', originalLang);
    }
    if (!bodyHadClass) document.body?.classList.remove('farsiflow-rtl');
    for (const [element, original] of adjustedElements) {
      if (element.getAttribute('dir') === 'auto') {
        if (original === null) element.removeAttribute('dir'); else element.setAttribute('dir', original);
      }
    }
    adjustedElements.clear();
    rootWasSet = false;
  }
}
