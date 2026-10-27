/**
 * GastroSync Enterprise STOMP/WebSocket Real-Time Client.
 *
 * Lightweight, zero-dependency STOMP-over-WebSocket client engineered for
 * sub-millisecond bidirectional communication across Web and Mobile.
 */

class WebSocketService {
  constructor() {
    this.ws = null
    this.connected = false
    this.subscriptions = new Map() // subId -> { destination, callback }
    this.subCounter = 0
    this.reconnectTimer = null
    this.queuedMessages = []
    this.listeners = new Set()
  }

  getWsUrl() {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || 'localhost'
      return `ws://${host}:8080/ws`
    }
    return 'ws://localhost:8080/ws'
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    try {
      const url = this.getWsUrl()
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        // STOMP CONNECT frame with RFC 6750 JWT Bearer Token
        let authHeader = ''
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('gastrosync_token')
          if (token) {
            authHeader = `Authorization:Bearer ${token}\n`
          }
        }
        const connectFrame = `CONNECT\naccept-version:1.2,1.1,1.0\n${authHeader}heart-beat:10000,10000\n\n\0`
        this.ws.send(connectFrame)
      }

      this.ws.onmessage = (event) => {
        this.handleRawFrame(event.data)
      }

      this.ws.onerror = () => {
        this.connected = false
      }

      this.ws.onclose = () => {
        this.connected = false
        this.scheduleReconnect()
      }
    } catch (_) {
      this.scheduleReconnect()
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 3000)
  }

  handleRawFrame(rawText) {
    if (!rawText) return
    const frames = rawText.split('\0').filter(f => f.trim().length > 0)
    for (const frame of frames) {
      this.parseAndDispatchStompFrame(frame)
    }
  }

  parseAndDispatchStompFrame(frame) {
    const lines = frame.split('\n')
    const command = lines[0].trim()

    if (command === 'CONNECTED') {
      this.connected = true
      // Re-subscribe all registered subscriptions
      this.subscriptions.forEach((sub, id) => {
        this.sendSubscribeFrame(id, sub.destination)
      })
      // Flush queued messages
      while (this.queuedMessages.length > 0) {
        const item = this.queuedMessages.shift()
        this.send(item.destination, item.payload)
      }
      return
    }

    if (command === 'MESSAGE') {
      // Find where headers end and body begins (double newline)
      const headerEndIndex = frame.indexOf('\n\n')
      if (headerEndIndex === -1) return

      const headerBlock = frame.substring(0, headerEndIndex)
      const body = frame.substring(headerEndIndex + 2)

      const headerLines = headerBlock.split('\n')
      let destination = ''
      for (let i = 1; i < headerLines.length; i++) {
        const [k, v] = headerLines[i].split(':')
        if (k && k.trim() === 'destination') {
          destination = v.trim()
          break
        }
      }

      let payload = null
      try {
        payload = JSON.parse(body)
      } catch (_) {
        payload = body
      }

      // Dispatch to matching subscriptions
      this.subscriptions.forEach(sub => {
        if (sub.destination === destination || destination.startsWith(sub.destination)) {
          try {
            sub.callback(payload)
          } catch (_) {}
        }
      })
    }
  }

  sendSubscribeFrame(subId, destination) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const frame = `SUBSCRIBE\nid:${subId}\ndestination:${destination}\nack:auto\n\n\0`
    this.ws.send(frame)
  }

  subscribe(destination, callback) {
    const subId = `sub-${++this.subCounter}`
    this.subscriptions.set(subId, { destination, callback })

    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribeFrame(subId, destination)
    } else {
      this.connect()
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subId)
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(`UNSUBSCRIBE\nid:${subId}\n\n\0`)
      }
    }
  }

  send(destination, payload) {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queuedMessages.push({ destination, payload })
      this.connect()
      return
    }
    const frame = `SEND\ndestination:${destination}\ncontent-type:application/json\n\n${body}\0`
    this.ws.send(frame)
  }
}

export const websocketService = new WebSocketService()
export default websocketService
