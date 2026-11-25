import React from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Text, TextInput } from '../i18n';
import {
  apiFetchAuditLogs, apiFetchPeriods, apiClosePeriod, apiReopenPeriod, apiFetchVatReport,
} from '../services/api';
import { THEME } from '../theme/tokens';
import { Section, Chip, Btn, Badge, Input, Empty, money, s } from './mobileUi';

const fmtDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const AUDIT_ENTITIES = [
  ['', 'Tümü'], ['EXPENSE', 'Gider'], ['SALE', 'Satış'], ['CASH_CLOSING', 'Kasa'], ['INVENTORY', 'Stok'],
  ['RECIPE', 'Reçete'], ['USER', 'Personel'], ['CHECK', 'Adisyon'], ['PERIOD', 'Dönem'],
];

/**
 * Denetim izi (Yönetici / Mali Müşavir, salt okunur): kim, ne zaman, neyi değiştirdi.
 * Sunucu tarafı sayfalama + arama + kayıt türü filtresi (web ile aynı uç).
 */
export function AuditScreen({ showToast }) {
  const [query, setQuery] = React.useState('');
  const [entity, setEntity] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [page, setPage] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [last, setLast] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (nextPage, append) => {
    setLoading(true);
    const res = await apiFetchAuditLogs({ page: nextPage, size: 20, query: query.trim() || undefined, entity: entity || undefined });
    setLoading(false);
    if (!res.success) { showToast(`⚠️ ${res.message}`); return; }
    const d = res.data || {};
    setRows((prev) => (append ? [...prev, ...(d.content || [])] : d.content || []));
    setPage(nextPage);
    setTotal(d.totalElements || 0);
    setLast(nextPage + 1 >= (d.totalPages || 0));
  }, [query, entity, showToast]);

  // Arama yazarken her tuşta istek atmamak için kısa gecikme
  React.useEffect(() => {
    const t = setTimeout(() => load(0, false), 350);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <View>
      <View style={st.bar}>
        <TextInput
          style={st.search}
          placeholder="🔍 Kişi, işlem veya açıklama ara"
          placeholderTextColor={THEME.colors.textLight}
          value={query}
          onChangeText={setQuery}
        />
        <View style={[s.wrap, { marginTop: 8, marginBottom: 0 }]}>
          {AUDIT_ENTITIES.map(([id, label]) => (
            <Chip key={id || 'all'} label={label} active={entity === id} onPress={() => setEntity(id)} />
          ))}
        </View>
        <Text style={st.count}>{rows.length} / {total} kayıt</Text>
      </View>
      {!loading && rows.length === 0 && <Empty title="Kayıt yok" />}
      {rows.map((r) => (
        <View key={r.id} style={st.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={st.action} numberOfLines={1}>{r.action}</Text>
            <Text style={st.time}>{fmtDateTime(r.timestamp)}</Text>
          </View>
          <Text style={st.meta} numberOfLines={1}>
            {r.actor}{r.actorRole ? ` · ${r.actorRole}` : ''}{r.entityType ? ` · ${r.entityType}${r.entityId ? ` #${r.entityId}` : ''}` : ''}
          </Text>
          {!!r.detail && <Text style={st.detail} numberOfLines={3}>{r.detail}</Text>}
        </View>
      ))}
      {!last && (
        <Btn label={loading ? 'Yükleniyor…' : `Daha fazla göster (${total - rows.length})`} variant="secondary"
          disabled={loading} onPress={() => load(page + 1, true)} style={{ marginTop: 6 }} />
      )}
    </View>
  );
}

const PERIOD_STATUS = { OPEN: ['Açık', 'success'], CLOSED: ['Kapalı', 'neutral'] };

/**
 * Muhasebe dönemleri: Mali Müşavir dönemi kapatır (kapalı döneme kayıt / ödeme / düzeltme yapılamaz)
 * veya gerekçeyle yeniden açar. Diğer roller salt okunur görür.
 */
export function PeriodPanel({ can, showToast }) {
  const [list, setList] = React.useState([]);
  const [target, setTarget] = React.useState(null); // { period, mode: 'close'|'reopen' }
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await apiFetchPeriods();
    if (res.success) setList(res.data || []); else showToast(`⚠️ ${res.message}`);
  }, [showToast]);
  React.useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!target) return;
    if (target.mode === 'reopen' && text.trim().length < 10) { showToast('⚠️ Yeniden açma gerekçesi en az 10 karakter'); return; }
    setBusy(true);
    const res = target.mode === 'close'
      ? await apiClosePeriod(target.period, text.trim() || undefined)
      : await apiReopenPeriod(target.period, text.trim());
    setBusy(false);
    if (res.success) {
      showToast(target.mode === 'close' ? `🔒 ${target.period} dönemi kapatıldı` : `🔓 ${target.period} dönemi yeniden açıldı`);
      setTarget(null); setText(''); load();
    } else showToast(`❌ ${res.message}`);
  };

  return (
    <Section title="Muhasebe Dönemleri">
      {list.length === 0 && <Empty title="Dönem yok" />}
      {list.slice(0, 12).map((p) => {
        const [label, tone] = PERIOD_STATUS[p.status] || [p.status, 'neutral'];
        return (
          <View key={p.period} style={st.line}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontWeight: '800', color: THEME.colors.textPrimary }}>{p.period}</Text>
              <Text style={s.muted} numberOfLines={1}>
                {p.status === 'CLOSED' ? `${p.closedBy || ''} kapattı` : `${p.openItems || 0} açık kayıt`}
              </Text>
            </View>
            <Badge label={label} tone={tone} />
            {can('PERIOD_MANAGE') && p.status !== 'CLOSED' && p.canClose && (
              <Btn small label="Kapat" style={{ marginLeft: 8 }} onPress={() => { setTarget({ period: p.period, mode: 'close' }); setText(''); }} />
            )}
            {can('PERIOD_MANAGE') && p.status === 'CLOSED' && (
              <Btn small variant="secondary" label="Aç" style={{ marginLeft: 8 }} onPress={() => { setTarget({ period: p.period, mode: 'reopen' }); setText(''); }} />
            )}
          </View>
        );
      })}

      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View style={st.overlay}>
          <View style={st.sheet}>
            <Text style={st.sheetTitle}>{target?.mode === 'close' ? `${target?.period} dönemini kapat` : `${target?.period} dönemini yeniden aç`}</Text>
            <Text style={[s.muted, { marginBottom: 8 }]}>
              {target?.mode === 'close'
                ? 'Kapalı döneme kayıt, ödeme ve düzeltme yapılamaz.'
                : 'Gerekçe denetim izine yazılır ve yönetime bildirilir.'}
            </Text>
            <Input value={text} onChangeText={setText} placeholder={target?.mode === 'close' ? 'Not (isteğe bağlı)' : 'Gerekçe (zorunlu)'} maxLength={500} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Btn label={target?.mode === 'close' ? 'Kapat' : 'Yeniden aç'} disabled={busy} onPress={submit} style={{ flex: 1 }} />
              <Btn label="Vazgeç" variant="secondary" onPress={() => setTarget(null)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </Section>
  );
}

