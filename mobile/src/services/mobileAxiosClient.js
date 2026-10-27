import axios from 'axios';
import { getLocalStorage } from './storage';

let Constants = null;
try {
  Constants = require('expo-constants')?.default || require('expo-constants');
} catch (_) {}

/**
 * Enterprise React Native Axios Client.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN (Mobile Thesis Defense Note)
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. DYNAMIC HOST DETECTION:
 *    Detects Expo dev server IP, simulator loopback (10.0.2.2 / localhost),
 *    or browser hostname dynamically so mobile devices connect seamlessly.
 *
 * 2. JWT RFC 6750 BEARER ATTACHMENT:
 *    Automatically injects Authorization: Bearer <token> into every
 *    mobile HTTP request, unlocking Spring Security @PreAuthorize rules.
 *
 * 3. RESPONSE INTERCEPTION:
 *    Unwraps Spring Boot's ApiResponse<T> wrapper and handles 401 eviction.
 */
export const getMobileApiBaseUrl = () => {
  // 1. Dinamik Expo Metro Bağlantı Tespiti (Fiziksel cihaz ve simülatörler için en taze LAN IP)
  try {
    const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest?.debuggerHost || '';
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:8080/api`;
      }
    }
  } catch (_) {}

  // 2. Ortam Değişkeni (Expo Public URL)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 3. Web Tarayıcısı veya Yerel Host
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:8080/api`;
    }
  }

  // 4. Varsayılan Yerel Wi-Fi IP ve Geliştirici Fallback
  return 'http://192.168.1.149:8080/api';
};

export const MOBILE_API_BASE_URL = getMobileApiBaseUrl();

let inMemoryToken = null;

export const setMobileAuthToken = (token) => {
  inMemoryToken = token;
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem('gastrosync_mobile_token', token);
    } catch (_) {}
  }
};

export const getMobileAuthToken = () => {
  if (inMemoryToken) return inMemoryToken;
  const storage = getLocalStorage();
  if (storage) {
    try {
      inMemoryToken = storage.getItem('gastrosync_mobile_token');
    } catch (_) {}
  }
  return inMemoryToken;
};

export const clearMobileAuthToken = () => {
  inMemoryToken = null;
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.removeItem('gastrosync_mobile_token');
      storage.removeItem('gastrosync_mobile_user');
    } catch (_) {}
  }
};

export const mobileAxiosClient = axios.create({
  baseURL: MOBILE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

mobileAxiosClient.interceptors.request.use(
  (config) => {
    const token = getMobileAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

mobileAxiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const status = error.response ? error.response.status : null;
    if (status === 401) {
      clearMobileAuthToken();
    }
    return Promise.reject(error);
  }
);

export default mobileAxiosClient;
