const AUTH_TOKEN_KEY = 'auth_token';

export function extractTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    setAuthToken(token);
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());
  }
  return token;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export type AuthUser = {
  userId: number;
  email: string;
  name?: string;
};

export function getUser(): AuthUser | null {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      userId: parseInt(payload.sub, 10),
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null;
}

export function signOut(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.clear();
  window.location.href = '/auth/login';
}
