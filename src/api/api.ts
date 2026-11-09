import { ApiResponse, ResponseStatus } from './types';

export class ApiError extends Error {
  public status: number;
  public data: unknown;
  public isTokenExpired: boolean;
  public isReconnectRequired: boolean;
  public platform?: string;

  constructor(
    message: string, 
    status: number, 
    data?: unknown, 
    isTokenExpired = false,
    isReconnectRequired = false,
    platform?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isTokenExpired = isTokenExpired;
    this.isReconnectRequired = isReconnectRequired;
    this.platform = platform;
  }
}

// Event emitter for reconnect required events
type ReconnectEventHandler = (platform: string) => void;
const reconnectHandlers: ReconnectEventHandler[] = [];

export function onReconnectRequired(handler: ReconnectEventHandler): () => void {
  reconnectHandlers.push(handler);
  return () => {
    const index = reconnectHandlers.indexOf(handler);
    if (index > -1) reconnectHandlers.splice(index, 1);
  };
}

function emitReconnectRequired(platform: string): void {
  reconnectHandlers.forEach(handler => handler(platform));
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Check if user was previously authenticated (has access token)
function wasAuthenticated(): boolean {
  return !!localStorage.getItem('accessToken');
}

// ── Token refresh infrastructure ────────────────────────────────────────────

/** Module-level lock: only one refresh HTTP call in flight at a time. */
let refreshPromise: Promise<string> | null = null;

/** Handle for the optional silent-refresh pre-expiry timer. */
let silentRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Clear all auth state and hard-redirect to the landing page.
 * Called when a refresh attempt fails — the user must log in again.
 */
function clearAuthAndRedirect(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('userName');
  localStorage.removeItem('email');
  localStorage.removeItem('requiresOnboarding');
  window.location.href = '/';
}

/**
 * Schedule a pre-emptive (silent) token refresh ~1 minute before the current
 * access token expires.  This prevents the first API call after a long idle
 * period from ever seeing a 401 — the token is renewed while the user is
 * still actively browsing.
 *
 * Export so `UserContext` can call it right after login / on mount.
 */
export function scheduleTokenRefresh(accessToken: string): void {
  if (silentRefreshTimer) {
    clearTimeout(silentRefreshTimer);
    silentRefreshTimer = null;
  }
  try {
    // JWT payload is the second base64url-encoded segment
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const expiresInMs = payload.exp * 1000 - Date.now();
    const fireInMs = expiresInMs - 60_000; // 1 minute early

    if (fireInMs > 0) {
      silentRefreshTimer = setTimeout(async () => {
        console.debug('[api] Silent pre-expiry refresh triggered');
        try {
          await doRefreshAccessToken();
        } catch {
          // Silent refresh failed — 401 interception will handle it on the next real call
          console.warn('[api] Silent refresh failed; fallback to 401 interception');
        }
      }, fireInMs);
    }
  } catch {
    // Token not decodable (e.g. opaque) — skip silent refresh
  }
}

/**
 * Core refresh implementation: POST /auth/refresh with the HttpOnly cookie,
 * persist the new access token, and schedule the next silent refresh.
 * Do NOT call this directly — go through `refreshAccessToken()` so the lock is respected.
 */
async function doRefreshAccessToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // HttpOnly refresh token cookie must be sent
  });

  if (!response.ok) {
    throw new ApiError('Token refresh failed', response.status, null, true);
  }

  const apiResponse: ApiResponse<{ accessToken: string }> = await response.json();

  if (apiResponse.status !== ResponseStatus.SUCCESS || !apiResponse.data?.accessToken) {
    throw new ApiError('Invalid refresh response', response.status, null, true);
  }

  const { accessToken } = apiResponse.data;
  localStorage.setItem('accessToken', accessToken);
  scheduleTokenRefresh(accessToken); // arm silent refresh for the new token
  return accessToken;
}

/**
 * Locked refresh accessor.
 * If a refresh is already underway every concurrent caller waits for the
 * same promise instead of issuing duplicate /auth/refresh requests.
 */
async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise; // coalesce — all callers share the single in-flight refresh
  }
  refreshPromise = doRefreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// Generic fetch wrapper with automatic JWT refresh and standardized error handling
// Handles four response statuses from backend:
// 1. SUCCESS: Returns data directly
// 2. ERROR: Throws ApiError with backend error message
// 3. TOKEN_EXPIRED / 401: Refreshes token via locked refreshAccessToken(), retries once
// 4. RECONNECT_REQUIRED: Social media token expired, user needs to reconnect
/**
 * Adopt an access token the server just issued: store it and re-arm the silent refresh for it.
 *
 * The refresh path does exactly this; anything else that receives a new token (role switch) must too,
 * or the client keeps sending the old one.
 */
