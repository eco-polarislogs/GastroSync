import axios from 'axios'

/**
 * Enterprise Centralized Axios Client.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN (Thesis Defense Note)
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. SINGLE POINT OF NETWORK CONTROL:
 *    All HTTP communication flows through this configured Axios instance.
 *    No raw `fetch()` calls scattered across components or stores.
 *
 * 2. AUTOMATIC JWT BEARER ATTACHMENT (Request Interceptor):
 *    Intercepts outgoing requests and attaches the RFC 6750 Bearer token
 *    stored in localStorage. Components don't need to manually read or pass tokens.
 *
 * 3. GLOBAL AUTHENTICATION RESILIENCE (Response Interceptor):
 *    Intercepts HTTP 401 Unauthorized responses (token expired or invalidated).
 *    Immediately purges corrupt/stale tokens from client storage and redirects
 *    the user to the login screen, preventing zombie UI sessions.
 *
 * 4. UNIFIED ERROR FORMATTING:
 *    Extracts the backend's standard ApiResponse error message, providing
 *    a clean string to TanStack Query and UI toast notifications.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// ── REQUEST INTERCEPTOR: Inject JWT Bearer Token ──────────────────
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('gastrosync_token')
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── RESPONSE INTERCEPTOR: Global Error Handling & 401 Eviction ────────────
axiosClient.interceptors.response.use(
  (response) => {
    // If backend returns ApiResponse wrapper { success: true, message: "...", data: ... }
    // we unwrap the data field if available, or return the full response.
    return response.data
  },
  (error) => {
    const status = error.response ? error.response.status : null

    if (status === 401) {
      console.warn('🔒 [Axios] 401 Unauthorized detected. Evicting expired session...')
      localStorage.removeItem('gastrosync_token')
      localStorage.removeItem('gastrosync_user')

      // Avoid redirect loop if already on login page
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login?expired=true'
      }
    }

    // Standardize error message extraction from backend ApiResponse
    const serverMessage = error.response?.data?.message || error.response?.data?.error
    const normalizedError = new Error(serverMessage || error.message || 'Bilinmeyen bir ağ hatası oluştu')
    normalizedError.status = status
    normalizedError.rawResponse = error.response?.data

    return Promise.reject(normalizedError)
  }
)

export default axiosClient
