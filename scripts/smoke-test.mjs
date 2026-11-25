#!/usr/bin/env node
/**
 * GastroSync canlı ortam duman testi (Node 20+, ek bağımlılık yok).
 *
 * Varsayılan mod SALT OKUNURDUR: kayıt oluşturmaz, canlı muhasebe verisini kirletmez.
 *   node scripts/smoke-test.mjs https://panel.restoraniniz.com
 *
 * --write: demo / test ortamında uçtan uca iş akışını da çalıştırır
 *   (gider → onay → ödeme → defter, tedarik talebi, satış → iptal). CANLIDA KULLANMAYIN.
 *   node scripts/smoke-test.mjs http://localhost:3000 --write
 *
 * Kimlik bilgileri ortam değişkenlerinden okunur (varsayılan: demo hesapları / 123456):
 *   SMOKE_PASSWORD, SMOKE_ADMIN, SMOKE_MANAGER, SMOKE_ACCOUNTANT, SMOKE_ADVISOR, SMOKE_CHEF, SMOKE_WAREHOUSE
 */
const args = process.argv.slice(2)
const BASE = (args.find((a) => !a.startsWith('--')) || 'http://localhost:3000').replace(/\/+$/, '')
const WRITE = args.includes('--write')
const PASSWORD = process.env.SMOKE_PASSWORD || '123456'
const USERS = {
  admin: process.env.SMOKE_ADMIN || 'admin',
  manager: process.env.SMOKE_MANAGER || 'manager',
  accountant: process.env.SMOKE_ACCOUNTANT || 'accountant',
  advisor: process.env.SMOKE_ADVISOR || 'advisor',
  chef: process.env.SMOKE_CHEF || 'chef',
  warehouse: process.env.SMOKE_WAREHOUSE || 'warehouse',
  cashier: process.env.SMOKE_CASHIER || 'cashier',
}

let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? `  (${detail})` : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch (_) { /* gövdesiz yanıt */ }
  return { status: res.status, data: json?.data, message: json?.message }
}

async function login(role) {
  const password = process.env[`SMOKE_${role.toUpperCase()}_PASSWORD`] || PASSWORD
  const r = await api('/auth/login', { method: 'POST', body: { identifier: USERS[role], password } })
  check(`Giriş: ${role} (${USERS[role]})`, r.status === 200 && !!r.data?.token, r.status === 200 ? '' : r.message)
  return r.data?.token
}

