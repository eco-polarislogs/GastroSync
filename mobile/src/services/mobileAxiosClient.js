import { getLocalStorage } from './storage';

let Constants = null;
try {
  Constants = require('expo-constants')?.default || require('expo-constants');
} catch (_) {
  Constants = null;
}

// Kullanıcının giriş ekranında girdiği sunucu adresi (kendi sunucusunu barındıran restoranlar ve
// canlıya alınmadan yerel ağdaki bilgisayara bağlanan demo kurulumları için). Cihazda kalıcıdır.
let AsyncStorage = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch (_) { AsyncStorage = null; }
const SERVER_KEY = 'gastrosync_server_url';
let serverOverride = '';
const serverListeners = new Set();

/** "192.168.1.36", "192.168.1.36:8080" veya "https://panel.ornek.com" → tam API adresi */
export const normalizeServerUrl = (input) => {
  let s = String(input || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) || u.hostname === 'localhost';
    if (!u.port && isIp && u.protocol === 'http:') u.port = '8080';
    let path = u.pathname.replace(/\/+$/, '');
    if (!/\/api$/.test(path)) path = `${path}/api`;
    return `${u.protocol}//${u.host}${path}`;
  } catch (_) {
    return '';
  }
};

export const getServerOverride = () => serverOverride;
export const setServerOverride = async (input) => {
  serverOverride = normalizeServerUrl(input);
  try {
    if (AsyncStorage) {
      if (serverOverride) await AsyncStorage.setItem(SERVER_KEY, serverOverride);
      else await AsyncStorage.removeItem(SERVER_KEY);
    }
  } catch (_) { /* depolama yok */ }
  serverListeners.forEach((l) => { try { l(serverOverride); } catch (_) { /* yoksay */ } });
  return serverOverride;
};
export const subscribeServer = (fn) => { serverListeners.add(fn); return () => serverListeners.delete(fn); };
/** Uygulama açılışında kayıtlı adresi yükler (giriş ekranı beklerken çağrılır) */
export const loadServerOverride = async () => {
  try {
    const saved = AsyncStorage ? await AsyncStorage.getItem(SERVER_KEY) : null;
    if (saved) serverOverride = saved;
  } catch (_) { /* depolama yok */ }
  return serverOverride;
};
loadServerOverride();

/**
 * Backend API adresi.
 * Öncelik:
 *  0. Kullanıcının giriş ekranında kaydettiği sunucu adresi
 *  1. EXPO_PUBLIC_API_URL (canlı / mağaza derlemelerinde ZORUNLU, örn. https://api.restoraniniz.com/api)
 *  2. Geliştirmede Expo'nun bağlı olduğu bilgisayarın LAN IP'si (http://<ip>:8080/api)
 *  3. Web önizlemesinde sayfanın kökeni
 */
