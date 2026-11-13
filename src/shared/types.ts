export interface ProviderSettings {
  provider: 'openai-compatible';
  endpoint: string;
  apiKey: string;
  model: string;
  quality: 'balanced' | 'high';
}

export interface UserSettings {
  provider: ProviderSettings;
  autoTranslateCoddy: boolean;
  rtl: boolean;
  terminology: Record<string, string>;
}

export type PageMessage =
  | { type: 'FARSIFLOW_TRANSLATE'; rtl?: boolean }
  | { type: 'FARSIFLOW_RESTORE' }
  | { type: 'FARSIFLOW_GET_STATUS' }
  | { type: 'FARSIFLOW_SET_RTL'; enabled: boolean };

export interface PageStatus {
  supported: boolean;
  active: boolean;
  translating: boolean;
  translatedNodes: number;
  originalLanguage?: string;
  rtl: boolean;
  error?: string;
}

export interface TranslationRequest {
  type: 'FARSIFLOW_TRANSLATE_BATCH';
  texts: string[];
}

export interface TranslationResponse {
  ok: boolean;
  translations?: string[];
  error?: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  provider: {
    provider: 'openai-compatible', endpoint: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', quality: 'balanced'
  },
  autoTranslateCoddy: false,
  rtl: true,
  terminology: {}
};
