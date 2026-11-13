import { cacheTranslation, getCached } from '../core/translation-cache';
import { shouldTranslateNode } from './exclusion-rules';
import { DEFAULT_SETTINGS, type TranslationResponse, type UserSettings } from '../shared/types';

export class TranslationManager {
  private original = new Map<Text, string>();
  private translated = new Map<Text, string>();
  private pending = new Set<Text>();
  private scanTasks: TreeWalker[] = [];
  private scanIndex = 0;
  private scanTimer = 0;
  private scanScheduled = false;
  private observer?: MutationObserver;
  private timer = 0;
  private running = false;
  private active = false;
  private onState: (active: boolean, busy: boolean, count: number, error?: string) => void;

  constructor(onState: (active: boolean, busy: boolean, count: number, error?: string) => void) { this.onState = onState; }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.collect(document.body);
    this.onState(true, false, this.original.size);
    this.observer = new MutationObserver((records) => {
      if (!this.active) return;
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof Element) this.collect(record.target);
        if (record.type === 'characterData') {
          const textNode = record.target as Text;
          const previousTranslation = this.translated.get(textNode);
          if (previousTranslation !== undefined) {
            if (textNode.nodeValue !== previousTranslation) {
              this.original.delete(textNode);
              this.translated.delete(textNode);
              this.pending.delete(textNode);
              if (shouldTranslateNode(textNode)) this.pending.add(textNode);
            }
          } else this.collect(textNode);
        }
        record.addedNodes.forEach((node) => { if (node instanceof Element || node instanceof DocumentFragment) this.collect(node); });
      }
      this.schedule();
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    this.schedule();
  }

  restore(): void {
    this.active = false;
    this.observer?.disconnect();
    window.clearTimeout(this.timer);
    window.clearTimeout(this.scanTimer);
    this.scanTasks = [];
    this.scanIndex = 0;
    this.pending.clear();
    for (const [node, text] of this.original) if (node.isConnected) node.nodeValue = text;
    this.original.clear();
    this.translated.clear();
    this.onState(false, false, 0);
  }

  private collect(root: Node | null): void {
    if (!root) return;
    if (root instanceof Text) {
      if (!this.original.has(root) && shouldTranslateNode(root)) this.pending.add(root);
      return;
    }
    this.scanTasks.push(document.createTreeWalker(root, NodeFilter.SHOW_TEXT));
    this.scheduleScan();
  }

  private scheduleScan(): void {
    if (!this.active || this.scanScheduled) return;
    this.scanScheduled = true;
    this.scanTimer = window.setTimeout(() => this.scanChunk(), 0);
  }

  private scanChunk(): void {
    this.scanScheduled = false;
    if (!this.active) return;
    const deadline = performance.now() + 6;
    let visited = 0;
    while (this.scanIndex < this.scanTasks.length && visited < 250 && performance.now() < deadline) {
      const walker = this.scanTasks[this.scanIndex];
      if (!walker) { this.scanIndex++; continue; }
      const node = walker.nextNode();
      if (!node) { this.scanIndex++; continue; }
      visited++;
      const text = node as Text;
      if (!this.original.has(text) && shouldTranslateNode(text)) this.pending.add(text);
    }
    if (this.scanIndex >= this.scanTasks.length) { this.scanTasks = []; this.scanIndex = 0; }
    else this.scheduleScan();
    this.schedule();
  }

  private schedule(): void {
    if (this.running || !this.active || !this.pending.size) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), 180);
  }

  private async flush(): Promise<void> {
    if (!this.active || this.running) return;
    this.running = true;
    this.onState(true, true, this.original.size);
    try {
      const stored = await chrome.storage.local.get('settings');
      const preferences = (stored.settings ?? DEFAULT_SETTINGS) as UserSettings;
      const profile = JSON.stringify({ endpoint: preferences.provider.endpoint, model: preferences.provider.model, quality: preferences.provider.quality, terminology: preferences.terminology });
      while (this.active && this.pending.size) {
        const batch = [...this.pending].filter((node) => node.isConnected).slice(0, 16);
        batch.forEach((node) => this.pending.delete(node));
        const uncached: Text[] = [];
        const values = new Map<Text, string>();
        const sources = new Map<Text, string>();
        for (const node of batch) {
          const source = node.nodeValue ?? '';
          sources.set(node, source);
          const cached = await getCached(source, profile);
          if (cached) values.set(node, cached); else uncached.push(node);
        }
        if (uncached.length) {
          const uncachedSources = uncached.map((node) => sources.get(node) ?? '');
          const reply = await chrome.runtime.sendMessage({ type: 'FARSIFLOW_TRANSLATE_BATCH', texts: uncachedSources }) as TranslationResponse;
          if (!reply?.ok || !reply.translations || reply.translations.length !== uncached.length) throw new Error(reply?.error || 'پاسخ ترجمه معتبر نبود.');
          for (let i = 0; i < uncached.length; i++) {
            const node = uncached[i];
            const output = reply.translations[i]?.trim();
            const source = node ? sources.get(node) : undefined;
            if (node && output && source !== undefined) { values.set(node, output); await cacheTranslation(source, output, profile); }
          }
        }
        for (const [node, translation] of values) {
          const source = sources.get(node);
          if (!this.active || !node.isConnected || source === undefined || node.nodeValue !== source || this.original.has(node)) continue;
          this.original.set(node, source);
          this.translated.set(node, translation);
          node.nodeValue = translation;
        }
        this.onState(true, this.pending.size > 0, this.original.size);
      }
    } catch (error) {
      this.onState(true, false, this.original.size, error instanceof Error ? error.message : 'خطا در ترجمه');
    } finally {
      this.running = false;
      if (this.active && this.pending.size) this.schedule();
    }
  }
}
