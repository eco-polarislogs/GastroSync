#!/usr/bin/env node
/**
 * Mali Müşavir incelemesi için demo verisi.
 *
 * Kayıtları doğrudan veritabanına yazmaz; gerçek iş akışını API üzerinden yürütür:
 *   Muhasebe kaydeder → İşletme Müdürü onaylar → Muhasebe öder (tam / kısmi / vadeli)
 *   → Muhasebe faturalandırıp Mali Müşavire gönderir.
 * Böylece görevler ayrılığı, denetim izi ve rol bildirimleri gerçek akıştaki gibi oluşur.
 *
 * Bazı kayıtlar bilerek sorunludur (yurt dışı hizmet faturasız, fatura sınırını aşan perakende fiş,
 * önceki döneme ait fatura): Müşavir bunları gerekçeyle reddedip muhasebeye geri gönderebilir.
 *
 * Kullanım:  node scripts/seed-advisor-review.mjs [http://localhost:8080] [ŞİFRE]
 * Yalnızca demo / test ortamında kullanın (demo hesapları: accountant, manager).
 */
const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '')
const PASSWORD = process.argv[3] || '123456'
const now = new Date()
const PERIOD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const day = (d) => `${PERIOD}-${String(d).padStart(2, '0')}`
const nextMonthDay = (d) => {
  const n = new Date(now.getFullYear(), now.getMonth() + 1, d)
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) throw new Error(`${method} ${path} → ${res.status} ${json.message || ''}`)
  return json.data
}
const login = async (u) => (await call('POST', '/api/auth/login', null, { identifier: u, password: PASSWORD })).token

