#!/usr/bin/env node
/** i18n/parts/*.json parçalarını ana sözlüğe (i18n/phrases.json) ekler ve web / mobil kopyalarını günceller */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const main = path.join(ROOT, 'i18n/phrases.json')
const out = JSON.parse(fs.readFileSync(main, 'utf8'))
const dir = path.join(ROOT, 'i18n/parts')
let n = 0
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const part = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  for (const [k, v] of Object.entries(part)) {
    if (!Array.isArray(v) || v.length < 3) throw new Error(`${f}: eksik çeviri -> ${k}`)
    out[k.replace(/\s+/g, ' ').trim()] = v
    n++
  }
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b, 'tr')))
fs.writeFileSync(main, '{\n' + Object.entries(sorted).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n')
for (const target of ['src/i18n/phrases.json', 'mobile/src/i18n/phrases.json']) fs.writeFileSync(path.join(ROOT, target), JSON.stringify(sorted))
console.log(`Parçalardan ${n} çeviri; sözlük toplam ${Object.keys(sorted).length} metin (web + mobil güncellendi)`)
