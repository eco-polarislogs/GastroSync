import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { Text } from '../i18n';
import { apiFetchCashClosings, apiReviewCashClosing, apiCashReport } from '../services/api';
import { THEME } from '../theme/tokens';
import { Section, Chip, Btn, Badge, Stat, Input, Empty, money, num, useMore, s } from './mobileUi';

const CLOSING_STATUS = {
  PENDING_REVIEW: { label: 'Onay bekliyor', tone: 'warning' },
  RECONCILED: { label: 'Mutabık', tone: 'success' },
  REJECTED: { label: 'Yeniden sayım', tone: 'danger' },
};

const SORTS = {
  dateDesc: [(a, b) => String(b.businessDate).localeCompare(String(a.businessDate)), 'Tarih (yeni → eski)'],
  diffAbs: [(a, b) => Math.abs(num(b.difference)) - Math.abs(num(a.difference)), 'Fark (büyük → küçük)'],
  pending: [(a, b) => Number(b.status === 'PENDING_REVIEW') - Number(a.status === 'PENDING_REVIEW'), 'Bekleyenler önce'],
};

/**
 * Muhasebe kasa kontrolü (mobil):
 *  - Kasiyerin gün sonu sayımlarını Z özeti ve POS / yemek kartı raporlarıyla mutabakat (onay / gerekçeli ret)
 *  - Günlük (ay), aylık (yıl) ve yıllık kasa ve gelir raporu
 * Müdür ve Mali Müşavir aynı listeleri salt okunur görür.
 */
export default function CashControlPanel({ can, showToast }) {
  const [tab, setTab] = React.useState(can('CASH_CLOSING_REVIEW') ? 'closings' : 'report');
  return (
    <View>
      <View style={s.wrap}>
        {can('CASH_CLOSING_VIEW') && <Chip label={can('CASH_CLOSING_REVIEW') ? 'Kasa Mutabakatı' : 'Kasa Sayımları'} active={tab === 'closings'} onPress={() => setTab('closings')} />}
        {can('CASH_REPORT_VIEW') && <Chip label="Kasa Raporu" active={tab === 'report'} onPress={() => setTab('report')} />}
      </View>
      {tab === 'closings' && <Closings can={can} showToast={showToast} />}
      {tab === 'report' && <CashReport showToast={showToast} />}
    </View>
  );
}

function Closings({ can, showToast }) {
  const [list, setList] = React.useState([]);
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState('pending');
  const [review, setReview] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const canReview = can('CASH_CLOSING_REVIEW');

  const load = React.useCallback(async () => {
    const res = await apiFetchCashClosings();
    if (res.success) setList(res.data || []); else showToast(`⚠️ ${res.message}`);
  }, [showToast]);
  React.useEffect(() => { load(); }, [load]);

  const rows = list.filter((c) => filter === 'all' || c.status === filter).sort(SORTS[sort][0]);
  const { items, more } = useMore(rows, 10);
  const pending = list.filter((c) => c.status === 'PENDING_REVIEW').length;

  const decide = async () => {
    setBusy(true);
    const res = await apiReviewCashClosing(review.c.id, review.decision, review.note.trim() || undefined);
    setBusy(false);
    if (res.success) {
      showToast(review.decision === 'APPROVE' ? '✓ Kasa sayımı mutabık' : '✓ Yeniden sayım istendi');
      setReview(null); load();
    } else showToast(`❌ ${res.message}`);
  };

  return (
    <View>
      <View style={s.wrap}>
        <Stat label="Mutabakat bekleyen" value={String(pending)} tone={pending ? 'warning' : 'success'} />
        <Stat label="Son 30 gün kasa farkı" value={money(list.reduce((sum, c) => sum + num(c.difference), 0))} />
      </View>
      <View style={s.wrap}>
        <Chip label="Tümü" active={filter === 'all'} onPress={() => setFilter('all')} />
        {Object.entries(CLOSING_STATUS).map(([k, v]) => <Chip key={k} label={v.label} active={filter === k} onPress={() => setFilter(k)} />)}
      </View>
      <View style={s.wrap}>
        {Object.entries(SORTS).map(([k, [, l]]) => <Chip key={k} label={`↕ ${l}`} active={sort === k} onPress={() => setSort(k)} />)}
      </View>
      {rows.length === 0 && <Empty title="Kayıt yok" />}
      {items.map((c) => (
        <Section key={c.id}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontWeight: '900' }}>{c.businessDate} · {c.closedBy}</Text>
            <Badge label={CLOSING_STATUS[c.status]?.label || c.status} tone={CLOSING_STATUS[c.status]?.tone} />
          </View>
          <Text style={[s.muted, { marginTop: 4 }]}>
            Nakit satış {money(c.cashSales)} · Kart {money(c.cardSales)} · Yemek k. {money(c.mealCardSales)}
          </Text>
          <Text style={[s.muted, { marginTop: 2 }]}>
            Beklenen {money(c.expectedCash)} · Sayılan {money(c.countedCash)} ·{' '}
            <Text style={{ fontWeight: '800', color: num(c.difference) === 0 ? '#047857' : '#b45309' }}>Fark {money(c.difference)}</Text>
          </Text>
          {c.note ? <Text style={[s.muted, { marginTop: 2 }]}>Kasiyer notu: {c.note}</Text> : null}
          {c.reviewedBy ? <Text style={[s.muted, { marginTop: 2 }]}>{c.reviewedBy}{c.reviewNote ? `: ${c.reviewNote}` : ''}</Text> : null}
          {canReview && c.status === 'PENDING_REVIEW' && (
            review?.c.id === c.id ? (
              <View style={{ marginTop: 8 }}>
                <Input placeholder={review.decision === 'REJECT' ? 'Gerekçe (en az 10 karakter)' : 'Not (isteğe bağlı)'}
                  value={review.note} onChangeText={(v) => setReview({ ...review, note: v })} />
                <View style={[s.row, { gap: 8, marginTop: 8 }]}>
                  <Btn label="Vazgeç" variant="secondary" onPress={() => setReview(null)} style={{ flex: 1 }} />
                  <Btn label={review.decision === 'APPROVE' ? 'Mutabık' : 'Reddet'} variant={review.decision === 'APPROVE' ? 'primary' : 'danger'}
                    disabled={busy || (review.decision === 'REJECT' && review.note.trim().length < 10)} onPress={decide} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <View style={[s.row, { gap: 8, marginTop: 8 }]}>
                <Btn label="✓ Mutabık" onPress={() => setReview({ c, decision: 'APPROVE', note: '' })} style={{ flex: 1 }} />
                <Btn label="↺ Yeniden say" variant="danger" onPress={() => setReview({ c, decision: 'REJECT', note: '' })} style={{ flex: 1 }} />
              </View>
            )
          )}
        </Section>
      ))}
      {more}
    </View>
  );
}

