import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from './openai-compatible-provider';
import type { ProviderSettings } from '../shared/types';

const settings: ProviderSettings = { provider: 'openai-compatible', endpoint: 'https://example.test/v1', apiKey: 'test-key', model: 'test-model', quality: 'balanced' };
const response = (translations: string[]) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translations }) } }] }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('OpenAI-compatible provider', () => {
  it('sends a batch to the configured endpoint and validates the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(['سلام', 'ادامه']));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAICompatibleProvider(settings);
    await expect(provider.translateBatch(['Hello', 'Continue'])).resolves.toEqual(['سلام', 'ادامه']);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/chat/completions');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer test-key' });
  });

  it('rejects insecure remote endpoints before making a request', async () => {
    const provider = new OpenAICompatibleProvider({ ...settings, endpoint: 'http://example.test/v1' });
    await expect(provider.translateBatch(['Hello'])).rejects.toThrow('HTTPS');
  });

  it('rejects malformed or mismatched provider output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(['one'])));
    const provider = new OpenAICompatibleProvider(settings);
    await expect(provider.translateBatch(['one', 'two'])).rejects.toThrow('نامعتبر');
  });

  it('detects common source scripts locally and reports provider metadata', async () => {
    const provider = new OpenAICompatibleProvider(settings);
    await expect(provider.detectLanguage('مرحبا')).resolves.toBe('fa');
    expect(provider.getProviderInfo()).toMatchObject({ id: 'openai-compatible', endpoint: settings.endpoint });
  });
});