export const getMobileApiBaseUrl = () => {
  if (serverOverride) return serverOverride;
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  const envUrl = process.env.EXPO_PUBLIC_API_URL ? process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '') : '';
  // Canlı derlemede yalnızca tanımlı adres kullanılır
  if (envUrl && !isDev) return envUrl;
  try {
    const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest?.debuggerHost || '';
    const ip = hostUri ? hostUri.split(':')[0] : '';
    if (isDev && ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return `http://${ip}:8080/api`;
  } catch (_) {
    // Expo sabitleri okunamadı
  }
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8080/api`;
  }
  return 'http://localhost:8080/api';
};

export const MOBILE_API_BASE_URL = getMobileApiBaseUrl();

const TOKEN_KEY = 'gastrosync_mobile_token';
let inMemoryToken = null;

export const setMobileAuthToken = (token) => {
  inMemoryToken = token;
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(TOKEN_KEY, token);
    } catch (_) {
      // depolama erişilemez
    }
  }
};

export const getMobileAuthToken = () => {
  if (inMemoryToken) return inMemoryToken;
  const storage = getLocalStorage();
  if (storage) {
    try {
      inMemoryToken = storage.getItem(TOKEN_KEY);
    } catch (_) {
      inMemoryToken = null;
    }
  }
  return inMemoryToken;
};

export const clearMobileAuthToken = () => {
  inMemoryToken = null;
  inMemoryRefresh = null;
  accessExpiresAt = 0;
  if (keeperTimer) clearTimeout(keeperTimer);
  keeperTimer = null;
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.removeItem(TOKEN_KEY);
      storage.removeItem(REFRESH_KEY);
      storage.removeItem('gastrosync_mobile_user');
    } catch (_) {
      // depolama erişilemez
    }
  }
  if (AsyncStorage) AsyncStorage.removeItem(REFRESH_KEY).catch(() => {});
};

/** Telefonun kalıcı deposundaki yenileme token'ını belleğe alır (uygulama açılışı) */
export const loadPersistedRefresh = async () => {
  if (inMemoryRefresh || !AsyncStorage) return inMemoryRefresh;
  try { inMemoryRefresh = (await AsyncStorage.getItem(REFRESH_KEY)) || null; } catch (_) { inMemoryRefresh = null; }
  return inMemoryRefresh;
};

// ── Oturum yenileme ────────────────────────────────────────────
// Kısa ömürlü erişim token'ı (15 dk) + dönen yenileme token'ı. Erişim token'ı bitmeden ~1 dk önce
// arka planda yenilenir; uygulama ön plana dönünce süre kontrol edilir. 401 gelirse istek bir kez
// yenilemeden sonra tekrarlanır (api.js). Yenileme reddedilirse oturum kapanır.
const REFRESH_KEY = 'gastrosync_mobile_refresh';
let inMemoryRefresh = null;
let accessExpiresAt = 0;
let keeperTimer = null;
let refreshPromise = null;

export const getMobileRefreshToken = () => {
  if (inMemoryRefresh) return inMemoryRefresh;
  const storage = getLocalStorage();
  if (storage) {
    try { inMemoryRefresh = storage.getItem(REFRESH_KEY); } catch (_) { inMemoryRefresh = null; }
  }
  return inMemoryRefresh;
};

export const getAccessExpiresAt = () => accessExpiresAt;

/** Giriş / yenileme / şifre değişikliği yanıtını saklar ve yenileme zamanlayıcısını kurar */
export const setMobileSession = (auth) => {
  if (!auth || !auth.token) return;
  setMobileAuthToken(auth.token);
  if (auth.refreshToken) {
    inMemoryRefresh = auth.refreshToken;
    const storage = getLocalStorage();
    if (storage) {
      try { storage.setItem(REFRESH_KEY, auth.refreshToken); } catch (_) { /* depolama erişilemez */ }
    }
    // Telefonda kalıcı saklama: uygulama arka planda kapatılsa da oturum açılışta geri yüklenir
    if (AsyncStorage) AsyncStorage.setItem(REFRESH_KEY, auth.refreshToken).catch(() => {});
  }
  accessExpiresAt = auth.expiresIn ? Date.now() + Number(auth.expiresIn) * 1000 : 0;
  scheduleMobileRefresh();
};

/**
 * Erişim token'ını yeniler. Dönüş: yeni oturum | null (yenileme reddedildi: yeniden giriş gerekir)
 * | undefined (ağ hatası: oturum korunur, sonra tekrar denenir). Aynı anda tek istek gider.
 */
export const refreshMobileSession = () => {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getMobileRefreshToken();
  if (!refreshToken) return Promise.resolve(null);
  refreshPromise = (async () => {
    const controller = new AbortController();
    // Ücretsiz bulut sunucusu uykudan uyanırken ~1 dk sürebilir
    const timer = setTimeout(() => controller.abort(), 70000);
    try {
      const res = await fetch(`${getMobileApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });
      let json = null;
      try { json = await res.json(); } catch (_) { json = null; }
      if (res.ok && json && json.data && json.data.token) {
        setMobileSession(json.data);
        return json.data;
      }
      if (res.status === 401 || res.status === 400) return null;
      return undefined;
    } catch (_) {
      return undefined;
    } finally {
      clearTimeout(timer);
      refreshPromise = null;
    }
  })();
  return refreshPromise;
};

export function scheduleMobileRefresh() {
  if (keeperTimer) clearTimeout(keeperTimer);
  keeperTimer = null;
  if (!accessExpiresAt || !getMobileRefreshToken()) return;
  const delay = Math.min(Math.max(5000, accessExpiresAt - Date.now() - 60000), 2147000000);
  keeperTimer = setTimeout(async () => {
    keeperTimer = null;
    const r = await refreshMobileSession();
    if (r === null) notifySessionExpired();
    else if (r === undefined) keeperTimer = setTimeout(scheduleMobileRefresh, 30000);
  }, delay);
}

/** Uygulama ön plana döndüğünde çağrılır: süre dolmak üzereyse hemen yeniler */
export const ensureFreshSession = async () => {
  if (!accessExpiresAt || accessExpiresAt - Date.now() > 90000) return true;
  const r = await refreshMobileSession();
  if (r === null) { notifySessionExpired(); return false; }
  return true;
};

/** Oturum düştüğünde (401) uygulamanın girişe dönmesi için dinleyici */
const sessionListeners = new Set();
export const onSessionExpired = (listener) => {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
};
export const notifySessionExpired = () => {
  clearMobileAuthToken();
  sessionListeners.forEach((l) => {
    try { l(); } catch (_) { /* dinleyici hatası */ }
  });
};
