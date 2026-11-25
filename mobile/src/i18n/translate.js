/**
 * Metin tabanlı çeviri çekirdeği (web ve mobilde aynı kod; sözlük i18n/phrases.json'dan kopyalanır).
 *
 * Sözlük: { "Türkçe metin": ["English", "Deutsch", "العربية"] }
 * Şablon metinler kalıp olarak saklanır: "{0} hazır" -> "{0} ready". Yer tutucu değerleri de (ör. bir durum adı)
 * sözlükte varsa çevrilir; yoksa olduğu gibi kalır.
 * Kullanıcının yazdığı içerik (ürün adı, not, gerekçe, isim) sözlükte bulunmadığı için değişmez.
 */
const LANG_INDEX = { en: 0, de: 1, ar: 2 }
const HAS_LETTER = /[A-Za-zÇĞİÖŞÜçğıöşü؀-ۿ]/

export function createTranslator(phrases) {
  const exact = new Map()
  const patterns = []
  for (const [tr, tx] of Object.entries(phrases || {})) {
    if (!Array.isArray(tx)) continue
    if (/\{\d+\}/.test(tr)) {
      const parts = tr.split(/\{(\d+)\}/)
      // parts: [lit, idx, lit, idx, lit...]
      const literals = parts.filter((_, i) => i % 2 === 0)
      const longest = literals.reduce((a, b) => (b.length > a.length ? b : a), '')
      if (longest.trim().length < 2) continue
      const re = new RegExp('^' + parts.map((p, i) => (i % 2 === 0 ? escapeRe(p) : '([\\s\\S]+?)')).join('') + '$')
      const order = parts.filter((_, i) => i % 2 === 1).map(Number)
      patterns.push({ re, order, tx, anchor: longest.trim(), size: literals.join('').length })
    } else {
      exact.set(tr, tx)
    }
  }
  patterns.sort((a, b) => b.size - a.size)

  const lookupExact = (core, idx) => {
    const t = exact.get(core)
    return t && t[idx] ? t[idx] : null
  }

  function translateCore(core, idx, depth = 0) {
    const direct = lookupExact(core, idx)
    if (direct != null) return direct
    if (depth > 1) return null
    for (const p of patterns) {
      if (!core.includes(p.anchor)) continue
      const m = p.re.exec(core)
      if (!m || !p.tx[idx]) continue
      const values = {}
      p.order.forEach((n, i) => {
        const v = m[i + 1]
        const vt = v && v.trim() ? translateCore(v.trim(), idx, depth + 1) : null
        values[n] = vt != null ? v.replace(v.trim(), vt) : v
      })
      return p.tx[idx].replace(/\{(\d+)\}/g, (_, n) => (values[n] != null ? values[n] : ''))
    }
    // Birleşik etiketler: "Hazırlanan · 3", "Tümü · 7" — her parça ayrı çevrilir
    if (core.includes(' · ')) {
      let changed = false
      const parts = core.split(' · ').map((part) => {
        const t = part.trim() ? translateCore(part.trim(), idx, depth + 1) : null
        if (t != null) { changed = true; return t }
        return part
      })
      if (changed) return parts.join(' · ')
    }
    // "Etiket: değer" — bilinen etiket çevrilir, değer (çoğunlukla kullanıcı içeriği) korunur
    const colon = /^([^:]{2,40}):\s+([\s\S]+)$/.exec(core)
    if (colon) {
      const label = lookupExact(colon[1] + ':', idx) ?? lookupExact(colon[1], idx)
      if (label != null) return (label.endsWith(':') ? label : label + ':') + ' ' + colon[2]
    }
    return null
  }

  /** Metni hedef dile çevirir; bulunamazsa aynen döner. Baştaki / sondaki boşluklar korunur. */
  return function translate(text, lang) {
    if (typeof text !== 'string' || !text || !lang || lang === 'tr') return text
    const idx = LANG_INDEX[lang]
    if (idx === undefined) return text
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
    const core = m[2].replace(/\s+/g, ' ')
    if (core.length < 2 || !HAS_LETTER.test(core)) return text
    const out = translateCore(core, idx)
    return out == null ? text : m[1] + out + m[3]
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
