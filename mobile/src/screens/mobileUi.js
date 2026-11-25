import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Text, TextInput } from '../i18n';
import { THEME } from '../theme/tokens';

/** Yeni mobil ekranlar için küçük ortak bileşenler (Kasiyer, Mutfak, Kasa mutabakatı) */

export const money = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return `${(Number.isFinite(n) ? n : 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
};

/** Kısa tutar (kuruşsuz): dar alanlarda taşmayı önler */
export const moneyShort = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString('tr-TR')} ₺`;
};

export const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function Section({ title, right, children, style }) {
  return (
    <View style={[s.card, style]}>
      {(title || right) && (
        <View style={s.cardHeader}>
          {title ? <Text style={s.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Chip({ label, active, onPress, tone }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={[s.chip, active && s.chipActive, tone === 'danger' && !active && { borderColor: '#fecaca' }]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Eşit genişlikli sekme çubuğu (uzun çip satırları yerine) */
export function Tabs({ tabs, value, onChange }) {
  return (
    <View style={s.tabs}>
      {tabs.map(([id, label]) => (
        <TouchableOpacity key={id} onPress={() => onChange(id)} activeOpacity={0.8} style={[s.tab, value === id && s.tabActive]}>
          <Text style={[s.tabText, value === id && s.tabTextActive]} numberOfLines={1}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** − değer + */
export function Stepper({ value, onChange, min = 1, max = 99 }) {
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        <Text style={[s.stepTxt, value <= min && { opacity: 0.3 }]}>−</Text>
      </TouchableOpacity>
      <Text style={s.stepVal}>{value}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <Text style={[s.stepTxt, value >= max && { opacity: 0.3 }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export function Btn({ label, onPress, variant = 'primary', disabled, small, style }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
      style={[s.btn, small && s.btnSmall, { backgroundColor: v.bg, borderColor: v.border }, disabled && { opacity: 0.45 }, style]}>
      <Text style={[s.btnText, small && { fontSize: 12 }, { color: v.color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const VARIANTS = {
  primary: { bg: THEME.colors.accentDark, border: THEME.colors.accentDark, color: '#fff' },
  secondary: { bg: '#fff', border: THEME.colors.border, color: THEME.colors.textPrimary },
  danger: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
};

export function Badge({ label, tone = 'neutral' }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <View style={[s.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[s.badgeText, { color: t.color }]}>{label}</Text>
    </View>
  );
}

const TONES = {
  neutral: { bg: '#f1f5f9', border: '#e2e8f0', color: '#475569' },
  success: { bg: '#ecfdf5', border: '#a7f3d0', color: '#047857' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  danger: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
};

export function Stat({ label, value, hint, tone }) {
  const t = TONES[tone] || null;
  return (
    <View style={[s.stat, t && { borderColor: t.border }]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, t && { color: t.color }]}>{value}</Text>
      {hint ? <Text style={s.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props) {
  return <TextInput placeholderTextColor="#94a3b8" {...props} style={[s.input, props.style]} />;
}

export function Empty({ title, hint }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 22 }}>
      <Text style={{ fontSize: 26 }}>📭</Text>
      <Text style={{ fontWeight: '800', color: THEME.colors.textSecondary, marginTop: 6 }}>{title}</Text>
      {hint ? <Text style={{ color: THEME.colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>{hint}</Text> : null}
    </View>
  );
}

/** Uzun listeler: 15'er kayıt, "Daha fazla göster" ile genişler */
export function useMore(list, size = 15) {
  const [count, setCount] = React.useState(size);
  React.useEffect(() => { setCount(size); }, [list?.length, size]);
  const items = (list || []).slice(0, count);
  const rest = (list || []).length - items.length;
  const more = rest > 0 ? (
    <TouchableOpacity onPress={() => setCount((c) => c + size)} style={s.more} activeOpacity={0.8}>
      <Text style={s.moreText}>Daha fazla göster ({Math.min(size, rest)} / kalan {rest})</Text>
    </TouchableOpacity>
  ) : null;
  return { items, more };
}

export const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: THEME.colors.border, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: THEME.colors.textPrimary },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#fff', marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: THEME.colors.accentDark, borderColor: THEME.colors.accentDark },
  chipText: { fontSize: 12, fontWeight: '700', color: THEME.colors.textSecondary },
  chipTextActive: { color: '#fff' },
  btn: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 10 },
  btnText: { fontWeight: '800', fontSize: 13 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  stat: { flexGrow: 1, flexBasis: '46%', backgroundColor: '#fff', borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  statLabel: { fontSize: 11, color: THEME.colors.textMuted, fontWeight: '700' },
  statValue: { fontSize: 18, fontWeight: '900', color: THEME.colors.textPrimary, marginTop: 4 },
  statHint: { fontSize: 11, color: THEME.colors.textMuted, marginTop: 2 },
  input: { borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: THEME.colors.textPrimary, backgroundColor: '#f8fafc' },
  more: { marginVertical: 10, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: '#ecfdf5', alignItems: 'center' },
  moreText: { color: '#047857', fontWeight: '800', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  muted: { color: THEME.colors.textMuted, fontSize: 12 },
  label: { fontSize: 12, fontWeight: '800', color: THEME.colors.textSecondary, marginBottom: 6, marginTop: 10 },
  tabs: { flexDirection: 'row', backgroundColor: '#e8f2ec', borderRadius: 12, padding: 3, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  tabText: { fontSize: 13, fontWeight: '700', color: THEME.colors.textSecondary },
  tabTextActive: { color: THEME.colors.accentDark, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 10, backgroundColor: '#f8fafc', alignSelf: 'flex-start' },
  stepBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  stepTxt: { fontSize: 18, fontWeight: '900', color: THEME.colors.accentDark },
  stepVal: { minWidth: 30, textAlign: 'center', fontSize: 15, fontWeight: '900', color: THEME.colors.textPrimary },
});
