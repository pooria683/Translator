const DB_NAME = 'farsiflow-cache';
const STORE = 'translations';
const VERSION = 1;
let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  dbPromise.catch(() => { dbPromise = undefined; });
  return dbPromise;
}

function profileKey(profile: string): string {
  let hash = 2166136261;
  for (let i = 0; i < profile.length; i++) hash = Math.imul(hash ^ profile.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
const makeKey = (text: string, profile: string) => `fa:${profileKey(profile)}:${text.trim()}`;

export async function getCached(text: string, profile = 'default'): Promise<string | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(makeKey(text, profile));
      request.onsuccess = () => resolve(request.result?.translation as string | undefined);
      request.onerror = () => reject(request.error);
    });
  } catch { return undefined; }
}

export async function cacheTranslation(text: string, translation: string, profile = 'default'): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key: makeKey(text, profile), translation, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Caching is an optimization; translation still succeeds. */ }
}
