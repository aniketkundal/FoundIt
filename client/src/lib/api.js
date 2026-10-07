// Thin fetch wrapper for the FoundIt API.
// Uses relative URLs (/api/...) which work in both dev (Vite proxy) and
// production (Vercel rewrite). Attaches the JWT from localStorage when present
// and normalises error handling so callers can `try/catch` a real Error.

const TOKEN_KEY = 'foundit_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    // A 401 while we hold a token means the session expired or is invalid:
    // clear it and send the user to log in again. /auth/* calls are left to
    // AuthContext (the startup /auth/me check must not redirect visitors).
    if (res.status === 401 && token && !path.startsWith('/auth/')) {
      setToken(null);
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = data && data.details;
    throw err;
  }

  return data;
}
