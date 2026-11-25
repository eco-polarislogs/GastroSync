import React from 'react';
import {
  View,
} from 'react-native';
import { Text } from '../i18n';
import { apiFetchApprovals, apiDecideApproval, apiWithdrawApproval } from '../services/api';
import mobileWebSocketService from '../services/websocketService';
import { Section, Chip, Btn, Badge, Input, Empty, money, s } from './mobileUi';

export const APPROVAL_TYPE = {
  ITEM_VOID: { label: 'Kalem iptali', tone: 'danger' },
  CHECK_VOID: { label: 'Adisyon iptali', tone: 'danger' },
  COMP: { label: 'İkram', tone: 'info' },
  DISCOUNT: { label: 'İndirim', tone: 'warning' },
  STOCK_ADJUST: { label: 'Sayım farkı', tone: 'neutral' },
};

const STATUS = {
  PENDING: { label: 'Onay bekliyor', tone: 'warning' },
  APPROVED: { label: 'Onaylandı', tone: 'success' },
  REJECTED: { label: 'Reddedildi', tone: 'danger' },
  WITHDRAWN: { label: 'Geri çekildi', tone: 'neutral' },
  EXPIRED: { label: 'Geçersiz', tone: 'neutral' },
};

const FILTERS = [['PENDING', 'Bekleyen'], ['APPROVED', 'Onaylanan'], ['REJECTED', 'Reddedilen'], ['ALL', 'Tümü']];

/**
 * Roller arası onay talepleri (web'deki Onay Talepleri paneliyle aynı sunucu uçları).
 *  scope="inbox": İşletme Müdürü — Onayla / gerekçeyle Reddet
 *  scope="mine":  Kasiyer / Depo Sorumlusu — kendi talepleri, geri çekme
 * Talep açıldığında / karar verildiğinde liste canlı tazelenir.
 */
export default function ApprovalsList({ scope = 'inbox', defaultStatus = 'PENDING', showToast, title, onChanged }) {
  const [status, setStatus] = React.useState(defaultStatus);
  const [rows, setRows] = React.useState(null);
  const [total, setTotal] = React.useState(0);
  const [rejecting, setRejecting] = React.useState(null);
  const [note, setNote] = React.useState('');
  const [busyId, setBusyId] = React.useState(null);

  const load = React.useCallback(async () => {
    const res = await apiFetchApprovals({ scope, status, size: 30 });
    if (res.success) { setRows(res.content); setTotal(res.totalElements); } else { setRows([]); if (showToast) showToast(`⚠️ ${res.message}`); }
  }, [scope, status, showToast]);

  React.useEffect(() => {
    load();
    const off1 = mobileWebSocketService.subscribe('/topic/approvals', () => load());
    const off2 = mobileWebSocketService.subscribe('/user/queue/notifications', (p) => { if (p && p.type === 'APPROVAL_DECIDED') load(); });
    return () => { if (off1) off1(); if (off2) off2(); };
  }, [load]);

  const decide = async (a, decision, why) => {
    setBusyId(a.id);
    const res = await apiDecideApproval(a.id, decision, why);
    setBusyId(null);
    if (res.success) {
      const st = res.data?.status;
      if (showToast) showToast(st === 'APPROVED' ? '✓ Onaylandı; işlem uygulandı' : st === 'REJECTED' ? '✓ Reddedildi; talep sahibine bildirildi' : `⚠️ Uygulanamadı: ${res.data?.decisionNote || ''}`);
      setRejecting(null); setNote('');
      load();
      if (onChanged) onChanged();
    } else if (showToast) showToast(`❌ ${res.message}`);
  };

  const withdraw = async (a) => {
    setBusyId(a.id);
    const res = await apiWithdrawApproval(a.id);
    setBusyId(null);
    if (res.success) { if (showToast) showToast('✓ Talep geri çekildi'); load(); if (onChanged) onChanged(); } else if (showToast) showToast(`❌ ${res.message}`);
  };

  return (
    <Section title={title || (scope === 'inbox' ? `Onay Talepleri${status === 'PENDING' && total ? ` (${total})` : ''}` : 'Taleplerim')}>
      <View style={[s.wrap, { marginBottom: 8 }]}>
        {FILTERS.map(([k, l]) => <Chip key={k} label={l} active={status === k} onPress={() => setStatus(k)} />)}
      </View>
      {rows === null ? <Text style={s.muted}>Yükleniyor…</Text> : rows.length === 0 ? (
        <Empty title={status === 'PENDING' ? 'Bekleyen talep yok' : 'Talep yok'}
          hint={scope === 'inbox' ? 'Kasiyer ve Depo Sorumlusunun talepleri burada görünür.' : 'Müdür onayına gönderdiğiniz talepler burada görünür.'} />
      ) : rows.map((a) => (
        <View key={a.id} style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 10 }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Badge label={a.typeLabel || APPROVAL_TYPE[a.type]?.label || a.type} tone={APPROVAL_TYPE[a.type]?.tone} />
            <Badge label={a.statusLabel || STATUS[a.status]?.label} tone={STATUS[a.status]?.tone} />
          </View>
          <Text style={{ fontWeight: '800', marginTop: 6 }}>{a.summary}</Text>
          <Text style={s.muted}>Gerekçe: {a.reason}</Text>
          <Text style={s.muted}>{a.requestedByName} · {a.requestedRoleLabel}{a.amount != null ? ` · ${money(a.amount)}` : ''}</Text>
          {a.decidedByName ? <Text style={s.muted}>Karar: {a.decidedByName}{a.decisionNote ? ` — ${a.decisionNote}` : ''}</Text> : null}
          {a.canDecide && rejecting?.id !== a.id && (
            <View style={[s.row, { gap: 8, marginTop: 8 }]}>
              <Btn label="Onayla" disabled={busyId === a.id} onPress={() => decide(a, 'APPROVE')} style={{ flex: 1 }} />
              <Btn label="Reddet" variant="danger" disabled={busyId === a.id} onPress={() => { setRejecting(a); setNote(''); }} style={{ flex: 1 }} />
            </View>
          )}
          {rejecting?.id === a.id && (
            <View style={{ marginTop: 8 }}>
              <Input placeholder="Ret gerekçesi (en az 5 karakter)" value={note} onChangeText={setNote} />
              <View style={[s.row, { gap: 8, marginTop: 8 }]}>
                <Btn label="Vazgeç" variant="secondary" onPress={() => setRejecting(null)} style={{ flex: 1 }} />
                <Btn label="Reddet" variant="danger" disabled={note.trim().length < 5 || busyId === a.id} onPress={() => decide(a, 'REJECT', note.trim())} style={{ flex: 1 }} />
              </View>
            </View>
          )}
          {a.canWithdraw && (
            <Btn small label="Geri çek" variant="secondary" disabled={busyId === a.id} onPress={() => withdraw(a)} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          )}
        </View>
      ))}
    </Section>
  );
}
