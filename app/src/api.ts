import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * On a physical phone, `localhost` is the phone itself — not your laptop. Set
 * `apiUrl` in app.json (or EXPO_PUBLIC_API_URL) to your machine's LAN address,
 * e.g. http://192.168.1.20:4000, when testing on a real device.
 */
function resolveBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra as any)?.apiUrl;
  if (configured) return String(configured).replace(/\/$/, '');

  // Fall back to the host that served the dev bundle.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return `http://${host}:4000`;
  return 'http://localhost:4000';
}

export const API_URL = resolveBaseUrl();

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { ...((options.headers as any) ?? {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const isFormData = options.body instanceof FormData;
  if (options.body && !isFormData) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Cannot reach the Iyambere server. Check your connection.');
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiError(data?.error ?? 'Something went wrong.');
  return data;
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const api = {
  // --- accounts ---
  login: (phone: string, password: string) =>
    request('/api/auth/login', { method: 'POST', ...json({ phone, password }) }),
  register: (payload: Record<string, string>) =>
    request('/api/auth/register', { method: 'POST', ...json(payload) }),
  me: () => request('/api/auth/me'),

  // --- reports ---
  listReports: (status?: string) =>
    request(`/api/reports${status ? `?status=${status}` : ''}`),
  getReport: (id: number | string) => request(`/api/reports/${id}`),
  createReport: (form: FormData) => request('/api/reports', { method: 'POST', body: form }),
  assignReport: (id: number, technician_id: number) =>
    request(`/api/reports/${id}/assign`, { method: 'POST', ...json({ technician_id }) }),
  acceptReport: (id: number) => request(`/api/reports/${id}/accept`, { method: 'POST' }),
  arriveReport: (id: number) => request(`/api/reports/${id}/arrive`, { method: 'POST' }),
  resolveReport: (id: number, form: FormData) =>
    request(`/api/reports/${id}/resolve`, { method: 'POST', body: form }),
  verifyReport: (id: number) => request(`/api/reports/${id}/verify`, { method: 'POST' }),

  // --- network ---
  listPipes: (params = '') => request(`/api/pipes${params}`),
  getPipe: (id: number | string) => request(`/api/pipes/${id}`),
  updatePipe: (id: number, patch: Record<string, unknown>) =>
    request(`/api/pipes/${id}`, { method: 'PATCH', ...json(patch) }),
  pressureAnomalies: () => request('/api/pressure/anomalies'),

  // --- analytics ---
  overview: () => request('/api/stats/overview'),
  technicianPerformance: () => request('/api/stats/technicians'),
  availableTechnicians: () => request('/api/stats/technicians/available'),
};
