import { describe, expect, it } from 'vitest';
import { isUnsafeText } from './exclusion-rules';

describe('programming-aware text filter', () => {
  it('keeps short natural-language labels eligible for translation', () => {
    expect(isUnsafeText('Continue')).toBe(false);
    expect(isUnsafeText('Start lesson')).toBe(false);
    expect(isUnsafeText('What does this code do?')).toBe(false);
  });

  it('rejects identifiers, commands, URLs, and source-like strings', () => {
    for (const sample of ['myVariable', 'user_name', 'HTTP_STATUS', 'https://example.com/a', 'npm install vite', 'const x = 1;', '<div>']) {
      expect(isUnsafeText(sample), sample).toBe(true);
    }
  });

  it('rejects common credentials and personal email strings', () => {
    expect(isUnsafeText('Contact user@example.com')).toBe(true);
    expect(isUnsafeText('sk-abcdefghijklmnop123456')).toBe(true);
  });
});
