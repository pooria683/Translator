import { DEFAULT_SETTINGS, type TranslationRequest, type TranslationResponse, type UserSettings } from '../shared/types';
import { OpenAICompatibleProvider } from '../providers/openai-compatible-provider';

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get('settings');
  if (!stored.settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
});

let providerQueue: Promise<void> = Promise.resolve();
let lastProviderRequest = 0;

function translateBatch(texts: string[]): Promise<TranslationResponse> {
  const task = providerQueue.then(async () => {
    const wait = Math.max(0, 350 - (Date.now() - lastProviderRequest));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastProviderRequest = Date.now();
    return translateBatchNow(texts);
  });
  providerQueue = task.then(() => undefined, () => undefined);
  return task;
}

async function translateBatchNow(texts: string[]): Promise<TranslationResponse> {
  if (!Array.isArray(texts) || texts.length > 20 || texts.some((t) => typeof t !== 'string' || t.length > 1200)) return { ok: false, error: 'درخواست ترجمه نامعتبر است.' };
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = (result.settings ?? DEFAULT_SETTINGS) as UserSettings;
    const provider = new OpenAICompatibleProvider(settings.provider);
    const translations = await provider.translateBatch(texts, settings.terminology ?? {});
    return { ok: true, translations };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'خطای ناشناخته در سرویس ترجمه.' };
  }
}

chrome.runtime.onMessage.addListener((message: TranslationRequest, _sender, sendResponse) => {
  if (message?.type !== 'FARSIFLOW_TRANSLATE_BATCH') return false;
  void translateBatch(message.texts).then(sendResponse);
  return true;
});