function stompConnect(token) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/ws`)
    const frames = []
    ws.onmessage = (e) => String(e.data).split('\0').filter((f) => f.trim()).forEach((f) => frames.push(f))
    ws.onopen = () => ws.send(`CONNECT\naccept-version:1.2\n${token ? `Authorization:Bearer ${token}\n` : ''}heart-beat:0,0\n\n\0`)
    ws.onerror = () => {}
    resolve({ ws, frames })
  })
}

console.log(`GastroSync duman testi → ${BASE} (${WRITE ? 'YAZMA MODU' : 'salt okunur'})\n`)

// ── Altyapı ───────────────────────────────────────────────────
const health = await fetch(`${BASE}/actuator/health`).then((r) => r.json()).catch(() => null)
check('Sağlık kontrolü UP', health?.status === 'UP')
check('Kimliksiz API erişimi 401', (await api('/inventory')).status === 401)

const t = {}
for (const role of Object.keys(USERS)) t[role] = await login(role)
if (Object.values(t).some((v) => !v)) {
  console.log('\nGiriş yapılamayan hesaplar var; kalan testler atlandı.')
  process.exit(1)
}

// ── Rol yetki matrisi (sunucu tarafı) ─────────────────────────
const expect = async (role, path, status, method = 'GET', body) => {
  const r = await api(path, { token: t[role], method, body })
  check(`${role} ${method} ${path} → ${status}`, r.status === status, `HTTP ${r.status}`)
}
await expect('warehouse', '/sales/summary', 403)
await expect('chef', '/expenses', 403)
await expect('accountant', '/users', 403)
await expect('accountant', '/expenses/0/finalize', 403, 'PUT')
await expect('chef', '/expenses/0/submit', 403, 'PUT')
await expect('warehouse', '/analytics/menu-pricing', 403)
await expect('chef', '/analytics/menu-pricing', 200)
await expect('manager', '/chat/unread', 200)
await expect('manager', '/reports/summary', 200)
await expect('advisor', '/reports/vat', 200)
await expect('advisor', '/reports/journal', 200)
await expect('accountant', '/reports/z-report', 200)
await expect('chef', '/recipes', 200)
await expect('warehouse', '/inventory/pending-deliveries', 200)
await expect('admin', '/audit-logs?limit=5', 200)
// Hiçbir rol başka rolün işini yapamaz
await expect('admin', '/expenses/0/finalize', 403, 'PUT')
await expect('admin', '/expenses/0/approve', 403, 'PUT')
await expect('manager', '/audit-logs?limit=5', 403)
await expect('manager', '/users', 403)
await expect('accountant', '/expenses/0/approve', 403, 'PUT')
await expect('cashier', '/expenses/search', 403)
await expect('cashier', '/pos/tables', 200)
await expect('chef', '/pos/kitchen', 200)
await expect('accountant', '/reports/cash-report?granularity=month', 200)
await expect('cashier', '/reports/cash-report', 403)

const journal = await api('/reports/journal', { token: t.advisor })
check('Yevmiye dökümü borç = alacak', journal.data?.balanced === true, `${journal.data?.totalDebit} / ${journal.data?.totalCredit}`)

// ── WebSocket ─────────────────────────────────────────────────
{
  const anon = await stompConnect(null)
  await wait(1200)
  check('WebSocket: token olmadan bağlantı reddedilir', !anon.frames.some((f) => f.startsWith('CONNECTED')))
  try { anon.ws.close() } catch (_) { /* yoksay */ }

  const wh = await stompConnect(t.warehouse)
  await wait(1000)
  check('WebSocket: geçerli token ile bağlanır', wh.frames.some((f) => f.startsWith('CONNECTED')))
  wh.ws.send('SUBSCRIBE\nid:x\ndestination:/topic/chat/cashier\n\n\0')
  await wait(1000)
  check('WebSocket: depo → kasa kanalı aboneliği reddedilir', wh.frames.some((f) => f.startsWith('ERROR')))
  try { wh.ws.close() } catch (_) { /* yoksay */ }
}

// ── Yazma modu: uçtan uca iş akışı (yalnızca demo / test) ────
if (WRITE) {
  const today = new Date().toISOString().slice(0, 10)
  const created = await api('/expenses', {
    token: t.accountant, method: 'POST',
    body: { title: `Duman testi gideri ${Date.now()}`, category: 'VARIABLE', subType: 'CONSUMABLES', amount: 120, vatRate: 20,
      expenseDate: today, invoiceNumber: `SMOKE-${Date.now()}`, counterparty: 'Test Tedarik' },
  })
  const id = created.data?.id
  check('Gider kaydı oluşturuldu', created.status === 201 && !!id, created.message)
  check('Görevler ayrılığı: muhasebe onaylayamaz', (await api(`/expenses/${id}/approve`, { token: t.accountant, method: 'PUT' })).status === 403)
  check('Müdür onaylar', (await api(`/expenses/${id}/approve`, { token: t.manager, method: 'PUT' })).status === 200)
  check('Kısmi ödeme', (await api(`/expenses/${id}/pay`, { token: t.accountant, method: 'POST', body: { amount: 20, method: 'CASH' } })).data?.paymentStatus === 'PARTIAL')
  check('Fazla ödeme reddedilir', (await api(`/expenses/${id}/pay`, { token: t.accountant, method: 'POST', body: { amount: 1000 } })).status === 409)
  check('Gönderilmeden deftere işlenemez', (await api(`/expenses/${id}/finalize`, { token: t.advisor, method: 'PUT' })).status === 409)
  check('Muhasebe faturalandırıp müşavire gönderir', (await api(`/expenses/${id}/submit`, { token: t.accountant, method: 'PUT', body: { note: 'Duman testi' } })).data?.sentToAdvisor === true)
  check('Mali müşavir onaylayıp deftere işler', (await api(`/expenses/${id}/finalize`, { token: t.advisor, method: 'PUT', body: { note: 'Belge uygun' } })).data?.status === 'FINALIZED')
  check('Kesinleşen kayıt reddedilemez', (await api(`/expenses/${id}/reject`, { token: t.manager, method: 'PUT', body: { reason: 'Duman testi tahrifat denemesi' } })).status === 409)

  const recipes = (await api('/recipes', { token: t.manager })).data || []
  const recipe = recipes.find((r) => r.costComplete) || recipes[0]
  if (recipe) {
    const sale = await api('/sales/order', { token: t.cashier, method: 'POST',
      body: { tableNo: 'Duman Testi', paymentMethod: 'CASH', items: [{ recipeId: recipe.id, quantity: 1 }] } })
    const line = sale.data?.[0]
    check('POS satışı (fiyat sunucuda)', sale.status === 201 && Number(line?.unitPrice) === Number(recipe.salePrice), sale.message)
    if (line) {
      check('Kasiyer satışı iptal edemez', (await api(`/sales/${line.id}/void`, { token: t.cashier, method: 'POST', body: { reason: 'Duman testi' } })).status === 403)
      check('Müdür gerekçeli iptal eder', (await api(`/sales/${line.id}/void`, { token: t.manager, method: 'POST', body: { reason: 'Duman testi iptali' } })).data?.status === 'VOIDED')
    }
  } else {
    check('POS satışı için reçete bulundu', false, 'menüde reçete yok')
  }
}

console.log(failures === 0 ? '\nTüm kontroller başarılı.' : `\n${failures} kontrol başarısız.`)
process.exit(failures === 0 ? 0 : 1)
