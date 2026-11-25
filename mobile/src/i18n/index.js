// Mobil arayüz çevirisi: web ile aynı sözlük (i18n/phrases.json -> node scripts/i18n-extract.mjs --sync)
// ve aynı çeviri çekirdeği. Ortak Text / TextInput bileşenleri sabit arayüz metinlerini seçili dile çevirir;
// kullanıcının yazdığı içerik sözlükte olmadığı için değişmez.
import React from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import phrases from './phrases.json';
import { createTranslator } from './translate';

let AsyncStorage = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch (_) { AsyncStorage = null; }
const LANG_KEY = 'gastrosync_lang';
export const LANGUAGES = [
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

export const translate = createTranslator(phrases);

let currentLang = 'tr';
const listeners = new Set();

export const getI18nLang = () => currentLang;
export const setI18nLang = (lang) => {
  const next = LANGUAGES.some((l) => l.code === lang) ? lang : 'tr';
  if (next === currentLang) return;
  currentLang = next;
  // Seçim cihazda hatırlanır: uygulama yeniden açıldığında (giriş ekranı dahil) aynı dil gelir
  if (AsyncStorage) AsyncStorage.setItem(LANG_KEY, next).catch(() => {});
  listeners.forEach((l) => { try { l(next); } catch (_) { /* yoksay */ } });
};
if (AsyncStorage) {
  AsyncStorage.getItem(LANG_KEY).then((saved) => { if (saved && saved !== currentLang) setI18nLang(saved); }).catch(() => {});
}
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function useI18nLang() {
  return React.useSyncExternalStore(subscribe, getI18nLang, getI18nLang);
}

export const tx = (text, lang = currentLang) => translate(text, lang);

const translateChild = (c, lang) => (typeof c === 'string' ? translate(c, lang) : c);

/** react-native Text yerine: dize çocukları seçili dile çevirir (iç içe Text'ler kendi çevirisini yapar) */
export const Text = React.forwardRef(function I18nText({ children, ...props }, ref) {
  const lang = useI18nLang();
  if (lang === 'tr') return <RNText ref={ref} {...props}>{children}</RNText>;
  if (Array.isArray(children)) {
    return React.createElement(RNText, { ref, ...props }, ...children.map((c) => translateChild(c, lang)));
  }
  return <RNText ref={ref} {...props}>{translateChild(children, lang)}</RNText>;
});

/** react-native TextInput yerine: yalnızca yer tutucu (placeholder) çevrilir; yazılan değer değişmez */
export const TextInput = React.forwardRef(function I18nTextInput({ placeholder, ...props }, ref) {
  const lang = useI18nLang();
  return <RNTextInput ref={ref} placeholder={lang === 'tr' ? placeholder : translate(placeholder, lang)} {...props} />;
});
