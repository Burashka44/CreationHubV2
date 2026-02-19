// ── API client with auto token refresh
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.220:9292';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ch_access');
}
function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ch_refresh');
}
function saveTokens(access: string, refresh?: string) {
  localStorage.setItem('ch_access', access);
  if (refresh) localStorage.setItem('ch_refresh', refresh);
}
function clearTokens() {
  localStorage.removeItem('ch_access');
  localStorage.removeItem('ch_refresh');
}

let refreshing: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const r = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) { clearTokens(); return false; }
    const { access_token } = await r.json();
    saveTokens(access_token);
    return true;
  } catch { clearTokens(); return false; }
}

async function request<T>(path: string, opts: RequestInit = {}, retry = true): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });

  if (res.status === 401 && retry) {
    // token expired — refresh once
    if (!refreshing) refreshing = refreshAccess().finally(() => { refreshing = null; });
    const ok = await refreshing;
    if (ok) return request<T>(path, opts, false);
    // refresh failed — redirect to login
    clearTokens();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ── Auth
export const api = {
  auth: {
    login:          (b: { email: string; password: string; totp_code?: string }) =>
                      request('/api/auth/login', { method: 'POST', body: JSON.stringify(b) }),
    logout:         (refresh_token?: string) =>
                      request('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token }) }),
    me:             () => request('/api/auth/me'),
    refresh:        (rt: string) => request('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: rt }) }),
    changePassword: (b: { current_password: string; new_password: string }) =>
                      request('/api/auth/change-password', { method: 'POST', body: JSON.stringify(b) }),
    setup2fa:       () => request('/api/auth/2fa/setup', { method: 'POST' }),
    verify2fa:      (b: { secret: string; code: string }) =>
                      request('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify(b) }),
    disable2fa:     (b: { password: string }) =>
                      request('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify(b) }),
    sessions:       () => request('/api/auth/sessions'),
    deleteSession:  (id: string) => request(`/api/auth/sessions/${id}`, { method: 'DELETE' }),
  },
  // ── Metrics
  metrics: {
    current: ()         => request('/api/metrics/current'),
    history: (range: string) => request(`/api/metrics/history?range=${range}`),
    gpu:     ()         => request('/api/metrics/gpu'),
    gpuHistory: (range: string, idx = 0) => request(`/api/metrics/gpu/history?range=${range}&gpu_index=${idx}`),
    disks:   ()         => request('/api/metrics/disks'),
    network: ()         => request('/api/metrics/network'),
    healthScore: ()     => request('/api/metrics/health-score'),
    publicIp: ()        => request('/api/metrics/public-ip'),
  },
  // ── Services
  services: {
    list:    ()         => request('/api/services'),
    get:     (name: string) => request(`/api/services/${name}`),
    start:   (name: string) => request(`/api/services/${name}/start`,   { method: 'POST' }),
    stop:    (name: string) => request(`/api/services/${name}/stop`,    { method: 'POST' }),
    restart: (name: string) => request(`/api/services/${name}/restart`, { method: 'POST' }),
    logs:    (name: string, tail = 200) => request(`/api/services/${name}/logs?tail=${tail}`),
    uptime:  (name: string) => request(`/api/services/${name}/uptime`),
  },
  // ── Settings
  settings: {
    get:       ()          => request('/api/settings'),
    update:    (b: Record<string, string>) => request('/api/settings', { method: 'PUT', body: JSON.stringify(b) }),
    language:  (language: string) => request('/api/settings/language', { method: 'PUT', body: JSON.stringify({ language }) }),
    theme:     (theme: string)    => request('/api/settings/theme',    { method: 'PUT', body: JSON.stringify({ theme }) }),
    uiScale:   (scale: number)    => request('/api/settings/ui-scale', { method: 'PUT', body: JSON.stringify({ scale }) }),
  },
  // ── Admins
  admins: {
    list:   ()          => request('/api/admins'),
    create: (b: object) => request('/api/admins', { method: 'POST', body: JSON.stringify(b) }),
    update: (id: string, b: object) => request(`/api/admins/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    delete: (id: string) => request(`/api/admins/${id}`, { method: 'DELETE' }),
    tokens: { list: () => request('/api/admins/tokens/list'), create: (b: object) => request('/api/admins/tokens', { method: 'POST', body: JSON.stringify(b) }), revoke: (id: string) => request(`/api/admins/tokens/${id}`, { method: 'DELETE' }) },
  },
  // ── Logs
  logs: {
    list: (params?: Record<string, string>) => request(`/api/logs?${new URLSearchParams(params)}`),
    export: (format: 'json'|'csv', from?: string, to?: string) =>
              `${API_URL}/api/logs/export?format=${format}${from?`&from=${from}`:''}${to?`&to=${to}`:''}`,
  },
};

export { saveTokens, clearTokens, API_URL };
