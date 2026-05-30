import { useAuthStore, type AuthUser } from '@/stores/auth-store';

/**
 * API-клиент с авто-refresh на 401.
 *
 * Принципы:
 *  - Базовый URL: `${VITE_API_URL || ''}/api`. В dev — пустой prefix + Vite proxy.
 *  - Access-токен берётся из Zustand-стора (auth-store), не из localStorage
 *    (см. §4b CLAUDE.md — не хранить критичные токены в localStorage).
 *  - Refresh-токен живёт в httpOnly cookie c `path=/api/auth` и автоматически
 *    отправляется на /api/auth/refresh при credentials:'include'.
 *  - На 401 (кроме самих /auth/* эндпоинтов) один раз пробуем /auth/refresh,
 *    при успехе — обновляем стор и перевыполняем оригинальный запрос. Иначе clear().
 *  - Параллельные 401-запросы делят один in-flight refresh, чтобы не толкаться.
 */

const BASE = (import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '') + '/api';

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

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** true (по умолчанию) — добавит Bearer из auth-store и попробует auto-refresh на 401. */
  auth?: boolean;
  /** true — публичный запрос без cookie. По умолчанию credentials:'include'. */
  skipCredentials?: boolean;
}

interface RefreshResponse {
  accessToken: string;
  user: AuthUser;
}

let refreshInFlight: Promise<RefreshResponse | null> | null = null;

async function rawRequest<T>(
  path: string,
  opts: ApiRequestOptions,
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    signal: opts.signal,
    credentials: opts.skipCredentials ? 'omit' : 'include',
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

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

export async function apiRequest<T = unknown>(
  path: string,
  opts: ApiRequestOptions = {},
): Promise<T> {
  const wantAuth = opts.auth !== false;
  const accessToken = wantAuth ? (useAuthStore.getState().accessToken ?? undefined) : undefined;

  try {
    return await rawRequest<T>(path, opts, accessToken);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || !wantAuth) throw err;
    if (path.startsWith('/auth/refresh') || path.startsWith('/auth/login')) throw err;

    const refreshed = await getRefreshed();
    if (!refreshed) {
      useAuthStore.getState().clear();
      throw err;
    }
    useAuthStore.getState().setAuth(refreshed.accessToken, refreshed.user);
    return rawRequest<T>(path, opts, refreshed.accessToken);
  }
}

async function getRefreshed(): Promise<RefreshResponse | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      return await rawRequest<RefreshResponse>('/auth/refresh', { method: 'POST' });
    } catch {
      return null;
    } finally {
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Попытка восстановить сессию при старте приложения. */
export async function tryBootstrapAuth(): Promise<void> {
  const store = useAuthStore.getState();
  store.setStatus('loading');
  const refreshed = await getRefreshed();
  if (refreshed) {
    store.setAuth(refreshed.accessToken, refreshed.user);
  } else {
    store.clear();
  }
}