// pay: 'full' | sayı (kısmi tutar) | null (vadeli, ödenmedi)
const ITEMS = [
  { title: 'Kasım Ayı İşyeri Kirası', subType: 'RENT', category: 'FIXED', amount: 85000, vatRate: 0, date: day(1),
    invoiceNumber: 'KRA-2026-11', counterparty: 'Mehmet Demir (Mülk Sahibi)', pay: 'full', method: 'BANK_TRANSFER',
    note: 'Kira sözleşmesi 01.01.2026; %20 stopaj muhtasar beyannamede.', submitNote: 'Gider pusulası ve dekont ekte.' },
  { title: 'Elektrik Faturası — Ekim/Kasım Okuması', subType: 'ELECTRICITY', category: 'VARIABLE', amount: 18420, vatRate: 20, date: day(5),
    invoiceNumber: 'CKB2026000418273', counterparty: 'CK Boğaziçi Elektrik Perakende Satış A.Ş.', pay: 'full', method: 'BANK_TRANSFER',
    note: 'Otomatik ödeme talimatı.', submitNote: 'e-Fatura.' },
  { title: 'Doğalgaz Faturası', subType: 'GAS', category: 'VARIABLE', amount: 9860, vatRate: 20, date: day(7),
    invoiceNumber: 'IGD2026110093321', counterparty: 'İGDAŞ İstanbul Gaz Dağıtım A.Ş.', pay: 'full', method: 'BANK_TRANSFER',
    note: 'Mutfak ocakları + kombi.', submitNote: 'e-Fatura.' },
  { title: 'Paket Servis Ambalaj ve Kap Alımı', subType: 'CONSUMABLES', category: 'VARIABLE', amount: 6240, vatRate: 20, date: day(9),
    invoiceNumber: 'AMB2026000771', counterparty: 'Ege Ambalaj San. ve Tic. Ltd. Şti.', pay: null, dueDate: nextMonthDay(15),
    note: '30 gün vadeli alım.', submitNote: 'Vadeli fatura (tahakkuk esası); ödeme vadesinde yapılacak.' },
  { title: 'Temizlik ve Hijyen Malzemesi', subType: 'CONSUMABLES', category: 'VARIABLE', amount: 3480, vatRate: 20, date: day(11),
    invoiceNumber: 'MTR2026118842', counterparty: 'Metro Grosmarket Bakırköy', pay: 2000, method: 'CREDIT_CARD',
    note: 'Bulaşık deterjanı, yüzey dezenfektanı, eldiven.', submitNote: 'Kısmi ödeme; kalan bakiye ay sonunda.' },
  { title: 'Soğuk Zincir Nakliye Hizmeti', subType: 'LOGISTICS', category: 'VARIABLE', amount: 5900, vatRate: 20, date: day(12),
    invoiceNumber: 'KZL2026004417', counterparty: 'Kuzey Lojistik Ltd. Şti.', pay: 'full', method: 'BANK_TRANSFER',
    note: 'Et ve süt ürünleri frigorifik taşıma.', submitNote: 'İrsaliyeli e-Fatura.' },
  { title: 'SGK İşveren Primi (Ekim Tahakkuku)', subType: 'SGK', category: 'VARIABLE', amount: 41350, vatRate: 0, date: day(14),
    invoiceNumber: 'SGK-TAH-2026-10', counterparty: 'Sosyal Güvenlik Kurumu', pay: 'full', method: 'BANK_TRANSFER',
    note: 'Ekim hizmet dönemi, Kasım ödemesi.', submitNote: 'Tahakkuk fişi ve banka dekontu ekte.' },
  // --- Ret pratiği için bilerek sorunlu kayıtlar ---
  { title: 'Instagram Sponsorlu Reklam', subType: 'MARKETING', category: 'VARIABLE', amount: 4500, vatRate: 20, date: day(15),
    invoiceNumber: 'KK-EKSTRE-1125', counterparty: 'Meta Platforms Ireland Ltd.', pay: 'full', method: 'CREDIT_CARD',
    note: 'Kredi kartı ekstresinden girildi, fatura gelmedi.',
    submitNote: 'Belge olarak kart ekstresi eklendi.' },
  { title: 'Mutfak Davlumbaz Bakım ve Filtre Değişimi', subType: 'RENOVATION', category: 'VARIABLE', amount: 12750, vatRate: 20, date: day(17),
    invoiceNumber: 'FIS-0042', counterparty: 'Usta Kemal (Serbest Çalışan)', pay: 'full', method: 'CASH',
    note: 'Perakende satış fişi ile ödendi.', submitNote: 'Perakende fiş; usta fatura kesmedi.' },
  { title: 'Fiber İnternet Faturası', subType: 'INTERNET', category: 'VARIABLE', amount: 1250, vatRate: 20, date: day(18),
    invoiceNumber: 'TT2026100552190', counterparty: 'Türk Telekomünikasyon A.Ş.', pay: 'full', method: 'BANK_TRANSFER',
    note: 'Ekim dönemi faturası, geç ulaştı.', submitNote: 'Fatura tarihi 28.10.2026.' },
]

const acc = await login('accountant')
const mgr = await login('manager')
const existing = new Set((await call('GET', `/api/expenses?period=${PERIOD}`, acc)).map((e) => e.invoiceNumber))
let created = 0
for (const it of ITEMS) {
  if (existing.has(it.invoiceNumber)) { console.log(`= zaten var: ${it.title}`); continue }
  const e = await call('POST', '/api/expenses', acc, {
    title: it.title, category: it.category, subType: it.subType, amount: it.amount, period: PERIOD, expenseDate: it.date,
    note: it.note, vatRate: it.vatRate, invoiceNumber: it.invoiceNumber, counterparty: it.counterparty,
    dueDate: it.dueDate, paymentStatus: 'UNPAID',
  })
  await call('PUT', `/api/expenses/${e.id}/approve`, mgr)
  if (it.pay === 'full') await call('POST', `/api/expenses/${e.id}/pay`, acc, { method: it.method })
  else if (typeof it.pay === 'number') await call('POST', `/api/expenses/${e.id}/pay`, acc, { amount: it.pay, method: it.method })
  await call('PUT', `/api/expenses/${e.id}/submit`, acc, { note: it.submitNote })
  created++
  console.log(`+ #${e.id} ${it.title} (${it.amount.toLocaleString('tr-TR')} ₺) → Müşavir incelemesinde`)
}
console.log(`\n${created} yeni kayıt Mali Müşavir incelemesine gönderildi (dönem ${PERIOD}).`)
