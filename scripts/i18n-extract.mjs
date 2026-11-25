#!/usr/bin/env node
/**
 * GastroSync çeviri kapsamı aracı.
 *
 * Web (src/) ve mobil (mobile/src/) kaynaklarındaki Türkçe arayüz metinlerini Babel AST ile toplar:
 *  - JSX metinleri, string sabitleri ve şablon metinleri (`${x} hazır` -> "{0} hazır" kalıbı)
 * Çeviri sözlüğü: i18n/phrases.json  ->  { "Türkçe metin": ["English", "Deutsch", "العربية"] }
 *
 * Kullanım:
 *   node scripts/i18n-extract.mjs            kapsam raporu (dil başına eksik sayısı)
 *   node scripts/i18n-extract.mjs --missing  eksik metinleri i18n/missing.json dosyasına yazar
 *   node scripts/i18n-extract.mjs --sync     sözlüğü web ve mobil projelere kopyalar
 *   node scripts/i18n-extract.mjs --check    eksik varsa çıkış kodu 1 (CI)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import traverseMod from '@babel/traverse'

const traverse = traverseMod.default || traverseMod
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIRS = ['src', 'mobile/src', 'mobile/App.js']
const SKIP = [/[\\/]i18n[\\/]/, /translations\.js$/, /inventoryData\.js$/, /storage\.js$/, /__tests__/]
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/
const WORDY = /[A-Za-zÇĞİÖŞÜçğıöşü]{2,}/
/** Arayüz metni taşıyan JSX özellikleri ve nesne anahtarları */
const UI_ATTRS = new Set(['label', 'title', 'placeholder', 'hint', 'description', 'aria-label', 'alt', 'message', 'text', 'extra', 'subtitle', 'emptyText', 'confirmLabel', 'cancelLabel'])
const NON_UI_ATTRS = new Set(['className', 'style', 'key', 'testID', 'variant', 'tone', 'type', 'size', 'name', 'id', 'href', 'to', 'keyboardType',
  'autoComplete', 'rel', 'target', 'role', 'method', 'align', 'rowKey', 'icon', 'resizeMode', 'returnKeyType', 'autoCapitalize', 'textContentType', 'accept', 'inputMode', 'mode', 'value', 'defaultValue'])
