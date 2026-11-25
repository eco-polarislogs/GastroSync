// Ortak biçimlendirme ve etiket yardımcıları (tüm ekranlar aynı dili konuşsun)

const trMoney = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const trNumber = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 })

export const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export const money = (v) => `${trMoney.format(toNumber(v))} ₺`
export const num = (v) => trNumber.format(toNumber(v))
export const pct = (v) => `%${toNumber(v).toFixed(1)}`

export const formatDate = (v) => {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('tr-TR')
}

export const formatDateTime = (v) => {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const todayIso = () => {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export const currentPeriod = () => todayIso().slice(0, 7)

export const EXPENSE_STATUS = {
  PENDING_APPROVAL: { label: 'Onay Bekliyor', tone: 'warning' },
  APPROVED: { label: 'Onaylandı', tone: 'info' },
  FINALIZED: { label: 'Deftere İşlendi', tone: 'success' },
  REJECTED: { label: 'Reddedildi · Düzeltme', tone: 'danger' },
}

export const PAYMENT_STATUS = {
  UNPAID: { label: 'Ödenmedi', tone: 'danger' },
  PARTIAL: { label: 'Kısmi Ödendi', tone: 'warning' },
  PAID: { label: 'Ödendi', tone: 'success' },
}

export const SALES_PAYMENT = {
  CASH: 'Nakit',
  CREDIT_CARD: 'Kredi Kartı',
  MEAL_CARD: 'Yemek Kartı',
}

export const EXPENSE_PAYMENT = {
  CASH: 'Kasa (Nakit)',
  BANK_TRANSFER: 'Banka / Havale',
  CREDIT_CARD: 'Şirket Kredi Kartı',
}

export const EXPENSE_SUBTYPES = {
  RENT: { label: 'Kira (İşyeri)', category: 'FIXED', vat: 0 },
  LABOR: { label: 'İşçilik & Maaşlar', category: 'FIXED', vat: 0 },
  ACCOUNTANT: { label: 'Mali Müşavirlik', category: 'FIXED', vat: 20 },
  ELECTRICITY: { label: 'Elektrik', category: 'VARIABLE', vat: 20 },
  WATER: { label: 'Su', category: 'VARIABLE', vat: 20 },
  GAS: { label: 'Doğalgaz', category: 'VARIABLE', vat: 20 },
  PHONE: { label: 'Telefon', category: 'VARIABLE', vat: 20 },
  INTERNET: { label: 'İnternet & Ağ', category: 'VARIABLE', vat: 20 },
  SGK: { label: 'SGK İşveren Primi', category: 'VARIABLE', vat: 0 },
  CONSUMABLES: { label: 'Sarf Malzeme', category: 'VARIABLE', vat: 20 },
  RENOVATION: { label: 'Tadilat & Bakım', category: 'VARIABLE', vat: 20 },
  LOGISTICS: { label: 'Lojistik & Nakliye', category: 'VARIABLE', vat: 20 },
  MARKETING: { label: 'Reklam & Tanıtım', category: 'VARIABLE', vat: 20 },
  TAX: { label: 'Vergi Tahakkuk / Ödemesi', category: 'VARIABLE', vat: 0 },
  RAW_MATERIAL: { label: 'Hammadde / Gıda Alımı', category: 'VARIABLE', vat: 1 },
  OTHER: { label: 'Diğer Giderler', category: 'VARIABLE', vat: 20 },
}

export const expenseTypeLabel = (code) => EXPENSE_SUBTYPES[code]?.label || code || '-'

export const STOCK_TX = {
  INBOUND: { label: 'Mal Kabul', tone: 'success', sign: '+' },
  OUTBOUND_SALE: { label: 'Satış Tüketimi', tone: 'info', sign: '-' },
  SALE_REVERSAL: { label: 'Satış İptali İadesi', tone: 'neutral', sign: '+' },
  WASTE: { label: 'Fire / Zayiat', tone: 'danger', sign: '-' },
  ADJUSTMENT: { label: 'Sayım Farkı', tone: 'warning', sign: '±' },
}

/** Seçili arayüz diline göre tarih yerel ayarı (ay / gün adları için) */
export const appLocale = () => {
  let lang = 'tr'
  try { lang = localStorage.getItem('gastrosync_lang') || 'tr' } catch (_) { /* depolama yok */ }
  return ({ tr: 'tr-TR', en: 'en-GB', de: 'de-DE', ar: 'ar' })[lang] || 'tr-TR'
}