function CashReport({ showToast }) {
  const [g, setG] = React.useState('day');
  const [data, setData] = React.useState(null);
  const [sortDesc, setSortDesc] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setData(null);
    apiCashReport(g).then((res) => {
      if (!alive) return;
      if (res.success) setData(res.data); else showToast(`⚠️ ${res.message}`);
    });
    return () => { alive = false; };
  }, [g, showToast]);

  const rows = (data?.rows || []).filter((r) => num(r.grossSales) || num(r.payments) || num(r.countDifference))
    .sort((a, b) => (sortDesc ? String(b.period).localeCompare(String(a.period)) : String(a.period).localeCompare(String(b.period))));
  const { items, more } = useMore(rows, 12);
  const t = data?.totals || {};

  return (
    <View>
      <View style={s.wrap}>
        {[['day', 'Günlük (bu ay)'], ['month', 'Aylık (bu yıl)'], ['year', 'Yıllık']].map(([k, l]) => (
          <Chip key={k} label={l} active={g === k} onPress={() => setG(k)} />
        ))}
        <Chip label={sortDesc ? '↓ Yeni → eski' : '↑ Eski → yeni'} active={false} onPress={() => setSortDesc((v) => !v)} />
      </View>
      {!data ? <Text style={s.muted}>Yükleniyor…</Text> : (
        <>
          <View style={s.wrap}>
            <Stat label="Tahsilat (KDV dahil)" value={money(t.grossSales)} hint={`${t.receiptCount || 0} adisyon`} tone="success" />
            <Stat label="Net satış" value={money(t.netSales)} hint={`KDV ${money(t.vat)}`} />
            <Stat label="Ödenen giderler" value={money(t.payments)} hint={`Kasa ${money(t.cashPayments)} · Banka ${money(t.bankPayments)}`} tone="warning" />
            <Stat label="Net nakit (kasa)" value={money(t.netCashFlow)} tone={num(t.netCashFlow) < 0 ? 'danger' : 'success'} />
          </View>
          {rows.length === 0 && <Empty title="Bu aralıkta hareket yok" />}
          {items.map((r) => (
            <View key={r.period} style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900' }}>{r.period}</Text>
                <Text style={s.muted}>Nakit {money(r.cashSales)} · Kart {money(r.cardSales)} · Yemek k. {money(r.mealCardSales)}</Text>
                <Text style={s.muted}>Ödemeler {money(r.payments)}{num(r.countDifference) ? ` · sayım farkı ${money(r.countDifference)}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '900', color: '#047857' }}>{money(r.grossSales)}</Text>
                <Text style={[s.muted, { color: num(r.netCashFlow) < 0 ? '#b91c1c' : THEME.colors.textMuted }]}>net {money(r.netCashFlow)}</Text>
              </View>
            </View>
          ))}
          {more}
          <Text style={[s.muted, { marginTop: 6 }]}>{data.note}</Text>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: '#fff', borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 12, padding: 12, marginBottom: 8 },
});
