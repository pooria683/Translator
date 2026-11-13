import { useEffect, useState } from 'react';
import { ArrowLeftRight, Check, ChevronLeft, Globe2, Languages, LoaderCircle, RotateCcw, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import { DEFAULT_SETTINGS, type PageStatus, type UserSettings } from '../shared/types';

type Tab = chrome.tabs.Tab;
const isCoddy = (url?: string) => { try { const host = new URL(url ?? '').hostname; return host === 'coddy.tech' || host.endsWith('.coddy.tech'); } catch { return false; } };

async function sendToPage(tabId: number, message: object): Promise<PageStatus> {
  try { return await chrome.tabs.sendMessage(tabId, message) as PageStatus; }
  catch {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['assets/content.js'] });
    return await chrome.tabs.sendMessage(tabId, message) as PageStatus;
  }
}

export function App() {
  const [tab, setTab] = useState<Tab>();
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [error, setError] = useState('');
  const [auto, setAuto] = useState(false);
  const [rtl, setRtl] = useState(true);
  const [configured, setConfigured] = useState(false);

  const refresh = async () => {
    const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTab(current);
    const valid = isCoddy(current?.url); setSupported(valid);
    const { settings } = await chrome.storage.local.get('settings');
    const prefs = (settings ?? DEFAULT_SETTINGS) as UserSettings;
    setAuto(prefs.autoTranslateCoddy); setRtl(prefs.rtl); setConfigured(Boolean(prefs.provider.apiKey));
    if (valid && current?.id) {
      try {
        const status = await sendToPage(current.id, { type: 'FARSIFLOW_GET_STATUS' });
        setActive(status.active); setBusy(status.translating); setCount(status.translatedNodes); setSourceLanguage(status.originalLanguage ?? 'en'); setError(status.error ?? '');
      } catch { /* Extension was just installed or page is still loading. */ }
    }
  };
  useEffect(() => {
    const listener = (message: { type?: string; status?: PageStatus }) => {
      if (message.type === 'FARSIFLOW_STATUS_UPDATE' && message.status) {
        const status = message.status;
        setActive(status.active); setBusy(status.translating); setCount(status.translatedNodes);
        setSourceLanguage(status.originalLanguage ?? 'en'); setError(status.error ?? '');
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    void refresh();
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const updateSettings = async (patch: Partial<UserSettings>) => {
    const { settings } = await chrome.storage.local.get('settings');
    const current = { ...DEFAULT_SETTINGS, ...(settings as Partial<UserSettings> | undefined) };
    await chrome.storage.local.set({ settings: { ...current, ...patch } });
  };

  const toggleTranslation = async () => {
    if (!tab?.id) return;
    setError('');
    try {
      if (active) {
        await sendToPage(tab.id, { type: 'FARSIFLOW_RESTORE' });
        setActive(false); setCount(0); setBusy(false);
      } else {
        if (!configured) { setError('ابتدا اتصال سرویس ترجمه را در تنظیمات کامل کنید.'); return; }
        setActive(true); setBusy(true);
        const result = await sendToPage(tab.id, { type: 'FARSIFLOW_TRANSLATE', rtl });
        setBusy(result.translating); setCount(result.translatedNodes);
      }
    } catch { setError('صفحه آماده نیست؛ صفحه Coddy را یک‌بار تازه‌سازی کنید.'); setActive(false); setBusy(false); }
  };

  const toggleAuto = async () => {
    const value = !auto;
    if (value && !configured) { setError('برای ترجمهٔ خودکار، ابتدا کلید API را در تنظیمات ثبت کنید.'); return; }
    setAuto(value); await updateSettings({ autoTranslateCoddy: value });
    if (value && configured && supported && tab?.id) {
      try { await sendToPage(tab.id, { type: 'FARSIFLOW_TRANSLATE', rtl }); setActive(true); setBusy(true); }
      catch { setError('برای اعمال ترجمه، صفحه را تازه‌سازی کنید.'); }
    }
  };
  const toggleRtl = async () => {
    const value = !rtl; setRtl(value); await updateSettings({ rtl: value });
    if (tab?.id && supported) try { await sendToPage(tab.id, { type: 'FARSIFLOW_SET_RTL', enabled: value }); } catch { /* Next page load uses saved preference. */ }
  };

  return <main className="popup-shell">
    <header className="brand-row"><div className="brand-icon"><Languages size={21}/></div><div className="brand-copy"><strong>FarsiFlow</strong><span>فارسی‌سازی هوشمند Coddy</span></div><span className="coddy-pill">CODDY ONLY</span></header>
    <section className="site-card"><div className="site-orb"><Globe2 size={19}/></div><div className="site-copy"><span>وب‌سایت فعلی</span><strong>{supported ? 'Coddy · محیط یادگیری کدنویسی' : (tab?.title?.slice(0, 34) || 'صفحه پشتیبانی‌نشده')}</strong></div><span className={`site-dot ${supported ? 'online' : ''}`}/></section>
    {!supported ? <div className="unsupported"><div className="unsupported-icon"><Globe2 size={20}/></div><strong>این صفحه پشتیبانی نمی‌شود</strong><p>FarsiFlow در حال حاضر فقط برای <b>coddy.tech</b> فعال است تا محیط آموزشی و کدهای تمرین دست‌نخورده بمانند.</p></div> : <>
      <div className="language-line"><div><span>زبان صفحه</span><b>تشخیص خودکار · {sourceLanguage}</b></div><ArrowLeftRight size={16}/><div><span>ترجمه به</span><b>فارسی · ایران</b></div></div>
      <button className={`translate-button ${active ? 'is-active' : ''}`} onClick={() => void toggleTranslation()} disabled={!supported || busy}>
        {busy ? <LoaderCircle className="spin" size={19}/> : active ? <RotateCcw size={19}/> : <Sparkles size={19}/>}
        <span>{busy ? 'در حال ترجمه…' : active ? 'بازگرداندن متن اصلی' : 'ترجمه این صفحه'}</span>
        {!busy && <ChevronLeft size={17} className="button-chevron"/>}
      </button>
      <div className="status-line"><span className={`status-dot ${active ? 'active' : ''}`}/>{error ? <span className="error-text">{error}</span> : <span>{active ? `${count ? `${count} بخش` : 'در حال آماده‌سازی'} · ترجمه فعال` : 'آماده برای ترجمه'}</span>}<ShieldCheck size={15} className="shield"/></div>
      <div className="settings-list">
        <button className="setting-row" onClick={() => void toggleRtl()}><span className="setting-icon"><Languages size={17}/></span><span className="setting-label"><b>چیدمان راست‌به‌چپ</b><small>برای متن فارسی، با حفظ کدها به چپ‌چین</small></span><span className={`switch ${rtl ? 'on' : ''}`}><i/></span></button>
        <button className="setting-row" onClick={() => void toggleAuto()}><span className="setting-icon"><Check size={17}/></span><span className="setting-label"><b>ترجمه خودکار Coddy</b><small>فقط پس از فعال‌سازی توسط شما</small></span><span className={`switch ${auto ? 'on' : ''}`}><i/></span></button>
      </div>
    </>}
    <footer className="popup-footer"><span>ترجمه فقط با اجازهٔ شما ارسال می‌شود</span><button onClick={() => void chrome.runtime.openOptionsPage()} aria-label="تنظیمات"><Settings2 size={18}/><span>تنظیمات</span></button></footer>
  </main>;
}
