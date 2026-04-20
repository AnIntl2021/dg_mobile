import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Web-safe token storage (SecureStore doesn't support web)
export const tokenStore = {
  async get(key) {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key, value) {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key) {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    return SecureStore.deleteItemAsync(key);
  },
};

const PROD_API = 'https://api-digicards.ansoftt.com';
const LIVE_API = process.env.EXPO_PUBLIC_API_URL || PROD_API;

const BASE = `${LIVE_API}/api`;

export const API_BASE_URL = BASE;
export const FRONTEND_BASE_URL = 'https://digicards.ansoftt.com';
export const PUBLIC_CARD_URL = `${FRONTEND_BASE_URL}/c`;

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  try {
    const token = await tokenStore.get('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err),
);

export default api;

export const authApi = {
  login: (credentials) => api.post('/auth/card-user/login', credentials),
  adminLogin: (credentials) => api.post('/admin/login', credentials),
  me: () => api.get('/auth/me'),
};

export const cardsApi = {
  getAll: () => api.get('/cards'),
  getOne: (id) => api.get(`/cards/${id}`),
  getMyCard: () => api.get('/cards/owner/my-card'),
  create: (data) => api.post('/cards', data),
  update: (id, data) => api.put(`/cards/${id}`, data),
  delete: (id) => api.delete(`/cards/${id}`),
  getWalletPass: (id) => api.get(`/cards/wallet/create-pass/${id}`),
  getPublicCard: (tenantSlug, cardSlug) => api.get(`/public/card/${tenantSlug}/${cardSlug}`),
  getPublicWalletPass: (tenantSlug, cardSlug) => api.post(`/public/wallet/${tenantSlug}/${cardSlug}`),
};

export const leadsApi = {
  getAll: () => api.get('/cards/leads'),
  getByCard: (cardId) => api.get(`/cards/${cardId}/leads`),
};

