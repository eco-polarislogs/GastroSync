#!/usr/bin/env node
/**
 * GastroSync yazıcı köprüsü.
 *
 * Sunucu bulutta çalışırken restorandaki ağ (ESC/POS, TCP 9100) yazıcılarına doğrudan ulaşamaz.
 * Bu betik restoranın yerel ağındaki herhangi bir cihazda (mini PC, Raspberry Pi, kasa bilgisayarı)
 * çalışır: bağlantı türü "Köprü" olan bekleyen yazdırma işlerini sunucudan alır, yazıcıya gönderir
 * ve sonucu sunucuya bildirir. Başarısız iş sunucuda "Hata" olarak görünür, ekrandan yeniden denenebilir.
 *
 * Kullanım:
 *   GASTROSYNC_URL=https://panel.restoraniniz.com/api \
 *   GASTROSYNC_USER=yazici GASTROSYNC_PASSWORD=******** \
 *   node scripts/print-bridge.mjs
 *
 * Köprü hesabı olarak yazdırma işlerini görme yetkisi (POS_VIEW) olan bir personel hesabı kullanın.
 * İsteğe bağlı: GASTROSYNC_POLL_MS (varsayılan 3000).
 */
import net from 'node:net'

const BASE = (process.env.GASTROSYNC_URL || 'http://localhost:8080/api').replace(/\/$/, '')
const USER = process.env.GASTROSYNC_USER
const PASSWORD = process.env.GASTROSYNC_PASSWORD
const POLL_MS = Number(process.env.GASTROSYNC_POLL_MS || 3000)

if (!USER || !PASSWORD) {
  console.error('GASTROSYNC_USER ve GASTROSYNC_PASSWORD ortam değişkenleri zorunludur.')
  process.exit(1)
}

let token = null

const log = (...a) => console.log(new Date().toISOString(), ...a)

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: USER, password: PASSWORD }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.data?.token) throw new Error(json?.message || `Giriş başarısız (HTTP ${res.status})`)
  token = json.data.token
  log('Sunucuya bağlanıldı:', BASE)
}

async function api(path, { method = 'GET', body } = {}, retried = false) {
  if (!token) await login()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && !retried) {
    token = null
    return api(path, { method, body }, true)
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`)
  return json?.data
}

function sendToPrinter(host, port, bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: port || 9100 })
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Yazıcı yanıt vermedi (zaman aşımı)')) }, 8000)
    socket.on('connect', () => socket.end(bytes))
    socket.on('close', (hadError) => { clearTimeout(timer); if (!hadError) resolve() })
    socket.on('error', (err) => { clearTimeout(timer); reject(err) })
  })
}

async function tick() {
  const jobs = await api('/print/bridge/jobs')
  for (const job of jobs || []) {
    try {
      await sendToPrinter(job.host, job.port, Buffer.from(job.payload, 'base64'))
      await api(`/print/bridge/jobs/${job.id}`, { method: 'PUT', body: { ok: true } })
      log(`Basıldı: #${job.id} ${job.title} -> ${job.printerName}`)
    } catch (err) {
      await api(`/print/bridge/jobs/${job.id}`, { method: 'PUT', body: { ok: false, error: String(err.message || err).slice(0, 250) } })
        .catch(() => {})
      log(`Hata: #${job.id} ${job.title} -> ${job.printerName}: ${err.message}`)
    }
  }
}

async function loop() {
  for (;;) {
    try {
      await tick()
    } catch (err) {
      log('Sunucuya ulaşılamadı, yeniden denenecek:', err.message)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

log('GastroSync yazıcı köprüsü başlatıldı')
loop()
