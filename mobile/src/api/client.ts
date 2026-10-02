import { fetch } from 'expo/fetch';

import { env } from '@/config/env';
import type { ApiEnvelope, ApiErrorBody } from '@/types/api';

const REQUEST_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  json?: unknown;
  body?: FormData;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Raw request. Throws ApiError on non-2xx; caller decides how to read the body. */
export async function request(path: string, { method = 'GET', json, body, signal, timeoutMs = REQUEST_TIMEOUT_MS }: RequestOptions = {}) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  // Combine caller cancellation with a timeout (AbortSignal.any is not available on Hermes).
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort);

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : body,
      signal: controller.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (__DEV__) console.warn(`fetch ${method} ${path} failed:`, err);
    throw new ApiError(
      timedOut ? 'Request timed out. Check your connection.' : 'Cannot reach server. Check your connection.',
      0,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  if (!response.ok) {
    let parsed: Partial<ApiErrorBody> = {};
    try {
      parsed = await response.json();
    } catch {
      // non-JSON error body
    }
    if (response.status === 401 && authToken) onUnauthorized?.();
    throw new ApiError(parsed.message || `Request failed (${response.status})`, response.status, parsed.detail);
  }

  return response;
}

/** JSON request that unwraps the backend's ApiResponse envelope. */
export async function api<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await request(path, options);
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data as T;
}

export function errorMessage(err: unknown): string {
  // 422 message is a generic "Validation error"; detail carries the backend's field rules.
  if (err instanceof ApiError) return err.status === 422 && err.detail ? err.detail : err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