const NON_UI_KEYS = new Set(['type', 'tone', 'variant', 'color', 'backgroundColor', 'borderColor', 'key', 'id', 'path', 'route', 'icon', 'code', 'method', 'status', 'role', 'screen', 'queryKey', 'sortKey', 'align', 'fontWeight', 'textAlign', 'flexDirection', 'alignItems', 'justifyContent', 'position', 'display'])
/** Türkçe karakter içermeyen ama arayüzde görünen tek kelime (Kaydet, Toplam, Nakit...) */
const looksLikeUiWord = (t) => /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}([ ][A-Za-zÇĞİÖŞÜçğıöşü()%:.,/·-]+)*[.:!?]?$/.test(t) || (/ /.test(t) && /^[A-ZÇĞİÖŞÜ0-9(✓⚠❌⏳🔒•%]/.test(t) && !/[{};=<>]/.test(t))

function files(p) {
  const abs = path.join(ROOT, p)
  if (!fs.existsSync(abs)) return []
  if (fs.statSync(abs).isFile()) return [abs]
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((d) => {
    const f = path.join(abs, d.name)
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : files(path.relative(ROOT, f))
    return /\.(jsx?|tsx?)$/.test(d.name) ? [f] : []
  })
}

const norm = (s) => s.replace(/\s+/g, ' ').trim()

export function extract() {
  const found = new Map()
  const add = (text, file, ui = false) => {
    const t = norm(text)
    if (t.length < 2 || !WORDY.test(t)) return
    if (!ui && !TURKISH.test(t) && !looksLikeUiWord(t)) return
    if (/^(\/|https?:|[a-z]+\.[a-z]+\(|import |@)/.test(t)) return
    // CSS / stil değerleri, renk kodları, teknik tanımlar
    if (/\d+px|#[0-9a-fA-F]{3,6}|rgba?\(|^[a-z-]+:[a-z-]|^[A-Z_]{3,}$|\.(png|jpg|svg|js|css)$/.test(t)) return
    const rec = found.get(t) || { count: 0, files: new Set() }
    rec.count += 1
    rec.files.add(path.relative(ROOT, file).replace(/\\/g, '/'))
    found.set(t, rec)
  }
  for (const f of DIRS.flatMap(files)) {
    if (SKIP.some((r) => r.test(f))) continue
    let ast
    try {
      ast = parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'], errorRecovery: true })
    } catch (_) { continue }
    traverse(ast, {
      JSXText(p) { add(p.node.value, f, true) },
      StringLiteral(p) {
        const parent = p.parent
        if (parent.type === 'ImportDeclaration' || parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportAllDeclaration') return
        if (parent.type === 'CallExpression' && (parent.callee?.object?.name === 'console' || ['require', 'useState'].includes(parent.callee?.name))) return
        if (parent.type === 'ObjectProperty' && parent.key === p.node) return
        if (parent.type === 'BinaryExpression' || parent.type === 'SwitchCase') return
        if (parent.type === 'JSXAttribute') {
          const n = parent.name?.name
          if (NON_UI_ATTRS.has(n)) return
          add(p.node.value, f, UI_ATTRS.has(n))
          return
        }
        if (parent.type === 'ObjectProperty') {
          const k = parent.key?.name ?? parent.key?.value
          if (NON_UI_KEYS.has(k)) return
          add(p.node.value, f, UI_ATTRS.has(k))
          return
        }
        add(p.node.value, f)
      },
      TemplateLiteral(p) {
        const q = p.node.quasis.map((x) => x.value.cooked ?? x.value.raw)
        let key = ''
        q.forEach((part, i) => { key += part; if (i < q.length - 1) key += `{${i}}` })
        add(key, f)
      },
    })
  }
  return found
}

function loadIgnore() {
  const p = path.join(ROOT, 'i18n', 'ignore.json')
  return new Set(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [])
}

function loadPhrases() {
  const p = path.join(ROOT, 'i18n', 'phrases.json')
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}
}

function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--sync')) {
    const phrases = loadPhrases()
    for (const target of ['src/i18n/phrases.json', 'mobile/src/i18n/phrases.json']) {
      fs.mkdirSync(path.dirname(path.join(ROOT, target)), { recursive: true })
      fs.writeFileSync(path.join(ROOT, target), JSON.stringify(phrases))
    }
    console.log(`Sözlük kopyalandı: ${Object.keys(phrases).length} metin`)
    return
  }
  const found = extract()
  for (const k of loadIgnore()) found.delete(k)
  // Yasal sayfalar (LegalPages) dört dilde ayrı yazılmıştır
  for (const [k, rec] of [...found]) if ([...rec.files].every((f) => f.endsWith('LegalPages.jsx'))) found.delete(k)
  const phrases = loadPhrases()
  const langs = ['en', 'de', 'ar']
  const missing = [...found.keys()].filter((k) => !Array.isArray(phrases[k]) || phrases[k].slice(0, 3).some((v) => !v))
  const pct = found.size ? Math.round(((found.size - missing.length) / found.size) * 1000) / 10 : 100
  console.log(`Arayüz metni: ${found.size} · çevrilmiş: ${found.size - missing.length} (%${pct}) · eksik: ${missing.length}`)
  langs.forEach((l, i) => {
    const miss = [...found.keys()].filter((k) => !phrases[k] || !phrases[k][i]).length
    console.log(`  ${l}: eksik ${miss}`)
  })
  if (args.has('--missing')) {
    const out = Object.fromEntries(missing
      .sort((a, b) => found.get(b).count - found.get(a).count || a.length - b.length)
      .map((k) => [k, [...found.get(k).files].slice(0, 2).join(', ')]))
    fs.writeFileSync(path.join(ROOT, 'i18n', 'missing.json'), JSON.stringify(out, null, 1))
    console.log('Eksikler: i18n/missing.json')
  }
  if (args.has('--check') && missing.length) process.exit(1)
}

main()
