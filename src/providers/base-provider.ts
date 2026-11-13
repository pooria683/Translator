export interface ProviderInfo {
  id: string;
  name: string;
  endpoint: string;
}

export interface TranslationProvider {
  translate(text: string, terminology?: Record<string, string>): Promise<string>;
  translateBatch(texts: string[], terminology?: Record<string, string>): Promise<string[]>;
  detectLanguage(text: string): Promise<string>;
  getProviderInfo(): ProviderInfo;
}
