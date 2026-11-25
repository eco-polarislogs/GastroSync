#!/usr/bin/env node
/** Mevcut anahtar tabanlı çeviri dosyalarından (TRANSLATIONS.tr/en/de/ar) Türkçe metin -> çeviri eşlemesini sözlüğe ekler */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/phrases.json'), 'utf8'))
let added = 0
for (const rel of ['src/utils/translations.js', 'mobile/src/data/translations.js']) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const tmp = path.join(ROOT, 'i18n', `.tmp-${path.basename(path.dirname(rel))}.mjs`)
  fs.writeFileSync(tmp, src.replace(/^import .*$/gm, ''))
  const mod = await import(pathToFileURL(tmp).href + `?t=${Date.now()}`)
  fs.unlinkSync(tmp)
  const T = mod.TRANSLATIONS
  for (const [k, tr] of Object.entries(T.tr || {})) {
    if (typeof tr !== 'string') continue
    const v = [T.en?.[k], T.de?.[k], T.ar?.[k]]
    if (v.some((x) => typeof x !== 'string' || !x.trim())) continue
    const key = tr.replace(/\s+/g, ' ').trim()
    if (!out[key]) { out[key] = v.map((x) => x.replace(/\s+/g, ' ').trim()); added++ }
  }
}
fs.writeFileSync(path.join(ROOT, 'i18n/phrases.json'), JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"'))
console.log(`Mevcut çeviri dosyalarından ${added} metin eklendi; sözlük: ${Object.keys(out).length}`)
