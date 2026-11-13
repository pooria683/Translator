import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Check, KeyRound, Languages, LoaderCircle, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { DEFAULT_SETTINGS, type UserSettings } from '../shared/types';

const empty = (): UserSettings => structuredClone(DEFAULT_SETTINGS);
export function Options() {
  const [settings, setSettings] = useState<UserSettings>(empty());
  const [terms, setTerms] = useState('');
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const [cacheCount, setCacheCount] = useState<number>();

  useEffect(() => {
    void chrome.storage.local.get('settings').then(({ settings: raw }) => {
      const value = { ...empty(), ...(raw as Partial<UserSettings> | undefined), provider: { ...DEFAULT_SETTINGS.provider, ...((raw as UserSettings | undefined)?.provider ?? {}) } };
      setSettings(value);
      setTerms(Object.entries(value.terminology).map(([a,b]) => `${a} = ${b}`).join('\n'));
      setBusy(false);
    });
    void getCacheCount().then(setCacheCount);
  }, []);

  const changeProvider = (key: keyof UserSettings['provider'], value: string) => setSettings((s) => ({ ...s, provider: { ...s.provider, [key]: value } }));
  const save = async (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    try {
      const endpoint = new URL(settings.provider.endpoint);
      if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('نشانی API نباید اطلاعات ورود، query یا fragment داشته باشد.');
      if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost','127.0.0.1'].includes(endpoint.hostname))) throw new Error('آدرس باید امن باشد (HTTPS)، یا به سرویس محلی اشاره کند.');
      const permissions = await chrome.permissions.request({ origins: [`${endpoint.origin}/*`] });
      if (!permissions) throw new Error('اجازهٔ اتصال به میزبان سرویس داده نشد.');
      const glossary: Record<string,string> = {};
      for (const line of terms.split('\n')) {
        const index = line.indexOf('='); if (index < 1) continue;
        const from = line.slice(0,index).trim(), to = line.slice(index + 1).trim(); if (from && to) glossary[from] = to;
      }
      const updated = { ...settings, terminology: glossary };
      await chrome.storage.local.set({ settings: updated }); setSettings(updated); setSaved(true); setMessage('تنظیمات با موفقیت ذخیره شد.');
      window.setTimeout(() => setSaved(false), 2200);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ذخیره تنظیمات انجام نشد.'); }
  };

  const clearCache = async () => { await clearTranslationCache(); setCacheCount(0); setMessage('حافظهٔ ترجمه پاک شد.'); };

  if (busy) return <div className="options-loading"><LoaderCircle className="spin"/> در حال بارگذاری…</div>;
  return <main className="options-page" dir="rtl">
    <header className="options-header"><div className="options-brand"><a className="back-link" href="popup.html" title="بازگشت"><ArrowRight size={18}/></a><span className="brand-icon"><Languages size={21}/></span><div><b>FarsiFlow</b><small>تنظیمات ترجمهٔ Coddy</small></div></div><div className="only-badge">ویژهٔ coddy.tech</div></header>
    <div className="options-layout"><aside className="options-aside"><span className="aside-caption">تنظیمات</span><a className="aside-link selected" href="#provider"><KeyRound size={16}/> سرویس ترجمه</a><a className="aside-link" href="#preferences"><Languages size={16}/> تجربهٔ ترجمه</a><a className="aside-link" href="#privacy"><ShieldCheck size={16}/> حریم خصوصی</a><div className="aside-note"><ShieldCheck size={17}/><span>کدها، ورودی‌ها و اطلاعات فرم هرگز برای ترجمه ارسال نمی‌شوند.</span></div></aside>
    <section className="settings-content"><div className="page-heading"><span className="eyebrow">پیکربندی شخصی</span><h1>تنظیمات FarsiFlow</h1><p>سرویس ترجمهٔ دلخواه خود را وصل کنید و تجربهٔ فارسی Coddy را تنظیم کنید.</p></div>
      <form onSubmit={(event) => void save(event)}>
        <section className="settings-card" id="provider"><div className="card-heading"><div className="card-icon purple"><KeyRound size={18}/></div><div><h2>سرویس ترجمهٔ هوش مصنوعی</h2><p>سازگار با APIهای OpenAI؛ کلید فقط در فضای محلی افزونه ذخیره می‌شود.</p></div><span className="secure-tag"><ShieldCheck size={13}/> ذخیرهٔ محلی در Chrome</span></div>
          <div className="form-grid"><label className="field full"><span>نشانی پایهٔ API</span><input value={settings.provider.endpoint} onChange={(e) => changeProvider('endpoint', e.target.value)} placeholder="https://api.openai.com/v1" dir="ltr" required/><small>برای سازگاری OpenAI باید مسیر /v1 باشد؛ برای سرویس محلی نیز می‌توانید localhost وارد کنید.</small></label>
          <label className="field"><span>نام مدل</span><input value={settings.provider.model} onChange={(e) => changeProvider('model', e.target.value)} placeholder="gpt-4o-mini" dir="ltr" required/></label>
          <label className="field"><span>کیفیت ترجمه</span><select value={settings.provider.quality} onChange={(e) => changeProvider('quality', e.target.value)}><option value="balanced">متعادل و سریع</option><option value="high">کیفیت بالاتر</option></select></label>
          <label className="field full"><span>کلید API</span><input type="password" autoComplete="new-password" value={settings.provider.apiKey} onChange={(e) => changeProvider('apiKey', e.target.value)} placeholder="کلید سرویس شما" dir="ltr"/><small>کلید هرگز به وب‌سایت Coddy یا اسکریپت صفحه داده نمی‌شود؛ فقط سرویس انتخابی شما آن را دریافت می‌کند.</small></label></div>
        </section>
        <section className="settings-card" id="preferences"><div className="card-heading"><div className="card-icon blue"><Languages size={18}/></div><div><h2>زبان و اصطلاحات</h2><p>واژه‌های فنی پرکاربرد را به شکل دلخواه یکسان‌سازی کنید.</p></div></div>
          <div className="form-grid"><label className="field"><span>زبان مقصد</span><input value="فارسی (ایران)" disabled/></label><label className="field"><span>سایت‌های فعال</span><input value="coddy.tech و زیردامنه‌ها" disabled/></label><label className="field full"><span>واژه‌نامهٔ سفارشی</span><textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={5} placeholder={'for loop = حلقهٔ for\nvariable = متغیر'} dir="auto"/><small>هر سطر به شکل «واژهٔ اصلی = معادل فارسی»؛ از ارسال کد و اطلاعات شخصی خودداری کنید.</small></label></div>
        </section>
        <section className="settings-card" id="privacy"><div className="card-heading"><div className="card-icon green"><ShieldCheck size={18}/></div><div><h2>حریم خصوصی و حافظه</h2><p>هیچ تاریخچهٔ وب‌گردی یا ورودی فرم ذخیره نمی‌شود.</p></div></div>
          <div className="privacy-row"><div><b>حافظهٔ ترجمهٔ محلی</b><span>{cacheCount === undefined ? 'در حال شمارش…' : `${cacheCount} عبارت ذخیره‌شده روی همین دستگاه`}</span></div><button type="button" className="outline-button" onClick={() => void clearCache()}><Trash2 size={15}/> پاک‌کردن حافظه</button></div>
          <div className="privacy-info"><Check size={15}/> درخواست ترجمه فقط پس از انتخاب شما انجام می‌شود؛ ترجمهٔ خودکار به‌صورت پیش‌فرض خاموش است.</div>
        </section>
        <div className="save-row"><span className={message.includes('موفقیت') || message.includes('پاک شد') ? 'success-text' : 'form-message'}>{message}</span><button className="save-button" type="submit">{saved ? <Check size={17}/> : <Save size={17}/>} {saved ? 'ذخیره شد' : 'ذخیرهٔ تنظیمات'}</button></div>
      </form>
      <footer className="options-footer">FarsiFlow برای Coddy <span>·</span> طراحی‌شده با تمرکز بر ایمنی کد و حریم خصوصی</footer>
    </section></div>
  </main>;
}

async function openDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const req = indexedDB.open('farsiflow-cache', 1); req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('translations')) req.result.createObjectStore('translations', { keyPath: 'key' }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
async function getCacheCount(): Promise<number> { try { const db = await openDb(); return await new Promise((resolve) => { const req = db.transaction('translations','readonly').objectStore('translations').count(); req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(0); }); } catch { return 0; } }
async function clearTranslationCache(): Promise<void> { try { const db = await openDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction('translations','readwrite'); tx.objectStore('translations').clear(); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); } catch { /* Nothing cached yet. */ } }