export function adoptAccessToken(accessToken: string): void {
  localStorage.setItem('accessToken', accessToken);
  scheduleTokenRefresh(accessToken);
}

export async function fetchApi<T>(
  endpoint: string, 
  options: RequestInit = {}, 
  retryOnAuth = true
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    defaultHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const config: RequestInit = {
    ...options,
    credentials: 'include', // Always include cookies for refresh token
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  console.debug('[api] Request ->', { url, method: config.method || 'GET' });

  try {
    const response = await fetch(url, config);
    const apiResponse: ApiResponse<T> = await response.json().catch(() => null);

    console.debug('[api] Response <-', { 
      url, 
      status: response.status, 
      ok: response.ok, 
      responseStatus: apiResponse?.status 
    });

    // Handle RECONNECT_REQUIRED status - social media token expired
    if (apiResponse?.status === ResponseStatus.RECONNECT_REQUIRED) {
      console.warn('[api] Reconnect required for platform');
      // Determine platform from endpoint
      const platform = endpoint.includes('youtube') ? 'youtube' : 
                       endpoint.includes('instagram') ? 'instagram' : 'unknown';
      emitReconnectRequired(platform);
      throw new ApiError(
        apiResponse.message || 'Platform reconnection required',
        401,
        apiResponse,
        false,
        true,
        platform
      );
    }

    // ── Token refresh + auto-retry ───────────────────────────────────────────
    // Triggered by either:
    //   • A TOKEN_EXPIRED body status returned by the backend (explicit)
    //   • A raw HTTP 401 from the JwtAuthenticationFilter (implicit, e.g. after a page refresh)
    // In both cases we attempt a single refresh then replay the original request.
    // The refreshAccessToken() lock ensures only one HTTP /refresh call is ever in
    // flight even when multiple requests fail simultaneously.
    // Note: RECONNECT_REQUIRED is already handled above (throws), so we don't check it here
    const shouldAttemptRefresh =
      retryOnAuth &&
      wasAuthenticated() &&
      apiResponse?.status !== ResponseStatus.ERROR &&
      (apiResponse?.status === ResponseStatus.TOKEN_EXPIRED || response.status === 401);

    if (shouldAttemptRefresh) {
      console.warn('[api] Access token expired — attempting refresh...');
      try {
        const newToken = await refreshAccessToken();
        const retryHeaders = {
          ...defaultHeaders,
          'Authorization': `Bearer ${newToken}`,
          ...options.headers,
        };
        return fetchApi<T>(endpoint, { ...options, headers: retryHeaders }, false);
      } catch (refreshError) {
        console.error('[api] Refresh failed — session ended:', refreshError);
        clearAuthAndRedirect();
        throw new ApiError('Session expired. Please log in again.', 401, null, true);
      }
    }

    // Handle ERROR status from backend
    if (apiResponse?.status === ResponseStatus.ERROR) {
      console.error('[api] Backend error ->', apiResponse.error, apiResponse.message);
      throw new ApiError(
        apiResponse.message || 'An error occurred',
        response.status,
        apiResponse,
        false
      );
    }

    // Handle non-OK HTTP status without proper error response
    if (!response.ok) {
      console.error('[api] HTTP error ->', response.status, response.statusText);
      throw new ApiError(
        apiResponse?.message || `Request failed with status ${response.status}`,
        response.status,
        apiResponse
      );
    }

    // Handle SUCCESS status - extract and return data
    if (apiResponse?.status === ResponseStatus.SUCCESS) {
      return apiResponse.data as T;
    }

    // Fallback for unexpected response format
    console.warn('[api] Unexpected response format, returning as-is');
    return apiResponse as unknown as T;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('[api] ApiError ->', error.message, error.status);
      throw error;
    }

    if (error instanceof TypeError) {
      console.error('[api] Network error ->', error.message);
      throw new ApiError('Network error. Please check your connection.', 0);
    }

    console.error('[api] Unexpected error ->', error);
    throw new ApiError(error instanceof Error ? error.message : 'An unexpected error occurred', 500);
  }
}

// Generic API client with all HTTP methods
export const api = {
  get: <T>(url: string, config?: RequestInit): Promise<T> => {
    return fetchApi<T>(url, { ...config, method: 'GET' });
  },

  post: <T>(url: string, body?: unknown, config?: RequestInit): Promise<T> => {
    return fetchApi<T>(url, {
      ...config,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put: <T>(url: string, body?: unknown, config?: RequestInit): Promise<T> => {
    return fetchApi<T>(url, {
      ...config,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch: <T>(url: string, body?: unknown, config?: RequestInit): Promise<T> => {
    return fetchApi<T>(url, {
      ...config,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete: <T>(url: string, config?: RequestInit): Promise<T> => {
    return fetchApi<T>(url, { ...config, method: 'DELETE' });
  },
};

export default api;
