#!/usr/bin/env node
/**
 * GastroSync marka varlıkları üreticisi.
 *
 * Konsept: merkezde servis kubbesi (cloche — restoran / mutfaktan masaya), etrafında iki yönlü senkron okları
 * (kasa, mutfak, depo ve muhasebenin anlık eşitlenmesi = "Sync"). Zümrüt yeşili ana renk, kehribar vurgu.
 *
 * Kullanım:  node branding/build-brand.mjs [sharp-modül-klasörü]
 *  - branding/*.svg kaynakları yazılır
 *  - mobile/assets (ikon, Android uyarlanabilir ikon katmanları, giriş logosu, favicon, açılış ikonu)
 *    ve public/ (favicon.svg, logo.svg, logo.png) PNG / SVG çıktıları üretilir
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(process.argv[2] ? path.join(process.argv[2], 'package.json') : import.meta.url)
const sharp = require('sharp')

const C = {
  deep: '#064E3B', mid: '#047857', brand: '#10B981', mint: '#ECFDF5', amber: '#FBBF24', ink: '#0F172A',
}

/** Merkezi (0,0) olan işaret; yarıçap ≈ 345 birim */
function mark({ ring = C.mint, arrow = C.amber, cloche = '#FFFFFF', shine = C.brand, mono = false } = {}) {
  const r = 300
  const pt = (deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)]
  // Üst yay 200°→318°, alt yay 20°→138°: ok başları kubbe ve tabaktan uzakta, boşluklara bakar
  const [s1x, s1y] = pt(200); const [e1x, e1y] = pt(318)
  const [s2x, s2y] = pt(20); const [e2x, e2y] = pt(138)
  const head = (deg) => {
    const [ex, ey] = pt(deg)
    const t = [-Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)] // saat yönü teğet
    const n = [-t[1], t[0]]
    const tip = [ex + 92 * t[0], ey + 92 * t[1]]
    const b = [ex - 4 * t[0], ey - 4 * t[1]]
    const p1 = [b[0] + 70 * n[0], b[1] + 70 * n[1]]
    const p2 = [b[0] - 70 * n[0], b[1] - 70 * n[1]]
    return `M${tip[0].toFixed(1)} ${tip[1].toFixed(1)} L${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)} Z`
  }
  return `
    <g fill="none" stroke="${ring}" stroke-width="60" stroke-linecap="round">
      <path d="M${s1x.toFixed(1)} ${s1y.toFixed(1)} A${r} ${r} 0 0 1 ${e1x.toFixed(1)} ${e1y.toFixed(1)}"/>
      <path d="M${s2x.toFixed(1)} ${s2y.toFixed(1)} A${r} ${r} 0 0 1 ${e2x.toFixed(1)} ${e2y.toFixed(1)}"/>
    </g>
    <path d="${head(318)}" fill="${arrow}" stroke="${arrow}" stroke-width="10" stroke-linejoin="round"/>
    <path d="${head(138)}" fill="${arrow}" stroke="${arrow}" stroke-width="10" stroke-linejoin="round"/>
    <g fill="${cloche}">
      <circle cx="0" cy="-122" r="27"/>
      <path d="M-168 74 A168 168 0 0 1 168 74 Z"/>
      <rect x="-214" y="88" width="428" height="42" rx="21"/>
    </g>
    ${mono ? '' : `<path d="M-112 32 A118 118 0 0 1 -38 -58" fill="none" stroke="${shine}" stroke-width="20" stroke-linecap="round" opacity="0.55"/>`}
    <circle cx="0" cy="0" r="0" fill="none"/>`
}

const svg = (w, h, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${extra}${body}</svg>\n`

const gradient = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${C.deep}"/><stop offset="0.55" stop-color="${C.mid}"/><stop offset="1" stop-color="${C.brand}"/>
</linearGradient></defs>`

// 1) Uygulama ikonu (yuvarlatılmış kare zemin + işaret)
const icon = svg(1024, 1024, `<rect width="1024" height="1024" rx="228" fill="url(#g)"/><g transform="translate(512 520) scale(0.92)">${mark()}</g>`, gradient)
// 2) Android uyarlanabilir ikon: ön plan (güvenli alan içinde), arka plan, tek renk
const foreground = svg(1024, 1024, `<g transform="translate(512 520) scale(0.78)">${mark()}</g>`)
const background = svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#g)"/>`, gradient)
const monochrome = svg(1024, 1024, `<g transform="translate(512 520) scale(0.78)">${mark({ ring: '#FFFFFF', arrow: '#FFFFFF', cloche: '#FFFFFF', mono: true })}</g>`)
// 3) Yuvarlak rozet (giriş ekranı / üst bar logosu)
const badge = svg(512, 512, `<circle cx="256" cy="256" r="256" fill="url(#g)"/><g transform="translate(256 262) scale(0.5)">${mark()}</g>`, gradient)
// 4) Açılış (splash) ikonu: şeffaf zemin, koyu yeşil işaret
const splash = svg(1024, 1024, `<g transform="translate(512 520) scale(0.9)">${mark({ ring: C.mid, arrow: C.amber, cloche: C.deep, shine: C.brand })}</g>`)
// 5) Yatay logo (README / web)
const wordmark = (dark) => svg(1760, 420, `
  <g transform="translate(40 30)"><rect width="360" height="360" rx="82" fill="url(#g)"/><g transform="translate(180 184) scale(0.32)">${mark()}</g></g>
  <text x="450" y="235" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="170" font-weight="800" letter-spacing="-4"
        fill="${dark ? '#F8FAFC' : C.ink}">Gastro<tspan fill="${C.brand}">Sync</tspan></text>
  <text x="458" y="320" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="46" font-weight="600" letter-spacing="2"
        fill="${dark ? '#94A3B8' : '#475569'}">RESTORAN İŞLETİM PANELİ · WEB &amp; ANDROID</text>`, gradient)

const out = (rel, data) => { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return p }
const png = async (svgText, rel, size, opts = {}) => {
  const p = path.join(ROOT, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  let img = sharp(Buffer.from(svgText), { density: 300 }).resize(size.w ?? size, size.h ?? size)
  img = opts.flatten ? img.flatten({ background: opts.flatten }) : img
  await (opts.jpeg ? img.jpeg({ quality: 92 }) : img.png({ compressionLevel: 9 })).toFile(p)
}

out('branding/gastrosync-icon.svg', icon)
out('branding/gastrosync-mark-foreground.svg', foreground)
out('branding/gastrosync-mark-monochrome.svg', monochrome)
out('branding/gastrosync-badge.svg', badge)
out('branding/gastrosync-logo.svg', wordmark(false))
out('branding/gastrosync-logo-dark.svg', wordmark(true))
out('public/favicon.svg', icon)
out('public/logo.svg', badge)

await png(icon, 'mobile/assets/icon.png', 1024)
await png(foreground, 'mobile/assets/android-icon-foreground.png', 1024)
await png(background, 'mobile/assets/android-icon-background.png', 1024)
await png(monochrome, 'mobile/assets/android-icon-monochrome.png', 1024)
await png(splash, 'mobile/assets/splash-icon.png', 1024)
await png(icon, 'mobile/assets/favicon.png', 48)
await png(badge, 'mobile/assets/logo.png', 512)
await png(badge, 'public/logo.png', 512)
await png(wordmark(false), 'branding/gastrosync-logo.png', { w: 1760, h: 420 })
await png(wordmark(true), 'branding/gastrosync-logo-dark.png', { w: 1760, h: 420 })
await png(icon, 'branding/gastrosync-icon-512.png', 512)
console.log('Marka varlıkları üretildi.')
