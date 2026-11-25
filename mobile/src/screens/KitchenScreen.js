import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { Text } from '../i18n';
import { apiPosKitchen, apiPosItemStatus } from '../services/api';
import mobileWebSocketService from '../services/websocketService';
import { THEME } from '../theme/tokens';
import { Chip, Btn, Badge, Empty, Tabs, s } from './mobileUi';

const COLUMNS = [
  { status: 'ORDERED', title: 'Yeni', next: 'PREPARING', action: 'Hazırlamaya Başla' },
  { status: 'PREPARING', title: 'Hazırlanan', next: 'READY', action: '✓ Hazır' },
  { status: 'READY', title: 'Hazır', next: null },
];
const LATE_MINUTES = 15;

/**
 * Mutfak ekranı (mobil). Kasiyerin girdiği siparişler canlı düşer; Mutfak Şefi hazırlama durumunu günceller.
 * Müdür yalnızca izler.
 */
export default function KitchenScreen({ can, showToast }) {
  const canOperate = can('KITCHEN_OPERATE');
  const [items, setItems] = React.useState([]);
  const [col, setCol] = React.useState('ORDERED');
  const [station, setStation] = React.useState('all');
  const [busyId, setBusyId] = React.useState(null);

  const load = React.useCallback(async () => {
    const res = await apiPosKitchen();
    if (res.success) setItems(res.data || []); else showToast(`⚠️ ${res.message}`);
  }, [showToast]);

  React.useEffect(() => {
    load();
    const off = mobileWebSocketService.subscribe('/topic/kitchen', () => load());
    const timer = setInterval(load, 20000);
    return () => { off && off(); clearInterval(timer); };
  }, [load]);

  const advance = async (i, next) => {
    setBusyId(i.id);
    const res = await apiPosItemStatus(i.id, next);
    setBusyId(null);
    if (res.success) load(); else showToast(`❌ ${res.message}`);
  };

  const filtered = items.filter((i) => station === 'all' || (station === 'bar' ? i.bar : !i.bar));
  const current = COLUMNS.find((c) => c.status === col);
  const list = filtered.filter((i) => i.status === col);

  return (
    <View>
      <Tabs
        tabs={COLUMNS.map((c) => [c.status, `${c.title} · ${filtered.filter((i) => i.status === c.status).length}`])}
        value={col}
        onChange={setCol}
      />
      <View style={[s.row, { marginBottom: 6 }]}>
        {[['all', 'Tümü'], ['kitchen', 'Mutfak'], ['bar', 'Bar']].map(([id, l]) => (
          <Chip key={id} label={l} active={station === id} onPress={() => setStation(id)} />
        ))}
        {!canOperate && <Text style={[s.muted, { marginLeft: 'auto', marginBottom: 6 }]}>İzleme</Text>}
      </View>
      {list.length === 0 && <Empty title="Sıra boş" />}
      {list.map((i) => {
        const late = i.waitMinutes >= LATE_MINUTES && col !== 'READY';
        return (
          <View key={i.id} style={[st.ticket, late && { borderLeftColor: '#dc2626' }, col === 'READY' && { borderLeftColor: '#10b981' }]}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontWeight: '900', fontSize: 15, flex: 1, marginRight: 8 }} numberOfLines={2}>{i.quantity} × {i.productName}</Text>
              <Badge label={`Masa ${i.tableNumber}`} tone="info" />
            </View>
            {i.note ? <Text style={{ color: '#b45309', fontWeight: '700', marginTop: 4 }}>Not: {i.note}</Text> : null}
            <Text style={[s.muted, { marginTop: 4 }, late && { color: '#b91c1c', fontWeight: '800' }]}>{i.waitMinutes} dk{late ? ' · gecikti' : ''}</Text>
            {canOperate && current.next && (
              <Btn style={{ marginTop: 8 }} label={current.action} disabled={busyId === i.id} onPress={() => advance(i, current.next)} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  ticket: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: THEME.colors.border, borderLeftWidth: 5, borderLeftColor: '#f59e0b',
    borderRadius: 12, padding: 12, marginBottom: 10,
  },
});
