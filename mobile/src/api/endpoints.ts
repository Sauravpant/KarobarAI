import { File, Paths } from 'expo-file-system';

import { api, request } from '@/api/client';
import type {
  CreateShopPayload,
  Customer,
  DailyBrief,
  DashboardDetail,
  ExtractResult,
  LoginResponse,
  RegisterPayload,
  Shop,
  User,
  VoiceConfirmRequest,
} from '@/types/api';

export const authApi = {
  login: (email: string, password: string) =>
    api<LoginResponse>('/auth/login', { method: 'POST', json: { email, password } }),
  register: (payload: RegisterPayload) => api<User>('/auth/register', { method: 'POST', json: payload }),
};

export const shopsApi = {
  list: () => api<Shop[]>('/shops/'),
  create: (payload: CreateShopPayload) => api<Shop>('/shops/', { method: 'POST', json: payload }),
};

export const customersApi = {
  list: (shopId: string) => api<Customer[]>(`/shops/${shopId}/customers/`),
};

// First brief of a day runs forecasts + LLM server-side (~20s); worst case walks the whole LLM fallback chain.
const BRIEF_TIMEOUT_MS = 120_000;

/** Writes an audio/mpeg response to a cache file the player can open. */
async function saveAudio(response: Awaited<ReturnType<typeof request>>, prefix: string) {
  const file = new File(Paths.cache, `${prefix}-${Date.now()}.mp3`);
  file.write(new Uint8Array(await response.arrayBuffer()));
  return file.uri;
}

export const dashboardApi = {
  get: (shopId: string) => api<DashboardDetail>(`/shops/${shopId}/dashboard`),

  /** Generated once per shop+date server-side, then served from the DB. */
  brief: (shopId: string, date: string, signal?: AbortSignal) =>
    api<DailyBrief>(`/shops/${shopId}/dashboard/brief?brief_date=${date}`, { signal, timeoutMs: BRIEF_TIMEOUT_MS }),

  /** Server re-synthesizes the saved transcript on every call (Sarvam → Edge-TTS → gTTS). */
  briefAudio: async (shopId: string, date: string, signal?: AbortSignal) => {
    const response = await request(`/shops/${shopId}/dashboard/brief/audio?brief_date=${date}`, {
      signal,
      timeoutMs: BRIEF_TIMEOUT_MS,
    });
    return saveAudio(response, 'daily-brief');
  },
};

export interface VoiceConfirmation {
  text: string;
  processedCount: number;
  audioUri: string;
}

export const voiceApi = {
  /** One multipart request per recording, field `audio` — same contract as web. */
  transcribe: async (shopId: string, recordingUri: string, signal?: AbortSignal) => {
    const form = new FormData();
    form.append('audio', new File(recordingUri));
    const data = await api<{ text: string }>(`/shops/${shopId}/voice/transcribe`, {
      method: 'POST',
      body: form,
      signal,
    });
    return data.text;
  },

  extract: (shopId: string, text: string, signal?: AbortSignal) =>
    api<ExtractResult>(`/shops/${shopId}/voice/extract-transactions`, {
      method: 'POST',
      json: { text },
      signal,
    }),

  /** Saves transactions and returns the spoken confirmation (audio/mpeg) as a local file. */
  confirmWithAudio: async (shopId: string, payload: VoiceConfirmRequest): Promise<VoiceConfirmation> => {
    const response = await request(`/shops/${shopId}/voice/confirm-with-audio`, {
      method: 'POST',
      json: payload,
    });
    return {
      text: decodeURIComponent(response.headers.get('X-Confirmation-Text') ?? ''),
      processedCount: Number(response.headers.get('X-Processed-Count') ?? 0),
      audioUri: await saveAudio(response, 'voice-confirmation'),
    };
  },
};
