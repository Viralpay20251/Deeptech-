/**
 * Autonomous Growth OS — Centralized Authenticated API Client
 *
 * Manages:
 * 1. Automatic operator session bootstrap & persistence (localStorage)
 * 2. Automatic Authorization: Bearer <token> injection across all API requests
 * 3. Transparent 401 retry with session re-bootstrap
 * 4. Google Search Console & Connectors authentication helpers
 */

export interface OperatorUser {
  id: string;
  email: string;
  role: 'workspace_admin' | 'operator' | 'reviewer' | 'publisher' | 'analyst' | 'viewer';
  display_name?: string;
  workspace_id: string;
}

const TOKEN_KEY = 'growth_os_token';
const USER_KEY = 'growth_os_user';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): OperatorUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: OperatorUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // LocalStorage quota or access issue
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // noop
  }
}

/**
 * Ensures a valid operator session is active.
 * Bootstraps automatically from backend if no token exists.
 */
export async function ensureOperatorSession(): Promise<{ token: string; user: OperatorUser }> {
  const existingToken = getStoredToken();
  const existingUser = getStoredUser();

  if (existingToken && existingUser) {
    return { token: existingToken, user: existingUser };
  }

  try {
    const res = await fetch('/api/v1/auth/session');
    const json = await res.json();
    if (json.success && json.data?.token) {
      const token = json.data.token as string;
      const user = json.data.user as OperatorUser;
      setStoredSession(token, user);
      return { token, user };
    }
  } catch (err) {
    console.warn('Operator session auto-bootstrap network error:', err);
  }

  // Fallback identity if API is still starting
  const fallbackUser: OperatorUser = {
    id: 'c4344661-4a88-46a9-b85d-c65303c37227',
    email: 'operator@growth-os.internal',
    role: 'workspace_admin',
    display_name: 'Lead Growth Operator',
    workspace_id: '00000000-0000-0000-0000-000000000001',
  };

  return { token: existingToken || '', user: existingUser || fallbackUser };
}

/**
 * Global authenticated fetch wrapper.
 * Injects Authorization header and workspace tenant scoping on every API request.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getStoredToken();

  if (!token) {
    const session = await ensureOperatorSession();
    token = session.token;
  }

  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('x-workspace-id')) {
    const user = getStoredUser();
    headers.set('x-workspace-id', user?.workspace_id || '00000000-0000-0000-0000-000000000001');
  }

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const newOptions: RequestInit = {
    ...options,
    headers,
  };

  let response = await fetch(url, newOptions);

  // If 401 unauthorized, attempt auto-refresh once
  if (response.status === 401) {
    try {
      const refreshRes = await fetch('/api/v1/auth/session');
      const json = await refreshRes.json();
      if (json.success && json.data?.token) {
        const freshToken = json.data.token as string;
        const freshUser = json.data.user as OperatorUser;
        setStoredSession(freshToken, freshUser);

        headers.set('Authorization', `Bearer ${freshToken}`);
        response = await fetch(url, { ...newOptions, headers });
      }
    } catch {
      // Return original response
    }
  }

  return response;
}
