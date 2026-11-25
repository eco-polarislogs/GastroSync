import phrases from './phrases.json'
import { createTranslator } from './translate'

/**
 * Web arayüz çevirisi.
 *  - tx(metin, dil): kodda doğrudan kullanım
 *  - startAutoTranslate(): ekrana basılan arayüz metinlerini (metin düğümleri ve placeholder / title / aria-label)
 *    seçili dile çevirir; dil değişince tüm ekran yeniden çevrilir, Türkçeye dönünce özgün metin geri gelir.
 *    Form alanlarına yazılan değerler, data-no-translate / translate="no" işaretli alanlar ve sözlükte olmayan
 *    içerik (kullanıcının yazdıkları) değişmez.
 */
export const translate = createTranslator(phrases)
export const tx = (text, lang) => translate(text, lang)

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt']
const SKIP_SELECTOR = '[data-no-translate],[translate="no"],script,style,textarea,code,pre,[contenteditable="true"]'
const textState = new WeakMap() // düğüm -> { orig, shown }

export function startAutoTranslate(getLang, subscribe) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  let lang = getLang()

  const skip = (el) => !el || (el.closest && el.closest(SKIP_SELECTOR))

  const handleText = (node) => {
    const parent = node.parentElement
    if (skip(parent)) return
    const current = node.nodeValue
    let st = textState.get(node)
    if (!st || (current !== st.shown && current !== st.orig)) {
      st = { orig: current, shown: current }
      textState.set(node, st)
    }
    const next = lang === 'tr' ? st.orig : translate(st.orig, lang)
    if (next !== current) {
      st.shown = next
      node.nodeValue = next
    } else {
      st.shown = current
    }
  }

  const handleAttrs = (el) => {
    if (skip(el)) return
    for (const a of ATTRS) {
      if (!el.hasAttribute || !el.hasAttribute(a)) continue
      const key = `data-i18n-${a}`
      const cur = el.getAttribute(a)
      const shownKey = `data-i18n-shown-${a}`
      let orig = el.getAttribute(key)
      if (orig == null || (cur !== el.getAttribute(shownKey) && cur !== orig)) {
        orig = cur
        el.setAttribute(key, orig)
      }
      const next = lang === 'tr' ? orig : translate(orig, lang)
      el.setAttribute(shownKey, next)
      if (next !== cur) el.setAttribute(a, next)
    }
  }

  const walk = (root) => {
    if (!root) return
    if (root.nodeType === Node.TEXT_NODE) { handleText(root); return }
    if (root.nodeType !== Node.ELEMENT_NODE) return
    if (skip(root)) return
    handleAttrs(root)
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    let n = tw.nextNode()
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) handleText(n)
      else handleAttrs(n)
      n = tw.nextNode()
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') handleText(m.target)
      else if (m.type === 'attributes') { if (ATTRS.includes(m.attributeName)) handleAttrs(m.target) }
      else m.addedNodes.forEach(walk)
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS })
  walk(document.body)

  const unsub = subscribe ? subscribe(() => {
    const l = getLang()
    if (l !== lang) { lang = l; walk(document.body) }
  }) : null
  return () => { observer.disconnect(); if (unsub) unsub() }
}
