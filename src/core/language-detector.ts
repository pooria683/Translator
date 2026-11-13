export function detectPageLanguage(): string {
  const declared = document.documentElement.lang?.trim();
  if (declared) return declared;
  const sample = document.body?.innerText.slice(0, 1500) ?? '';
  if (/[\u0400-\u04FF]/.test(sample)) return 'ru';
  if (/[\u0600-\u06FF]/.test(sample)) return 'fa/ar';
  return 'en';
}
