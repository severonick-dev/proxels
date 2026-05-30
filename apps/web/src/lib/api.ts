/**
 * Тонкий fetch-обёртка для API.
 * - Базовый URL берёт из VITE_API_URL (или `/api` через Vite proxy в dev).
 * - Возвращает распарсенный JSON или бросает ApiError.
 * - Refresh-токен мы НЕ присылаем здесь руками — он живёт в httpOnly cookie с
 *   `path=/api/auth` и автоматически отправляется только на auth-эндпоинты,
 *   когда credentials=include (см. Этап 3).
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = (import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '') + '/api';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  };
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    signal: opts.signal,
    credentials: opts.credentials ?? 'include',
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  if (opts.accessToken) {
    headers.Authorization = `Bearer ${opts.accessToken}`;
  }

  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : null) ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
