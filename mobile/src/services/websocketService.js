/**
 * GastroSync mobil STOMP istemcisi.
 * - CONNECT çerçevesinde JWT zorunludur (sunucu kimliksiz bağlantıyı reddeder).
 * - Abonelikler sunucu tarafında rol politikasıyla denetlenir.
 * - Bağlantı koparsa artan bekleme süresiyle yeniden bağlanır; disconnect() ile tamamen durur.
 */
import { getMobileApiBaseUrl, getMobileAuthToken, getAccessExpiresAt, refreshMobileSession } from './mobileAxiosClient';

class MobileWebSocketService {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.subCounter = 0;
    this.reconnectTimer = null;
    this.retry = 0;
    this.stopped = true;
    this.statusListeners = new Set();
    this.errorListeners = new Set();
  }

  onStatusChange(listener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onServerError(listener) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  emit(set, value) {
    set.forEach((l) => {
      try { l(value); } catch (_) { /* dinleyici hatası */ }
    });
  }

  getWsUrl() {
    if (process.env.EXPO_PUBLIC_WS_URL) return process.env.EXPO_PUBLIC_WS_URL;
    return getMobileApiBaseUrl().replace(/\/api$/, '/ws').replace(/^http/, 'ws');
  }

  connect() {
    if (!getMobileAuthToken()) return;
    this.stopped = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    try {
      this.ws = new WebSocket(this.getWsUrl());
    } catch (_) {
      this.scheduleReconnect();
      return;
    }
    const socket = this.ws;
    socket.onopen = async () => {
      // Erişim token'ı bitmek üzereyse (arka plan / ağ kesintisi sonrası) bağlanmadan önce yenile
      const exp = getAccessExpiresAt();
      if (exp && exp - Date.now() < 15000) {
        try { await refreshMobileSession(); } catch (_) { /* sunucu reddederse yeniden bağlanma döngüsü sürer */ }
      }
      if (socket.readyState !== WebSocket.OPEN) return;
      const token = getMobileAuthToken() || '';
      socket.send(`CONNECT\naccept-version:1.2\nAuthorization:Bearer ${token}\nheart-beat:0,0\n\n\0`);
    };
    this.ws.onmessage = (event) => this.handleRawFrame(event.data);
    this.ws.onerror = () => { this.connected = false; };
    this.ws.onclose = () => {
      this.connected = false;
      this.emit(this.statusListeners, false);
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  disconnect() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.subscriptions.clear();
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.send('DISCONNECT\n\n\0');
        this.ws.close();
      } catch (_) {
        // zaten kapalı
      }
    }
    this.ws = null;
    this.connected = false;
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.stopped) return;
    const delay = Math.min(30000, 2000 * 2 ** Math.min(this.retry, 4));
    this.retry += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  handleRawFrame(raw) {
    if (!raw) return;
    String(raw).split('\0').filter((f) => f.trim().length > 0).forEach((f) => this.dispatch(f));
  }

  dispatch(frame) {
    const text = frame.replace(/^\n+/, '');
    const headerEnd = text.indexOf('\n\n');
    const head = headerEnd === -1 ? text : text.substring(0, headerEnd);
    const body = headerEnd === -1 ? '' : text.substring(headerEnd + 2);
    const [command, ...headerLines] = head.split('\n');
    const headers = {};
    headerLines.forEach((line) => {
      const i = line.indexOf(':');
      if (i > 0) headers[line.substring(0, i).trim()] = line.substring(i + 1).trim();
    });

    if (command === 'CONNECTED') {
      this.connected = true;
      this.retry = 0;
      this.subscriptions.forEach((sub, id) => this.sendSubscribe(id, sub.destination));
      this.emit(this.statusListeners, true);
      return;
    }
    if (command === 'ERROR') {
      // Yetki değişti veya oturum geçersiz: uygulama oturumu tazeler
      this.emit(this.errorListeners, headers.message || body);
      return;
    }
    if (command !== 'MESSAGE') return;
    let payload = body;
    try { payload = JSON.parse(body); } catch (_) { /* düz metin */ }
    const sub = this.subscriptions.get(headers.subscription);
    if (sub) {
      try { sub.callback(payload); } catch (_) { /* dinleyici hatası */ }
    }
  }

  sendSubscribe(id, destination) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connected) {
      this.ws.send(`SUBSCRIBE\nid:${id}\ndestination:${destination}\nack:auto\n\n\0`);
    }
  }

  subscribe(destination, callback) {
    const id = `sub-mob-${++this.subCounter}`;
    this.subscriptions.set(id, { destination, callback });
    if (this.connected) this.sendSubscribe(id, destination);
    else this.connect();
    return () => {
      this.subscriptions.delete(id);
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connected) {
        this.ws.send(`UNSUBSCRIBE\nid:${id}\n\n\0`);
      }
    };
  }

  /** Geriye dönük uyumluluk: mesajlar REST ile gönderilir (çift kayıt olmaması için) */
  send() {}
}

export const mobileWebSocketService = new MobileWebSocketService();
export default mobileWebSocketService;