/** KDV ön izleme (hesaplanan − indirilecek). Resmi beyanname Mali Müşavir tarafından hazırlanır. */
export function VatSummary({ showToast }) {
  const [d, setD] = React.useState(null);
  React.useEffect(() => {
    apiFetchVatReport().then((res) => (res.success ? setD(res.data) : showToast(`⚠️ ${res.message}`)));
  }, [showToast]);
  if (!d) return null;
  return (
    <Section title={`KDV Özeti · ${d.period || ''}`}>
      <View style={st.kv}><Text style={st.k}>Hesaplanan KDV (satış)</Text><Text style={st.v}>{money(d.totalOutputVat)}</Text></View>
      <View style={st.kv}><Text style={st.k}>İndirilecek KDV (deftere işlenen)</Text><Text style={st.v}>{money(d.totalInputVat)}</Text></View>
      <View style={st.kv}><Text style={st.k}>Deftere işlenmeyi bekleyen KDV</Text><Text style={st.v}>{money(d.inputVatAwaitingLedger)}</Text></View>
      <View style={[st.kv, { borderBottomWidth: 0 }]}>
        <Text style={[st.k, { fontWeight: '900', color: THEME.colors.textPrimary }]}>
          {Number(d.payableVat) > 0 ? 'Ödenecek KDV' : 'Devreden KDV'}
        </Text>
        <Text style={[st.v, { fontWeight: '900' }]}>{money(Number(d.payableVat) > 0 ? d.payableVat : d.carriedForwardVat)}</Text>
      </View>
      {!!d.disclaimer && <Text style={[s.muted, { marginTop: 6 }]} numberOfLines={3}>{d.disclaimer}</Text>}
    </Section>
  );
}

const st = StyleSheet.create({
  bar: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, padding: 10, marginBottom: 10 },
  search: { backgroundColor: '#f2f7f4', borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0f172a' },
  count: { fontSize: 11.5, fontWeight: '700', color: THEME.colors.textMuted, marginTop: 6, textAlign: 'right' },
  row: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, padding: 10, marginBottom: 8 },
  action: { flex: 1, fontSize: 13, fontWeight: '900', color: THEME.colors.textPrimary, marginRight: 8 },
  time: { fontSize: 11.5, fontWeight: '700', color: THEME.colors.textMuted },
  meta: { fontSize: 12, color: '#475569', marginTop: 2 },
  detail: { fontSize: 12, color: '#334155', marginTop: 4 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: THEME.colors.borderLight },
  overlay: { flex: 1, backgroundColor: 'rgba(7,25,14,0.55)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: THEME.colors.textPrimary, marginBottom: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.colors.borderLight },
  k: { flex: 1, fontSize: 12.5, color: '#475569', marginRight: 8 },
  v: { fontSize: 13, fontWeight: '800', color: THEME.colors.textPrimary },
});
