import { TranslationManager } from './translation-manager';
import { setPersianDirection } from './rtl-manager';
import { detectPageLanguage } from '../core/language-detector';
import { DEFAULT_SETTINGS, type PageMessage, type PageStatus, type UserSettings } from '../shared/types';

const allowed = location.hostname === 'coddy.tech' || location.hostname.endsWith('.coddy.tech');
let rtl = true;
let translatedNodes = 0;
let translatingActive = false;
let busy = false;
let error: string | undefined;
const originalLanguage = detectPageLanguage();
const manager = new TranslationManager((active, isBusy, count, issue) => {
  translatedNodes = count; translatingActive = active; busy = isBusy; error = issue; if (!active) error = undefined;
  void chrome.runtime.sendMessage({ type: 'FARSIFLOW_STATUS_UPDATE', status: status() }).catch(() => undefined);
});

function status(): PageStatus { return { supported: allowed, active: translatingActive, translating: busy, translatedNodes, originalLanguage, rtl, ...(error ? { error } : {}) }; }

if (allowed) {
  void chrome.storage.local.get('settings').then(({ settings }) => {
    const prefs = (settings ?? DEFAULT_SETTINGS) as UserSettings;
    rtl = prefs.rtl;
    if (prefs.autoTranslateCoddy) { manager.start(); setPersianDirection(rtl); }
  });
  chrome.runtime.onMessage.addListener((message: PageMessage, _sender, sendResponse) => {
    if (!allowed || !['FARSIFLOW_TRANSLATE', 'FARSIFLOW_RESTORE', 'FARSIFLOW_SET_RTL', 'FARSIFLOW_GET_STATUS'].includes(message?.type)) return false;
    if (message.type === 'FARSIFLOW_TRANSLATE') {
      error = undefined; rtl = message.rtl ?? true; setPersianDirection(rtl); manager.start(); sendResponse(status());
    } else if (message.type === 'FARSIFLOW_RESTORE') {
      manager.restore(); setPersianDirection(false); translatedNodes = 0; translatingActive = false; busy = false; error = undefined; sendResponse(status());
    } else if (message.type === 'FARSIFLOW_SET_RTL') {
      rtl = message.enabled; setPersianDirection(rtl); sendResponse(status());
    } else if (message.type === 'FARSIFLOW_GET_STATUS') sendResponse(status());
    return true;
  });
}
