import axios from 'axios'

/**
 * Merkezi HTTP istemcisi.
 * - Varsayılan adres göreli "/api": geliştirmede Vite proxy, canlıda Nginx ters proxy üzerinden
 *   aynı kökene gider (CORS gerektirmez). Farklı bir sunucu için VITE_API_URL tanımlanır.
 * - JWT her isteğe otomatik eklenir.
 * - Oturum modeli: kısa ömürlü erişim token'ı (15 dk) + dönen yenileme token'ı. Erişim token'ı bitmeden
 *   arka planda yenilenir; yine de 401 gelirse tek bir yenileme isteğiyle istek tekrar denenir.
 *   Yenileme başarısızsa oturum kapanır ve giriş ekranına dönülür.
 * - 403 PASSWORD_CHANGE_REQUIRED: şifre değiştirme ekranına yönlendirilir.
 * - Yanıt gövdesi ApiResponse sarmalayıcısıdır: { success, message, data }.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const TOKEN_KEY = 'gastrosync_token'
export const USER_KEY = 'gastrosync_user'
export const REFRESH_KEY = 'gastrosync_refresh'
export const EXPIRES_KEY = 'gastrosync_token_exp'

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

/** ApiResponse sarmalayıcısından veriyi çıkarır */
export const unwrap = (res) => (res && typeof res === 'object' && 'data' in res && 'success' in res ? res.data : res)

// ── Token saklama ──────────────────────────────────────────────

export function storeTokens(auth) {
  if (!auth) return
  if (auth.token) localStorage.setItem(TOKEN_KEY, auth.token)
  if (auth.refreshToken) localStorage.setItem(REFRESH_KEY, auth.refreshToken)
  if (auth.expiresIn) localStorage.setItem(EXPIRES_KEY, String(Date.now() + Number(auth.expiresIn) * 1000))
  scheduleTokenRefresh()
}

export function clearTokens() {
  clearTimeout(keeperTimer)
  keeperTimer = null
  ;[TOKEN_KEY, USER_KEY, REFRESH_KEY, EXPIRES_KEY].forEach((k) => localStorage.removeItem(k))
}

const refreshListeners = new Set()
/** Yenilenen oturumu dinle (ör. store'daki token'ı güncellemek için) */
export const onTokenRefreshed = (fn) => { refreshListeners.add(fn); return () => refreshListeners.delete(fn) }

function expireSession() {
  clearTokens()
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?expired=true'
  }
}

// ── Yenileme (tek uçuş) ────────────────────────────────────────

const bare = axios.create({ baseURL: API_BASE_URL, timeout: 15000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
let refreshPromise = null

/** Erişim token'ını yeniler. Aynı anda birden çok çağrı tek isteğe bağlanır. */
export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return Promise.reject(Object.assign(new Error('Oturum yenileme bilgisi yok'), { status: 401 }))
  refreshPromise = bare.post('/auth/refresh', { refreshToken })
    .then((res) => {
      const auth = unwrap(res.data)
      if (!auth?.token) throw Object.assign(new Error('Oturum yenilenemedi'), { status: 401 })
      storeTokens(auth)
      refreshListeners.forEach((fn) => { try { fn(auth) } catch (_) { /* dinleyici hatası yok sayılır */ } })
      return auth
    })
    .catch((err) => {
      const status = err?.response?.status ?? err?.status ?? null
      throw Object.assign(new Error(err?.response?.data?.message || err.message || 'Oturum yenilenemedi'), { status })
    })
    .finally(() => { refreshPromise = null })
  return refreshPromise
}

let keeperTimer = null
/** Erişim token'ı bitmeden ~1 dk önce arka planda yeniler */
export function scheduleTokenRefresh() {
  clearTimeout(keeperTimer)
  keeperTimer = null
  const exp = Number(localStorage.getItem(EXPIRES_KEY) || 0)
  if (!exp || !localStorage.getItem(REFRESH_KEY)) return
  const delay = Math.min(Math.max(5_000, exp - Date.now() - 60_000), 2_147_000_000)
  keeperTimer = setTimeout(async () => {
    keeperTimer = null
    try {
      await refreshAccessToken()
    } catch (err) {
      if (err.status === 401) { expireSession(); return }
      // Ağ hatası: kısa süre sonra tekrar dene
      keeperTimer = setTimeout(scheduleTokenRefresh, 30_000)
    }
  }, delay)
}

if (typeof window !== 'undefined') {
  // Uyku / arka plandan dönüşte süre geçmişse hemen yenile
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    const exp = Number(localStorage.getItem(EXPIRES_KEY) || 0)
    if (exp && exp - Date.now() < 90_000) scheduleTokenRefresh()
  })
  // Başka sekme yenilediyse zamanlayıcıyı yeni süreye göre kur
  window.addEventListener('storage', (e) => { if (e.key === EXPIRES_KEY && e.newValue) scheduleTokenRefresh() })
  scheduleTokenRefresh()
}

// ── Önleyiciler ────────────────────────────────────────────────

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const lang = localStorage.getItem('gastrosync_lang')
  if (lang) config.headers['Accept-Language'] = lang
  return config
})

const isAuthCall = (url) => /\/auth\/(login|refresh|logout)/.test(String(url || ''))

axiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response ? error.response.status : null
    const body = error.response?.data
    const config = error.config || {}

    if (status === 401 && !isAuthCall(config.url)) {
      if (!config._retried && localStorage.getItem(REFRESH_KEY)) {
        try {
          const auth = await refreshAccessToken()
          config._retried = true
          config.headers = { ...(config.headers || {}), Authorization: `Bearer ${auth.token}` }
          return axiosClient(config)
        } catch (_) {
          // aşağıda oturum kapatılır
        }
      }
      expireSession()
    }
    if (status === 403 && body?.code === 'PASSWORD_CHANGE_REQUIRED') {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/change-password')) {
        window.location.href = '/change-password'
      }
    }

    let message = body?.message || body?.error
    if (!message) {
      if (!error.response) message = 'Sunucuya ulaşılamıyor. İnternet bağlantınızı veya sunucu durumunu kontrol edin.'
      else if (status === 429) message = 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.'
      else message = 'Beklenmeyen bir hata oluştu.'
    }
    const normalized = new Error(message)
    normalized.status = status
    normalized.code = body?.code
    normalized.rawResponse = body
    return Promise.reject(normalized)
  }
)

export default axiosClient
