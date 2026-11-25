import { TOKEN_KEY, EXPIRES_KEY, refreshAccessToken } from '../api/axiosClient'

/**
 * Hafif STOMP 1.2 istemcisi (ek bağımlılık yok).
 *
 * - Adres: VITE_WS_URL veya sayfanın kendi kökeni (http->ws, https->wss) + /ws.
 *   Geliştirmede Vite, canlıda Nginx /ws yolunu backend'e aktarır.
 * - CONNECT çerçevesinde JWT gönderilir; sunucu kimliksiz bağlantıyı reddeder.
 * - Bağlantı koptuğunda artan bekleme süresiyle yeniden bağlanır ve abonelikleri yeniler.
 * - Oturum kapatıldığında disconnect() ile tamamen durur.
 */
class WebSocketService {
  constructor() {
    this.ws = null
    this.connected = false
    this.subscriptions = new Map()
    this.subCounter = 0
    this.reconnectTimer = null
    this.retry = 0
    this.stopped = true
    this.statusListeners = new Set()
    this.errorListeners = new Set()
  }

  /** Sunucu ERROR çerçevesi (yetki değişti / oturum geçersiz) dinleyicisi */
  onServerError(listener) {
    this.errorListeners.add(listener)
    return () => this.errorListeners.delete(listener)
  }

  getWsUrl() {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
    if (typeof window === 'undefined') return 'ws://localhost:8080/ws'
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/ws`
  }

  onStatusChange(listener) {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  setConnected(value) {
    this.connected = value
    this.statusListeners.forEach((l) => {
      try { l(value) } catch (_) { /* dinleyici hatası bağlantıyı etkilemesin */ }
    })
  }

  connect() {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return
    this.stopped = false
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return

    try {
      this.ws = new WebSocket(this.getWsUrl())
    } catch (_) {
      this.scheduleReconnect()
      return
    }

    const socket = this.ws
    socket.onopen = async () => {
      let jwt = localStorage.getItem(TOKEN_KEY) || ''
      // Erişim token'ı bitmek üzereyse (uyku / ağ kesintisi sonrası) bağlanmadan önce yenile
      const exp = Number(localStorage.getItem(EXPIRES_KEY) || 0)
      if (exp && exp - Date.now() < 15_000) {
        try { jwt = (await refreshAccessToken()).token } catch (_) { /* geçersizse sunucu reddeder */ }
      }
      if (socket.readyState !== WebSocket.OPEN) return
      socket.send(`CONNECT\naccept-version:1.2\nAuthorization:Bearer ${jwt}\nheart-beat:0,0\n\n\0`)
    }
    this.ws.onmessage = (event) => this.handleRawFrame(event.data)
    this.ws.onerror = () => this.setConnected(false)
    this.ws.onclose = () => {
      this.setConnected(false)
      if (!this.stopped) this.scheduleReconnect()
    }
  }

  disconnect() {
    this.stopped = true
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.subscriptions.clear()
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.send('DISCONNECT\n\n\0')
        this.ws.close()
      } catch (_) { /* zaten kapalı */ }
    }
    this.ws = null
    this.setConnected(false)
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.stopped) return
    const delay = Math.min(30000, 2000 * 2 ** Math.min(this.retry, 4))
    this.retry += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  handleRawFrame(raw) {
    if (!raw || raw === '\n') return
    String(raw).split('\0').filter((f) => f.trim().length > 0).forEach((f) => this.dispatch(f))
  }

  dispatch(frame) {
    const text = frame.replace(/^\n+/, '')
    const headerEnd = text.indexOf('\n\n')
    const head = headerEnd === -1 ? text : text.substring(0, headerEnd)
    const body = headerEnd === -1 ? '' : text.substring(headerEnd + 2)
    const [command, ...headerLines] = head.split('\n')
    const headers = {}
    headerLines.forEach((line) => {
      const i = line.indexOf(':')
      if (i > 0) headers[line.substring(0, i).trim()] = line.substring(i + 1).trim()
    })

    if (command === 'CONNECTED') {
      this.retry = 0
      this.setConnected(true)
      this.subscriptions.forEach((sub, id) => this.sendSubscribe(id, sub.destination))
      return
    }
    if (command === 'ERROR') {
      // Yetkisiz abonelik veya geçersiz oturum: sunucu bağlantıyı kapatır
      console.warn('[WS] Sunucu hatası:', headers.message || body)
      this.errorListeners.forEach((l) => {
        try { l(headers.message || body) } catch (_) { /* yoksay */ }
      })
      return
    }
    if (command !== 'MESSAGE') return

    let payload = body
    try { payload = JSON.parse(body) } catch (_) { /* düz metin */ }
    const sub = this.subscriptions.get(headers.subscription)
    if (sub) {
      try { sub.callback(payload, headers.destination) } catch (e) { console.error('[WS] Dinleyici hatası', e) }
    }
  }

  sendSubscribe(id, destination) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connected) {
      this.ws.send(`SUBSCRIBE\nid:${id}\ndestination:${destination}\nack:auto\n\n\0`)
    }
  }

  subscribe(destination, callback) {
    const id = `sub-${++this.subCounter}`
    this.subscriptions.set(id, { destination, callback })
    if (this.connected) this.sendSubscribe(id, destination)
    else this.connect()
    return () => {
      this.subscriptions.delete(id)
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connected) {
        this.ws.send(`UNSUBSCRIBE\nid:${id}\n\n\0`)
      }
    }
  }
}

export const websocketService = new WebSocketService()
export default websocketService
