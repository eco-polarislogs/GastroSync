import React from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Text } from '../i18n';
import {
  apiPosTables, apiPosMenu, apiPosSummary, apiPosOpenCheck, apiPosCheck, apiPosAddItems, apiPosItemStatus,
  apiPosCancelItem, apiPosCancelCheck, apiZReport, apiCreateCashClosing, apiFetchCashClosings,
  apiPosCreateTable, apiPosUpdateTable, apiPosTransfer, apiExplainCashClosing,
  apiRequestApproval, apiDecideApproval, apiPosComp, apiPosDiscount, apiPosRemoveDiscount,
  apiPosAddPayment, apiPosVoidPayment, apiPrintCheck, apiFiscalForCheck, apiFiscalEArsiv, apiFiscalOkc,
} from '../services/api';
import { subscribeOffline } from '../services/offlineQueue';
import mobileWebSocketService from '../services/websocketService';
import { THEME } from '../theme/tokens';
import { Section, Chip, Btn, Badge, Input, Empty, Tabs, Stepper, money, moneyShort, num, todayIso, useMore, s } from './mobileUi';
import ApprovalsList, { APPROVAL_TYPE } from './ApprovalsScreen';

const ITEM_STATUS = {
  ORDERED: { label: 'Sırada', tone: 'warning' },
  PREPARING: { label: 'Hazırlanıyor', tone: 'info' },
  READY: { label: 'Hazır', tone: 'success' },
  SERVED: { label: 'Servis edildi', tone: 'neutral' },
  CANCELLED: { label: 'İptal', tone: 'danger' },
};
const PAYMENTS = [['CASH', 'Nakit'], ['CREDIT_CARD', 'Kart'], ['MEAL_CARD', 'Yemek Kartı']];
const METHOD_LABEL = { CASH: 'Nakit', CREDIT_CARD: 'Kart', MEAL_CARD: 'Yemek Kartı', MIXED: 'Karışık' };
const PAY_MODES = [['rest', 'Kalanın tamamı'], ['amount', 'Tutar'], ['equal', 'Kişi başı'], ['items', 'Kalem seç']];
const FISCAL_TYPE = { E_ARSIV: 'e-Arşiv', E_ADISYON: 'e-Adisyon', OKC: 'ÖKC fişi' };
const r2 = (n) => Math.round(n * 100) / 100;

/** Bağlantı durumu: çevrimdışıyken sipariş / tahsilat sıraya alınır, bağlantı gelince gönderilir */
function OfflineBanner() {
  const [net, setNet] = React.useState({ online: true, pending: 0 });
  React.useEffect(() => subscribeOffline(setNet), []);
  if (net.online && !net.pending) return null;
  return (
    <View style={[st.offline, net.online && { backgroundColor: '#e0f2fe', borderColor: '#7dd3fc' }]}>
      <Text style={{ fontWeight: '800', color: net.online ? '#075985' : '#92400e' }} numberOfLines={2}>
        {net.online
          ? `⟳ ${net.pending} bekleyen işlem gönderiliyor…`
          : net.pending
            ? `📶 Çevrimdışı · ${net.pending} işlem cihazda bekliyor, bağlantı gelince gönderilecek`
            : '📶 Çevrimdışı · sipariş ve tahsilat cihazda sıraya alınır'}
      </Text>
    </View>
  );
}
const CLOSING_STATUS = {
  PENDING_REVIEW: { label: 'Onay bekliyor', tone: 'warning' },
  RECONCILED: { label: 'Mutabık', tone: 'success' },
  REJECTED: { label: 'Yeniden sayım', tone: 'danger' },
};

/**
 * Masalar & Kasa (mobil).
 *  Kasiyer: adisyon, sipariş, tahsilat, gün sonu kasa sayımı, masa ekleme.
 *  Müdür:   masa durumunu izler, hazırlanan kalem / adisyon iptalini onaylar, masa düzeni.
 *  Yönetici: masa düzeni (işletmeye göre masa ekler / düzenler), masaları izler.
 */
export default function PosScreen({ can, showToast }) {
  const canOperate = can('POS_OPERATE');
  const canApproveCancel = can('POS_CANCEL_APPROVE');
  const canManageTables = can('POS_TABLE_MANAGE');
  const canCount = can('CASH_CLOSING_CREATE');
  const [tab, setTab] = React.useState('tables');
  const [tables, setTables] = React.useState([]);
  const [summary, setSummary] = React.useState(null);
  const [area, setArea] = React.useState('all');
  const [checkId, setCheckId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const [t, sm] = await Promise.all([apiPosTables(), apiPosSummary()]);
    if (t.success) setTables(t.data || []);
    else showToast(`⚠️ ${t.message}`);
    if (sm.success) setSummary(sm.data);
    setLoading(false);
  }, [showToast]);

  React.useEffect(() => {
    load();
    const offT = mobileWebSocketService.subscribe('/topic/tables', () => load());
    const offK = mobileWebSocketService.subscribe('/topic/kitchen', () => load());
    const offA = mobileWebSocketService.subscribe('/topic/approvals', () => load());
    const timer = setInterval(load, 30000);
    return () => { offT && offT(); offK && offK(); offA && offA(); clearInterval(timer); };
  }, [load]);

  React.useEffect(() => {
    let prev = 0;
    return subscribeOffline((net) => {
      if (prev > 0 && net.pending === 0 && net.online) load();
      prev = net.pending;
    });
  }, [load]);

  const activeTables = tables.filter((t) => t.status !== 'INACTIVE');
  const areas = Array.from(new Set(activeTables.map((t) => t.area).filter(Boolean)));
  const shown = activeTables.filter((t) => area === 'all' || t.area === area);

  const pick = async (t) => {
    if (t.check) { setCheckId(t.check.id); return; }
    if (!canOperate) return;
    const res = await apiPosOpenCheck(t.id, 2);
    if (res.success) { setCheckId(res.data.id); load(); } else showToast(`❌ ${res.message}`);
  };

  const tabs = [
    ['tables', 'Masalar'],
    canOperate && ['requests', 'Taleplerim'],
    canCount && ['eod', 'Gün Sonu'],
    canManageTables && ['layout', 'Masa Düzeni'],
  ].filter(Boolean);

  return (
    <View>
      <OfflineBanner />
      {summary && (
        <View style={st.strip}>
          <StripCell label="Açık masa" value={`${summary.openChecks}/${summary.activeTables}`} tone="#b45309" />
          <View style={st.stripDiv} />
          {/* Kör sayım: kasayı sayan kişi günün ciro toplamını görmez (Müdür / Yönetici görür) */}
          {can('SALES_VIEW')
            ? <StripCell label="Bugün" value={moneyShort(summary.revenue)} tone="#047857" />
            : <StripCell label="Kapanan adisyon" value={String(summary.paidChecks ?? 0)} tone="#047857" />}
          <View style={st.stripDiv} />
          <StripCell label="Mutfak" value={summary.readyToServe > 0 ? `${summary.kitchenQueue} · ${summary.readyToServe} hazır` : String(summary.kitchenQueue)} />
        </View>
      )}

      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}

      {tab === 'tables' && (
        <>
          {!canOperate && (
            <Text style={[s.muted, { marginBottom: 8 }]}>
              İzleme{canApproveCancel ? ' · iptal / ikram / indirim onayı' : ''} · sipariş ve tahsilat Kasiyerdedir
            </Text>
          )}
          {areas.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
              <Chip label="Tümü" active={area === 'all'} onPress={() => setArea('all')} />
              {areas.map((a) => <Chip key={a} label={a} active={area === a} onPress={() => setArea(a)} />)}
            </ScrollView>
          )}
          {loading ? <Text style={s.muted}>Yükleniyor…</Text> : shown.length === 0 ? (
            <Empty
              title="Tanımlı masa yok"
              hint={canManageTables ? 'Masa Düzeni sekmesinden masa ekleyin.' : 'Masaları Kasiyer, Müdür veya Yönetici ekler.'}
            />
          ) : (
            <View style={st.grid}>
              {shown.map((t) => {
                const c = t.check;
                const ready = c?.readyCount > 0;
                return (
                  <TouchableOpacity key={t.id} onPress={() => pick(t)} activeOpacity={0.8}
                    style={[st.table, c && st.tableBusy, ready && st.tableReady]}>
                    <View style={st.tableTop}>
                      <Text style={st.tableNo} numberOfLines={1}>{t.number}</Text>
                      <Text style={st.tableCap}>{t.capacity}👤</Text>
                    </View>
                    {c ? (
                      <>
                        <Text style={st.tableAmt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{moneyShort(c.total)}</Text>
                        <Text style={st.tableMeta} numberOfLines={1}>
                          {c.pendingApprovals > 0 ? `⏳ ${c.pendingApprovals} onay` : ready ? `${c.readyCount} hazır` : `${c.minutesOpen} dk`}
                        </Text>
                      </>
                    ) : (
                      <Text style={st.tableFree} numberOfLines={1}>Boş</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      {tab === 'requests' && <ApprovalsList scope="mine" defaultStatus="ALL" showToast={showToast} onChanged={load} />}
      {tab === 'eod' && <EndOfDay showToast={showToast} />}
      {tab === 'layout' && <TableLayout tables={tables} onChanged={load} showToast={showToast} />}

      <CheckModal checkId={checkId} canOperate={canOperate} canApproveCancel={canApproveCancel} canDiscount={can('POS_DISCOUNT_APPROVE')} tables={tables}
        onClose={() => { setCheckId(null); load(); }} showToast={showToast} />
    </View>
  );
}

function StripCell({ label, value, tone }) {
  return (
    <View style={st.stripCell}>
      <Text style={st.stripLabel} numberOfLines={1}>{label}</Text>
      <Text style={[st.stripValue, tone && { color: tone }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}

/**
 * Masa Düzeni: masa ekleme (tekli / toplu), bölüm ve kapasite düzenleme, kullanım dışı bırakma.
 * Masa düzeni işletmeye göre değişir; Kasiyer, Müdür ve Yönetici yapabilir (sunucu da denetler).
 */
function TableLayout({ tables, onChanged, showToast }) {
  const existingAreas = Array.from(new Set(tables.map((t) => t.area).filter(Boolean)));
  const nextNo = tables.reduce((m, t) => Math.max(m, Number(t.number) || 0), 0) + 1;
  const [startNo, setStartNo] = React.useState(String(nextNo));
  const [count, setCount] = React.useState(1);
  const [capacity, setCapacity] = React.useState(4);
  const [areaSel, setAreaSel] = React.useState(existingAreas[0] || 'Salon');
  const [newArea, setNewArea] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [editId, setEditId] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(tables.length === 0);

  React.useEffect(() => { setStartNo(String(nextNo)); }, [nextNo]);

  const area = areaSel === '__new' ? newArea.trim() : areaSel;
  const first = parseInt(startNo, 10);
  const numbers = Number.isFinite(first) ? Array.from({ length: count }, (_, i) => first + i) : [];
  const taken = numbers.filter((n) => tables.some((t) => Number(t.number) === n));
  const invalid = !numbers.length || first < 1 || numbers[numbers.length - 1] > 999 || !area || area.length > 40;

  const add = async () => {
    if (taken.length) { showToast(`⚠️ Masa ${taken.join(', ')} zaten tanımlı`); return; }
    setBusy(true);
    let ok = 0;
    for (const n of numbers) {
      const res = await apiPosCreateTable({ number: n, area, capacity });
      if (!res.success) { showToast(`❌ Masa ${n}: ${res.message}`); break; }
      ok += 1;
    }
    setBusy(false);
    if (ok) {
      showToast(ok === 1 ? `✓ Masa ${numbers[0]} eklendi` : `✓ ${ok} masa eklendi (${numbers[0]}–${numbers[ok - 1]})`);
      setCount(1); setNewArea(''); setShowAdd(false); if (areaSel === '__new') setAreaSel(area);
      onChanged();
    }
  };

  const grouped = existingAreas.map((a) => [a, tables.filter((t) => t.area === a).sort((x, y) => x.number - y.number)]);

  return (
    <View>
      {!showAdd ? (
        <Btn label="+ Masa Ekle" onPress={() => setShowAdd(true)} style={{ marginBottom: 12 }} />
      ) : (
        <Section title="Yeni Masa" right={tables.length > 0 ? (
          <TouchableOpacity onPress={() => setShowAdd(false)}><Text style={st.close}>✕</Text></TouchableOpacity>
        ) : null}>
          <View style={st.formRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[s.label, { marginTop: 0 }]}>Masa no</Text>
              <Input keyboardType="number-pad" value={startNo} onChangeText={(v) => setStartNo(v.replace(/[^0-9]/g, '').slice(0, 3))} />
            </View>
            <View>
              <Text style={[s.label, { marginTop: 0 }]}>Adet</Text>
              <Stepper value={count} onChange={setCount} min={1} max={30} />
            </View>
          </View>

          <Text style={s.label}>Bölüm</Text>
          <View style={s.wrap}>
            {(existingAreas.length ? existingAreas : ['Salon']).map((a) => (
              <Chip key={a} label={a} active={areaSel === a} onPress={() => setAreaSel(a)} />
            ))}
            <Chip label="+ Yeni bölüm" active={areaSel === '__new'} onPress={() => setAreaSel('__new')} />
          </View>
          {areaSel === '__new' && (
            <Input placeholder="Örn. Bahçe, Teras, Bar" value={newArea} onChangeText={setNewArea} maxLength={40} />
          )}

          <Text style={s.label}>Kapasite (kişi)</Text>
          <Stepper value={capacity} onChange={setCapacity} min={1} max={30} />

          {taken.length > 0 && <Text style={st.warn}>Masa {taken.join(', ')} zaten tanımlı</Text>}
          <Btn
            style={{ marginTop: 14 }}
            label={busy ? 'Ekleniyor…' : count > 1 && numbers.length ? `${count} Masa Ekle (${numbers[0]}–${numbers[numbers.length - 1]})` : 'Masa Ekle'}
            disabled={busy || invalid || taken.length > 0}
            onPress={add}
          />
        </Section>
      )}

      {tables.length > 0 && <Text style={[s.muted, { marginBottom: 8 }]}>Düzenlemek için masaya dokunun</Text>}
      {grouped.map(([a, list]) => {
        const editing = list.find((t) => t.id === editId);
        return (
          <Section key={a} title={a} right={<Text style={s.muted}>{list.filter((t) => t.status !== 'INACTIVE').length} / {list.length}</Text>}>
            <View style={st.miniGrid}>
              {list.map((t) => {
                const off = t.status === 'INACTIVE';
                return (
                  <TouchableOpacity key={t.id} activeOpacity={0.8} onPress={() => setEditId(editId === t.id ? null : t.id)}
                    style={[st.mini, off && st.miniOff, editId === t.id && st.miniSel]}>
                    <Text style={[st.miniNo, off && { color: THEME.colors.textMuted }]} numberOfLines={1}>{t.number}</Text>
                    <Text style={st.miniCap} numberOfLines={1}>{off ? 'kapalı' : `${t.capacity} kişi`}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {editing && (
              <TableEditor key={editing.id} table={editing} areas={existingAreas}
                onClose={() => setEditId(null)} onSaved={() => { setEditId(null); onChanged(); }} showToast={showToast} />
            )}
          </Section>
        );
      })}
    </View>
  );
}

function TableEditor({ table, areas, onClose, onSaved, showToast }) {
  const [area, setArea] = React.useState(table.area);
  const [capacity, setCapacity] = React.useState(Number(table.capacity) || 4);
  const [busy, setBusy] = React.useState(false);
  const inactive = table.status === 'INACTIVE';
  const occupied = table.status === 'OCCUPIED';

  const save = async (patch, ok) => {
    setBusy(true);
    const res = await apiPosUpdateTable(table.id, patch);
    setBusy(false);
    if (res.success) { showToast(ok); onSaved(); } else showToast(`❌ ${res.message}`);
  };

  return (
    <View style={st.editor}>
      <View style={st.rowHead}>
        <Text style={[st.rowTitle, { flex: 1 }]} numberOfLines={1}>
          Masa {table.number}{inactive ? ' · kullanım dışı' : occupied ? ' · açık adisyon' : ''}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={st.close}>✕</Text></TouchableOpacity>
      </View>
      {(
        <View style={{ marginTop: 4 }}>
          <Text style={[s.label, { marginTop: 0 }]}>Bölüm</Text>
          <View style={s.wrap}>
            {areas.map((a) => <Chip key={a} label={a} active={area === a} onPress={() => setArea(a)} />)}
          </View>
          <Text style={s.label}>Kapasite</Text>
          <Stepper value={capacity} onChange={setCapacity} min={1} max={30} />
          <View style={[s.row, { marginTop: 12, gap: 8 }]}>
            <Btn style={{ flex: 1 }} label="Kaydet" disabled={busy || (area === table.area && capacity === Number(table.capacity))}
              onPress={() => save({ area, capacity }, `✓ Masa ${table.number} güncellendi`)} />
            <Btn style={{ flex: 1 }} variant={inactive ? 'secondary' : 'danger'} disabled={busy || occupied}
              label={inactive ? 'Kullanıma Aç' : 'Kullanım Dışı'}
              onPress={() => save({ active: inactive }, inactive ? `✓ Masa ${table.number} kullanıma açıldı` : `✓ Masa ${table.number} kullanım dışı`)} />
          </View>
          {occupied && <Text style={[s.muted, { marginTop: 6 }]}>Açık adisyonlu masa kapatılamaz.</Text>}
        </View>
      )}
    </View>
  );
}

/**
 * Adisyon. Kasiyer: sipariş, tahsilat, masa taşıma; hazırlanmış kalem iptali / ikram / indirim için
 * Müdüre gerekçeli onay talebi. Müdür: iptal, ikram ve indirimi doğrudan uygular, bekleyen talepleri onaylar / reddeder.
 * (Web'deki Masalar & Kasa ekranıyla aynı sunucu kuralları.)
 */
function CheckModal({ checkId, canOperate, canApproveCancel, canDiscount, tables = [], onClose, showToast }) {
  const [action, setAction] = React.useState(null); // { kind: cancel|cancelRequest|comp|discount|reject, scope: item|check, item?, approval? }
  const [discMode, setDiscMode] = React.useState('percent');
  const [discValue, setDiscValue] = React.useState('');
  const [check, setCheck] = React.useState(null);
  const [menu, setMenu] = React.useState(null);
  const [cart, setCart] = React.useState({});
  const [mode, setMode] = React.useState('check'); // check | menu | pay | move
  const [q, setQ] = React.useState('');
  const [method, setMethod] = React.useState('CASH');
  const [received, setReceived] = React.useState('');
  const [cancel, setCancel] = React.useState(null); // { type, item }
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [payMode, setPayMode] = React.useState('rest');
  const [payAmount, setPayAmount] = React.useState('');
  const [people, setPeople] = React.useState(2);
  const [picked, setPicked] = React.useState([]);
  const [receipt, setReceipt] = React.useState(null);
  const [voidTarget, setVoidTarget] = React.useState(null);
  const [docs, setDocs] = React.useState([]);
  const [okcNo, setOkcNo] = React.useState('');
  const [zNo, setZNo] = React.useState('');
  const [buyer, setBuyer] = React.useState({ buyerName: '', buyerTaxId: '', buyerTaxOffice: '' });

  const reload = React.useCallback(async () => {
    if (!checkId) return;
    const res = await apiPosCheck(checkId);
    if (!res.success) { showToast(`⚠️ ${res.message}`); return; }
    setCheck(res.data);
    // Adisyon başka cihazdan / tahsilatla kapandıysa düzenleme ekranı yerine fiş ve mali belge görünümü açılır
    if (res.data && res.data.status === 'PAID') {
      setReceipt((prev) => prev || { ...res.data, checkId: res.data.id, vatAmount: res.data.vatAmount });
      setMode('receipt');
      apiFiscalForCheck(res.data.id).then((d) => { if (d.success) setDocs(d.data || []); });
    }
  }, [checkId, showToast]);

  React.useEffect(() => {
    setCheck(null); setCart({}); setMode('check'); setReceived(''); setCancel(null); setReason(''); setAction(null); setDiscValue('');
    setPayMode('rest'); setPayAmount(''); setPicked([]); setReceipt(null); setVoidTarget(null); setDocs([]); setOkcNo(''); setZNo('');
    setBuyer({ buyerName: '', buyerTaxId: '', buyerTaxOffice: '' });
    reload();
  }, [checkId, reload]);

  // Müdür kararı / yeni talep geldiğinde açık adisyon tazelenir
  React.useEffect(() => {
    if (!checkId) return undefined;
    const offA = mobileWebSocketService.subscribe('/topic/approvals', () => reload());
    return () => { if (offA) offA(); };
  }, [checkId, reload]);

  // Şef "hazır" işaretlediğinde veya başka kasadan değişiklik olduğunda açık adisyon canlı tazelenir
  React.useEffect(() => {
    if (!checkId) return undefined;
    const offK = mobileWebSocketService.subscribe('/topic/kitchen', () => reload());
    const offT = mobileWebSocketService.subscribe('/topic/tables', () => reload());
    return () => { if (offK) offK(); if (offT) offT(); };
  }, [checkId, reload]);

  // Çevrimdışı kuyruk boşalınca (sıradaki sipariş / tahsilat sunucuya ulaştı) açık adisyon tazelenir
  React.useEffect(() => {
    if (!checkId) return undefined;
    let prev = 0;
    return subscribeOffline((net) => {
      if (prev > 0 && net.pending === 0 && net.online) reload();
      prev = net.pending;
    });
  }, [checkId, reload]);

  // Menü fiyatı onaylanınca / değişince kasa menüsü bir sonraki açılışta sunucudan tazelenir
  React.useEffect(() => mobileWebSocketService.subscribe('/topic/recipes', () => setMenu(null)), []);

  const openMenu = async () => {
    setMode('menu');
    if (!menu) {
      const res = await apiPosMenu();
      if (res.success) setMenu(res.data || []); else showToast(`⚠️ ${res.message}`);
    }
  };
  const changeQty = (m, d) => setCart((c) => {
    const qty = (c[m.id]?.qty || 0) + d;
    const next = { ...c };
    if (qty <= 0) delete next[m.id]; else next[m.id] = { id: m.id, name: m.name, price: m.salePrice, qty };
    return next;
  });
  const lines = Object.values(cart);
  const cartTotal = lines.reduce((sum, l) => sum + num(l.price) * l.qty, 0);

  const run = async (fn, ok) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.success) {
      if (ok) showToast(res.stale ? `📶 ${res.message}` : ok);
      return res;
    }
    if (res.queued) { showToast(`📶 ${res.message}`); return { queued: true, data: null }; }
    showToast(`❌ ${res.message}`);
    return null;
  };

  const send = async () => {
    const res = await run(() => apiPosAddItems(checkId, lines.map((l) => ({ recipeId: l.id, quantity: l.qty }))), '✓ Sipariş mutfağa iletildi');
    if (res) { setCart({}); setMode('check'); if (res.data) setCheck(res.data); }
  };
  const loadDocs = async (id) => {
    const res = await apiFiscalForCheck(id);
    if (res.success) setDocs(res.data || []);
  };
  /** Parçalı ödeme: kalanın tamamı, tutar, kişi başı eşit bölme veya seçili kalemler */
  const pay = async (due) => {
    const body = { paymentMethod: method };
    if (payMode === 'amount' || payMode === 'equal') body.amount = r2(due);
    if (payMode === 'items') body.itemIds = picked;
    if (payMode === 'equal') body.label = `Kişi başı (${people} kişi)`;
    if (method === 'CASH' && received !== '') body.receivedAmount = num(received);
    const res = await run(() => apiPosAddPayment(checkId, body));
    if (!res) return;
    if (res.queued) { onClose(); return; }
    const r = res.data;
    setReceived(''); setPayAmount(''); setPicked([]);
    if (r.closed) {
      setReceipt(r); setMode('receipt'); loadDocs(r.checkId || checkId);
      showToast(num(r.change) > 0
        ? `✓ Tahsilat tamamlandı: ${money(r.total)} · para üstü ${money(r.change)}`
        : `✓ Tahsilat tamamlandı: ${money(r.total)}`);
    } else {
      setCheck(r); setPayMode('rest');
      showToast(`✓ ${money(r.lastPayment?.amount)} alındı · kalan ${money(r.remainingAmount)}`);
    }
  };
  const voidPayment = async () => {
    const res = await run(() => apiPosVoidPayment(voidTarget.id, reason.trim()), '✓ Tahsilat geri alındı');
    if (res && res.data) { setCheck(res.data); setVoidTarget(null); setReason(''); }
  };
  const printBill = async (type) => {
    await run(() => apiPrintCheck(receipt?.checkId || checkId, type),
      type === 'RECEIPT' ? '✓ Bilgi fişi yazıcıya gönderildi' : '✓ Adisyon yazıcıya gönderildi');
  };
  const linkOkc = async () => {
    const id = receipt?.checkId || checkId;
    const res = await run(() => apiFiscalOkc(id, okcNo.trim(), zNo.trim() || undefined), '✓ ÖKC fişi adisyona bağlandı');
    if (res && res.data) { setOkcNo(''); setZNo(''); loadDocs(id); }
  };
  const issueEArsiv = async () => {
    const id = receipt?.checkId || checkId;
    const b = Object.fromEntries(Object.entries(buyer).map(([k, v]) => [k, v.trim() || undefined]));
    const res = await run(() => apiFiscalEArsiv(id, b));
    if (res && res.data) {
      showToast(res.data.status === 'ACCEPTED' ? `✓ e-Arşiv düzenlendi: ${res.data.documentNo}` : `✓ e-Arşiv taslağı hazır: ${res.data.documentNo}`);
      loadDocs(id);
    }
  };
  const doCancel = async () => {
    const res = cancel.type === 'check'
      ? await run(() => apiPosCancelCheck(checkId, reason.trim()), '✓ Adisyon iptal edildi')
      : await run(() => apiPosCancelItem(cancel.item.id, reason.trim()), '✓ Kalem iptal edildi');
    if (res) {
      setCancel(null); setReason('');
      if (cancel.type === 'check') onClose(); else setCheck(res.data);
    }
  };
  const serve = async (item) => {
    const res = await run(() => apiPosItemStatus(item.id, 'SERVED'));
    if (res) setCheck(res.data);
  };

  /** İptal talebi / ikram / indirim / ret: doğrudan (Müdür) veya onay talebi (Kasiyer) */
  const submitAction = async () => {
    const why = reason.trim();
    const a = action;
    const v = num(discValue);
    const disc = discMode === 'percent' ? { percent: v } : { amount: v };
    let res = null;
    if (a.kind === 'cancelRequest') {
      res = await run(() => apiRequestApproval({ type: a.scope === 'check' ? 'CHECK_VOID' : 'ITEM_VOID', targetId: a.scope === 'check' ? checkId : a.item.id, reason: why }),
        '✓ İptal talebi Müdür onayına gönderildi');
    } else if (a.kind === 'comp') {
      res = canDiscount
        ? await run(() => apiPosComp(a.item.id, why), '✓ Kalem ikram edildi')
        : await run(() => apiRequestApproval({ type: 'COMP', targetId: a.item.id, reason: why }), '✓ İkram talebi Müdür onayına gönderildi');
    } else if (a.kind === 'discount') {
      res = canDiscount
        ? await run(() => apiPosDiscount(checkId, { ...disc, reason: why }), '✓ İndirim uygulandı')
        : await run(() => apiRequestApproval({ type: 'DISCOUNT', targetId: checkId, ...disc, reason: why }), '✓ İndirim talebi Müdür onayına gönderildi');
    } else if (a.kind === 'reject') {
      res = await run(() => apiDecideApproval(a.approval.id, 'REJECT', why), '✓ Talep reddedildi; Kasiyere bildirildi');
    }
    if (res) { setAction(null); setReason(''); setDiscValue(''); reload(); }
  };
  const approve = async (p) => {
    const res = await run(() => apiDecideApproval(p.id, 'APPROVE'));
    if (res) {
      showToast(res.data?.status === 'APPROVED' ? '✓ Onaylandı; işlem uygulandı' : `⚠️ Uygulanamadı: ${res.data?.decisionNote || ''}`);
      if (res.data?.type === 'CHECK_VOID' && res.data?.status === 'APPROVED') onClose(); else reload();
    }
  };
  const removeDiscount = async () => {
    const res = await run(() => apiPosRemoveDiscount(checkId), '✓ İndirim kaldırıldı');
    if (res) setCheck(res.data);
  };

  if (!checkId) return null;
  const items = (check?.items || []).filter((i) => i.status !== 'CANCELLED');
  const paidSoFar = num(check?.paidAmount);
  const remaining = check?.remainingAmount != null ? num(check.remainingAmount) : num(check?.total);
  const livePayments = (check?.payments || []).filter((p) => !p.voided);
  const paidIds = new Set(check?.paidItemIds || []);
  const payable = items.filter((i) => !i.comp && !paidIds.has(i.id));
  const pickedSum = payable.filter((i) => picked.includes(i.id)).reduce((a, i) => a + num(i.lineTotal), 0);
  let due = remaining;
  if (payMode === 'amount') due = num(payAmount);
  if (payMode === 'equal') due = Math.min(remaining, r2(num(check?.total) / Math.max(1, Number(people) || 1)));
  if (payMode === 'items') due = r2(pickedSum);
  const overpay = due - remaining > 0.009;
  const receiptPayments = (receipt?.payments || []).filter((p) => !p.voided);
  const liveDocs = docs.filter((d) => d.status !== 'CANCELLED' && d.status !== 'ERROR');
  const taxLen = buyer.buyerTaxId.replace(/\D/g, '').length;
  const buyerBad = (taxLen > 0 && taxLen !== 10 && taxLen !== 11) || (taxLen === 10 && !buyer.buyerTaxOffice.trim());
  const pending = check?.pendingApprovals || [];
  const pendingFor = (id) => pending.filter((p) => p.targetType === 'CHECK_ITEM' && p.targetId === id);
  const checkPending = pending.filter((p) => p.targetType === 'CHECK');
  const anyStarted = items.some((i) => i.status !== 'ORDERED');
  const hasDiscount = num(check?.discountAmount) > 0;
  const compTotal = num(check?.compTotal);
  const isApprover = canApproveCancel || canDiscount;
  const total = num(check?.total);
  const change = method === 'CASH' && received !== '' ? r2(num(received) - due) : null;
  const menuList = (menu || []).filter((m) => !q || m.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} transparent>
      <View style={st.overlay}>
        <View style={st.sheet}>
          <View style={[s.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={s.cardTitle} numberOfLines={1}>{receipt ? `Masa ${receipt.tableNumber} · ödendi` : check ? `Masa ${check.tableNumber}` : 'Adisyon'}</Text>
              {check?.checkNo ? <Text style={s.muted} numberOfLines={1}>{check.checkNo}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 22, color: THEME.colors.textMuted }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 520 }}>
            {mode === 'check' && (
              <>
                {pending.length > 0 && (
                  <View style={st.pendingBox}>
                    <Text style={{ fontWeight: '800', color: '#92400e' }}>⏳ {pending.length} talep Müdür kararını bekliyor · tahsilat kilitli</Text>
                    {pending.map((p) => {
                      const it = (check?.items || []).find((x) => p.targetType === 'CHECK_ITEM' && x.id === p.targetId);
                      return (
                        <View key={p.id} style={{ marginTop: 6 }}>
                          <Text style={{ color: '#78350f' }} numberOfLines={2}>
                            {APPROVAL_TYPE[p.type]?.label || p.type}{it ? `: ${it.quantity} × ${it.productName}` : ''} — {p.reason} ({p.requestedByName})
                          </Text>
                          {isApprover && (
                            <View style={[s.row, { gap: 6, marginTop: 4 }]}>
                              <Btn small label="Onayla" disabled={busy} onPress={() => approve(p)} />
                              <Btn small label="Reddet" variant="danger" disabled={busy}
                                onPress={() => { setAction({ kind: 'reject', approval: p, label: APPROVAL_TYPE[p.type]?.label }); setReason(''); }} />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
                {items.length === 0 && <Empty title="Adisyon boş" hint={canOperate ? 'Menüden ürün ekleyin.' : ''} />}
                {items.map((i) => {
                  const waiting = pendingFor(i.id).length > 0;
                  return (
                    <View key={i.id} style={st.line}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800' }} numberOfLines={2}>{i.quantity} × {i.productName}</Text>
                        <View style={[s.row, { gap: 4, flexWrap: 'wrap' }]}>
                          <Badge label={ITEM_STATUS[i.status]?.label || i.status} tone={ITEM_STATUS[i.status]?.tone} />
                          {i.comp && <Badge label="İkram" tone="info" />}
                          {waiting && <Badge label="Onay bekliyor" tone="warning" />}
                        </View>
                      </View>
                      <Text style={{ fontWeight: '800', marginRight: 6 }}>{i.comp ? money(0) : money(i.lineTotal)}</Text>
                      {canOperate && i.status === 'READY' && <Btn small label="Servis" variant="secondary" onPress={() => serve(i)} />}
                      {!i.comp && !waiting && (canOperate || canDiscount) && (
                        <Btn small label="🎁" variant="secondary" style={{ marginLeft: 4 }}
                          onPress={() => { setAction({ kind: 'comp', scope: 'item', item: i }); setReason(''); }} />
                      )}
                      {!waiting && ((canOperate && i.status === 'ORDERED') || canApproveCancel) && (
                        <Btn small label="İptal" variant="danger" style={{ marginLeft: 4 }} onPress={() => setCancel({ type: 'item', item: i })} />
                      )}
                      {!waiting && !canApproveCancel && canOperate && i.status !== 'ORDERED' && (
                        <Btn small label="İptal talebi" variant="danger" style={{ marginLeft: 4 }}
                          onPress={() => { setAction({ kind: 'cancelRequest', scope: 'item', item: i }); setReason(''); }} />
                      )}
                    </View>
                  );
                })}
                {(compTotal > 0 || hasDiscount) && (
                  <View style={{ marginTop: 8 }}>
                    <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.muted}>Ara toplam</Text><Text>{money(check?.subtotal)}</Text></View>
                    {compTotal > 0 && <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.muted}>İkram (ücretsiz)</Text><Text style={s.muted}>{money(compTotal)}</Text></View>}
                    {hasDiscount && (
                      <View style={[s.row, { justifyContent: 'space-between' }]}>
                        <Text style={s.muted} numberOfLines={1}>İndirim{check?.discountPercent ? ` %${num(check.discountPercent)}` : ''} · {check?.discountReason}</Text>
                        <Text>−{money(check?.discountAmount)}</Text>
                      </View>
                    )}
                  </View>
                )}
                <View style={[s.row, { justifyContent: 'space-between', marginVertical: 12 }]}>
                  <Text style={{ fontWeight: '800' }}>Toplam (KDV dahil)</Text>
                  <Text style={{ fontWeight: '900', fontSize: 18 }}>{money(total)}</Text>
                </View>
                {paidSoFar > 0 && (
                  <View style={[s.row, { justifyContent: 'space-between', marginTop: -6, marginBottom: 10 }]}>
                    <Text style={s.muted}>Alınan {money(paidSoFar)}</Text>
                    <Text style={{ fontWeight: '900', color: '#b45309' }}>Kalan {money(remaining)}</Text>
                  </View>
                )}
              </>
            )}

            {mode === 'receipt' && receipt && (
              <>
                <View style={[s.row, { justifyContent: 'space-between' }]}>
                  <Text style={s.muted}>Ödeme</Text>
                  <Text style={{ fontWeight: '800' }}>{METHOD_LABEL[receipt.paymentMethod] || receipt.paymentMethod}</Text>
                </View>
                {receiptPayments.length > 1 && receiptPayments.map((p) => (
                  <View key={p.id} style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={s.muted}>  · {METHOD_LABEL[p.method] || p.method}</Text><Text>{money(p.amount)}</Text>
                  </View>
                ))}
                <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.muted}>KDV</Text><Text>{money(receipt.vatAmount)}</Text></View>
                <View style={[s.row, { justifyContent: 'space-between', marginVertical: 8 }]}>
                  <Text style={{ fontWeight: '800' }}>Toplam</Text>
                  <Text style={{ fontWeight: '900', fontSize: 18 }}>{money(receipt.total)}</Text>
                </View>
                {num(receipt.change) > 0 && <Text style={{ fontWeight: '800', color: '#047857' }}>Para üstü: {money(receipt.change)}</Text>}

                <Section title="Mali belge" style={{ marginTop: 10 }}>
                  {liveDocs.length === 0
                    ? <Text style={{ color: '#92400e' }}>Henüz mali belge yok. Yazar kasa fiş no bağlayın veya e-Arşiv düzenleyin.</Text>
                    : liveDocs.map((d) => (
                      <View key={d.id} style={[s.row, { gap: 6, marginBottom: 4 }]}>
                        <Badge label={FISCAL_TYPE[d.type] || d.type} tone={d.status === 'DRAFT' ? 'warning' : 'success'} />
                        <Text style={{ flex: 1 }} numberOfLines={1}>{d.documentNo}{d.okcZNo ? ` · Z ${d.okcZNo}` : ''}</Text>
                      </View>
                    ))}
                  <Text style={[s.label, { marginTop: 8 }]}>ÖKC (yazar kasa) fiş no</Text>
                  <View style={[s.row, { gap: 6 }]}>
                    <Input style={{ flex: 2 }} keyboardType="number-pad" maxLength={20} placeholder="Fiş no" value={okcNo} onChangeText={setOkcNo} />
                    <Input style={{ flex: 1 }} keyboardType="number-pad" maxLength={10} placeholder="Z no" value={zNo} onChangeText={setZNo} />
                    <Btn small label="Bağla" disabled={!okcNo.trim() || busy} onPress={linkOkc} />
                  </View>
                  {!liveDocs.some((d) => d.type === 'E_ARSIV') && (
                    <>
                      <Text style={[s.label, { marginTop: 8 }]}>e-Arşiv fatura (boşsa Nihai Tüketici)</Text>
                      <Input placeholder="Alıcı adı / unvan" maxLength={150} value={buyer.buyerName} onChangeText={(v) => setBuyer({ ...buyer, buyerName: v })} />
                      <View style={[s.row, { gap: 6 }]}>
                        <Input style={{ flex: 1 }} keyboardType="number-pad" maxLength={11} placeholder="VKN / TCKN" value={buyer.buyerTaxId}
                          onChangeText={(v) => setBuyer({ ...buyer, buyerTaxId: v.replace(/\D/g, '') })} />
                        <Input style={{ flex: 1 }} maxLength={80} placeholder="Vergi dairesi" value={buyer.buyerTaxOffice}
                          onChangeText={(v) => setBuyer({ ...buyer, buyerTaxOffice: v })} />
                      </View>
                      {buyerBad && <Text style={{ color: '#b91c1c' }}>VKN 10 hane (vergi dairesiyle), TCKN 11 hane olmalı</Text>}
                      <Btn label="e-Arşiv düzenle" variant="secondary" disabled={busy || buyerBad} onPress={issueEArsiv} style={{ marginTop: 6 }} />
                    </>
                  )}
                </Section>
              </>
            )}

            {mode === 'menu' && (
              <>
                <Input placeholder="Ürün ara…" value={q} onChangeText={setQ} />
                {!menu ? <Text style={s.muted}>Menü yükleniyor…</Text> : menuList.map((m) => (
                  <View key={m.id} style={[st.line, !m.available && { opacity: 0.45 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800' }} numberOfLines={1}>{m.name}</Text>
                      <Text style={s.muted} numberOfLines={1}>{money(m.salePrice)} · {m.available ? `${m.availablePortions} porsiyon` : m.unavailableReason}</Text>
                    </View>
                    {cart[m.id] && <Btn small label="−" variant="secondary" onPress={() => changeQty(m, -1)} />}
                    {cart[m.id] && <Text style={{ fontWeight: '900', marginHorizontal: 8 }}>{cart[m.id].qty}</Text>}
                    <Btn small label="+" disabled={!m.available} onPress={() => changeQty(m, 1)} />
                  </View>
                ))}
              </>
            )}

            {mode === 'pay' && (
              <>
                <View style={[s.row, { justifyContent: 'space-between' }]}>
                  <Text style={s.muted} numberOfLines={1}>{paidSoFar > 0 ? `Alınan ${money(paidSoFar)}` : `Hesap ${money(total)}`}</Text>
                  <Text style={{ fontWeight: '900', fontSize: 16 }}>Kalan {money(remaining)}</Text>
                </View>
                {livePayments.map((p) => (
                  <View key={p.id} style={st.line}>
                    <Badge label={METHOD_LABEL[p.method] || p.method} tone="success" />
                    <Text style={[s.muted, { flex: 1, marginLeft: 6 }]} numberOfLines={1}>{p.label || p.paidBy}</Text>
                    <Text style={{ fontWeight: '800', marginRight: 6 }}>{money(p.amount)}</Text>
                    <Btn small label="Geri al" variant="secondary" onPress={() => { setVoidTarget(p); setReason(''); }} />
                  </View>
                ))}
                {voidTarget && (
                  <Section title={`Geri al: ${money(voidTarget.amount)} ${METHOD_LABEL[voidTarget.method] || ''}`} style={{ marginTop: 6 }}>
                    <Input placeholder="Gerekçe (ör. yanlış kart)" value={reason} onChangeText={setReason} />
                    <View style={[s.row, { marginTop: 6, gap: 8 }]}>
                      <Btn label="Vazgeç" variant="secondary" onPress={() => setVoidTarget(null)} style={{ flex: 1 }} />
                      <Btn label="Geri al" variant="danger" disabled={reason.trim().length < 3 || busy} onPress={voidPayment} style={{ flex: 1 }} />
                    </View>
                  </Section>
                )}
                <Text style={s.label}>Ne kadar alınacak?</Text>
                <View style={s.wrap}>
                  {PAY_MODES.map(([k, l]) => <Chip key={k} label={l} active={payMode === k} onPress={() => setPayMode(k)} />)}
                </View>
                {payMode === 'amount' && (
                  <Input keyboardType="decimal-pad" value={payAmount} onChangeText={setPayAmount} placeholder={`En fazla ${money(remaining)}`} />
                )}
                {payMode === 'equal' && (
                  <View style={[s.row, { gap: 8, alignItems: 'center' }]}>
                    <Stepper value={Number(people)} onChange={setPeople} min={2} max={30} />
                    <Text style={{ fontWeight: '800', flex: 1 }} numberOfLines={1}>{`Kişi başı ${money(due)}`}</Text>
                  </View>
                )}
                {payMode === 'items' && (payable.length === 0 ? <Text style={s.muted}>Ödenmemiş kalem yok</Text> : payable.map((i) => {
                  const on = picked.includes(i.id);
                  return (
                    <TouchableOpacity key={i.id} style={[st.line, on && { backgroundColor: '#ecfdf5' }]} activeOpacity={0.8}
                      onPress={() => setPicked((x) => (on ? x.filter((y) => y !== i.id) : [...x, i.id]))}>
                      <Text style={{ width: 24, fontWeight: '900', color: on ? '#047857' : THEME.colors.textMuted }}>{on ? '☑' : '☐'}</Text>
                      <Text style={{ flex: 1 }} numberOfLines={1}>{i.quantity} × {i.productName}</Text>
                      <Text style={{ fontWeight: '800' }}>{money(i.lineTotal)}</Text>
                    </TouchableOpacity>
                  );
                }))}
                {overpay && <Text style={{ color: '#b91c1c', fontWeight: '800', marginTop: 6 }}>Tutar kalan hesaptan fazla olamaz</Text>}
                <Text style={s.label}>Ödeme türü</Text>
                <View style={s.wrap}>
                  {PAYMENTS.map(([k, l]) => <Chip key={k} label={l} active={method === k} onPress={() => setMethod(k)} />)}
                </View>
                {method === 'CASH' && (
                  <>
                    <Text style={s.label}>Alınan nakit (boşsa tam tutar)</Text>
                    <Input keyboardType="decimal-pad" value={received} onChangeText={setReceived} placeholder={String(r2(due))} />
                  </>
                )}
                {change !== null && (
                  <Text style={{ marginTop: 8, fontWeight: '800', color: change < 0 ? '#b91c1c' : '#047857' }}>
                    {change < 0 ? `Eksik: ${money(-change)}` : `Para üstü: ${money(change)}`}
                  </Text>
                )}
              </>
            )}

            {mode === 'move' && (
              <Section title="Masa taşı" style={{ marginTop: 4 }}>
                <Text style={[s.muted, { marginBottom: 8 }]}>Adisyon tüm kalemleriyle seçilen boş masaya taşınır.</Text>
                <View style={st.miniGrid}>
                  {tables.filter((t) => t.status !== 'INACTIVE' && t.status !== 'OCCUPIED' && t.id !== check?.tableId).map((t) => (
                    <TouchableOpacity key={t.id} style={st.mini} activeOpacity={0.8} disabled={busy}
                      onPress={async () => {
                        const res = await run(() => apiPosTransfer(checkId, t.id), `✓ Adisyon Masa ${t.number}'e taşındı`);
                        if (res) { setMode('check'); reload(); }
                      }}>
                      <Text style={st.miniNo}>{t.number}</Text>
                      <Text style={st.miniCap} numberOfLines={1}>{t.area || ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {tables.filter((t) => t.status !== 'INACTIVE' && t.status !== 'OCCUPIED').length === 0 && <Empty title="Boş masa yok" />}
              </Section>
            )}

            {cancel && (
              <Section title={cancel.type === 'check' ? 'Adisyonu iptal et' : `İptal: ${cancel.item.productName}`} style={{ marginTop: 10 }}>
                <Text style={s.muted}>{canApproveCancel ? 'Gerekçe denetim izine yazılır.' : 'Hazırlanan kalemi Müdür iptal eder.'}</Text>
                <Input style={{ marginTop: 8 }} placeholder="Gerekçe (en az 5 karakter)" value={reason} onChangeText={setReason} />
                <View style={[s.row, { marginTop: 8, gap: 8 }]}>
                  <Btn label="Vazgeç" variant="secondary" onPress={() => setCancel(null)} style={{ flex: 1 }} />
                  <Btn label="İptal Et" variant="danger" disabled={reason.trim().length < 5 || busy} onPress={doCancel} style={{ flex: 1 }} />
                </View>
              </Section>
            )}

            {action && (
              <Section style={{ marginTop: 10 }} title={
                action.kind === 'cancelRequest' ? (action.scope === 'check' ? 'Adisyon iptal talebi' : `İptal talebi: ${action.item.productName}`)
                  : action.kind === 'comp' ? `${canDiscount ? 'İkram' : 'İkram talebi'}: ${action.item.productName}`
                    : action.kind === 'discount' ? (canDiscount ? 'İndirim' : 'İndirim talebi')
                      : `Reddet: ${action.label || ''}`
              }>
                <Text style={s.muted}>
                  {action.kind === 'cancelRequest' && 'Mutfak hazırlamaya başladı; iptal Müdür onayıyla yapılır. Karar size bildirilir.'}
                  {action.kind === 'comp' && `Kalem ücretsiz servis edilir (${money(action.item.listTotal ?? action.item.lineTotal)}); malzemeler yine stoktan düşer.${canDiscount ? '' : ' Müdür onayına gider.'}`}
                  {action.kind === 'discount' && `Adisyon (ikram hariç): ${money(check?.subtotal ?? total)}. İndirim KDV matrahından düşer.${canDiscount ? '' : ' Müdür onayına gider.'}`}
                  {action.kind === 'reject' && 'Gerekçe Kasiyere bildirimle iletilir.'}
                </Text>
                {action.kind === 'discount' && (
                  <>
                    <View style={[s.wrap, { marginTop: 8 }]}>
                      <Chip label="Yüzde (%)" active={discMode === 'percent'} onPress={() => setDiscMode('percent')} />
                      <Chip label="Tutar (₺)" active={discMode === 'amount'} onPress={() => setDiscMode('amount')} />
                    </View>
                    <Input keyboardType="decimal-pad" placeholder={discMode === 'percent' ? 'İndirim yüzdesi (1-100)' : 'İndirim tutarı'} value={discValue} onChangeText={setDiscValue} />
                  </>
                )}
                <Input style={{ marginTop: 8 }} placeholder="Gerekçe (en az 5 karakter)" value={reason} onChangeText={setReason} />
                <View style={[s.row, { marginTop: 8, gap: 8 }]}>
                  <Btn label="Vazgeç" variant="secondary" onPress={() => setAction(null)} style={{ flex: 1 }} />
                  <Btn
                    label={action.kind === 'reject' ? 'Reddet' : (canDiscount && action.kind !== 'cancelRequest') ? 'Uygula' : 'Müdüre Gönder'}
                    variant={action.kind === 'reject' || action.kind === 'cancelRequest' ? 'danger' : 'primary'}
                    disabled={busy || reason.trim().length < 5 || (action.kind === 'discount' && !(num(discValue) > 0))}
                    onPress={submitAction} style={{ flex: 1 }} />
                </View>
              </Section>
            )}
          </ScrollView>

          <View style={[s.row, { gap: 8, marginTop: 10, flexWrap: 'wrap' }]}>
            {mode === 'check' && canOperate && <Btn label="+ Ürün Ekle" onPress={openMenu} style={st.half} />}
            {mode === 'check' && canOperate && items.length > 0 && (
              <Btn label={pending.length ? 'Tahsilat 🔒' : paidSoFar > 0 ? 'Kalanı al' : 'Tahsilat'} variant="secondary" disabled={pending.length > 0} onPress={() => setMode('pay')} style={st.half} />
            )}
            {mode === 'check' && canOperate && !cancel && !action && <Btn label="Masa taşı" variant="secondary" onPress={() => setMode('move')} style={st.half} />}
            {mode === 'check' && canOperate && items.length > 0 && !cancel && !action && (
              <Btn label="🖨 Yazdır" variant="secondary" disabled={busy} onPress={() => printBill('BILL')} style={st.half} />
            )}
            {mode === 'move' && <Btn label="Geri" variant="secondary" onPress={() => setMode('check')} style={{ flex: 1 }} />}
            {mode === 'check' && items.length > 0 && !hasDiscount && !action && !cancel && (canOperate || canDiscount)
              && checkPending.every((p) => p.type !== 'DISCOUNT') && (
              <Btn label={canDiscount ? '% İndirim' : '% İndirim talebi'} variant="secondary"
                onPress={() => { setAction({ kind: 'discount', scope: 'check' }); setReason(''); setDiscValue(''); }} style={st.half} />
            )}
            {mode === 'check' && hasDiscount && canDiscount && !action && (
              <Btn label="İndirimi kaldır" variant="secondary" disabled={busy} onPress={removeDiscount} style={st.half} />
            )}
            {mode === 'check' && (canOperate || canApproveCancel) && !cancel && !action && checkPending.every((p) => p.type !== 'CHECK_VOID') && (
              !canApproveCancel && anyStarted
                ? <Btn label="Adisyon iptal talebi" variant="danger" onPress={() => { setAction({ kind: 'cancelRequest', scope: 'check' }); setReason(''); }} style={{ flexBasis: '100%' }} />
                : <Btn label="Adisyonu İptal" variant="danger" onPress={() => setCancel({ type: 'check' })} style={{ flexBasis: '100%' }} />
            )}
            {mode === 'menu' && <Btn label="Geri" variant="secondary" onPress={() => setMode('check')} style={{ flex: 1 }} />}
            {mode === 'menu' && <Btn label={`Gönder · ${moneyShort(cartTotal)}`} disabled={!lines.length || busy} onPress={send} style={{ flex: 2 }} />}
            {mode === 'pay' && <Btn label="Geri" variant="secondary" onPress={() => setMode('check')} style={{ flex: 1 }} />}
            {mode === 'pay' && (
              <Btn label={`${METHOD_LABEL[method]} · ${moneyShort(due)}`}
                disabled={busy || due <= 0 || overpay || (change !== null && change < 0) || (payMode === 'items' && !picked.length)}
                onPress={() => pay(due)} style={{ flex: 2 }} />
            )}
            {mode === 'receipt' && <Btn label="🖨 Bilgi fişi" variant="secondary" disabled={busy} onPress={() => printBill('RECEIPT')} style={{ flex: 1 }} />}
            {mode === 'receipt' && <Btn label="Tamam" onPress={onClose} style={{ flex: 1 }} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Gün sonu (Kasiyer) — KÖR SAYIM: kasiyer beklenen tutarı görmeden kasadaki nakdi sayar.
 * İlk sayım her zaman kaydedilir (fark öğrenilip sayım değiştirilemez). Beklenen tutar ve fark
 * kayıttan SONRA gösterilir; fark varsa kasiyer açıklama ekler, Muhasebe mutabakatı yapar.
 * (İç kontrol: nakit sayan ile kaydı mutabakatlayan farklı kişilerdir.)
 */
function EndOfDay({ showToast }) {
  const [z, setZ] = React.useState(null);
  const [closings, setClosings] = React.useState([]);
  const [opening, setOpening] = React.useState('0');
  const [counted, setCounted] = React.useState('');
  const [note, setNote] = React.useState('');
  const [explain, setExplain] = React.useState({});
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const [zr, cl] = await Promise.all([apiZReport(todayIso()), apiFetchCashClosings(todayIso(), todayIso())]);
    if (zr.success) setZ(zr.data); else showToast(`⚠️ ${zr.message}`);
    if (cl.success) setClosings(cl.data || []);
  }, [showToast]);
  React.useEffect(() => { load(); }, [load]);
  const { items, more } = useMore(closings, 10);

  if (!z) return <Text style={s.muted}>Yükleniyor…</Text>;
  // Bugün sayım yapıldıysa Z özeti (beklenen nakit dahil) gösterilir; yapılmadıysa gizli kalır
  const countedToday = closings.length > 0;

  const submit = async () => {
    setBusy(true);
    const res = await apiCreateCashClosing({ openingFloat: num(opening), countedCash: num(counted), note: note.trim() || undefined });
    setBusy(false);
    if (res.success) {
      const d = num(res.data?.difference);
      showToast(Math.abs(d) < 0.005 ? '✓ Sayım kaydedildi · kasa mutabık' : `⚠️ Sayım kaydedildi · ${d < 0 ? 'açık' : 'fazla'} ${money(Math.abs(d))} — açıklama ekleyin`);
      setCounted(''); setNote(''); load();
    } else showToast(`❌ ${res.message}`);
  };

  const sendExplanation = async (c) => {
    const text = (explain[c.id] || '').trim();
    if (text.length < 5) { showToast('⚠️ Açıklama en az 5 karakter'); return; }
    const res = await apiExplainCashClosing(c.id, text);
    if (res.success) { showToast('✓ Açıklama Muhasebeye iletildi'); setExplain((p) => ({ ...p, [c.id]: '' })); load(); }
    else showToast(`❌ ${res.message}`);
  };

  return (
    <View>
      {countedToday ? (
        <View style={st.strip}>
          <StripCell label="Satış" value={moneyShort(z.grossSales)} tone="#047857" />
          <View style={st.stripDiv} />
          <StripCell label="Nakit" value={moneyShort(z.cashSales)} />
          <View style={st.stripDiv} />
          <StripCell label="Kasadan ödeme" value={moneyShort(z.cashPaidOut)} />
        </View>
      ) : (
        <View style={[st.strip, { paddingHorizontal: 12 }]}>
          <Text style={[s.muted, { flex: 1 }]}>
            Kör sayım: önce kasadaki nakdi sayın. Beklenen tutar ve fark, sayım kaydedildikten sonra görünür.
          </Text>
        </View>
      )}
      <Section title="Kasa Sayımı">
        <Text style={[s.label, { marginTop: 0 }]}>Açılış kasası (₺)</Text>
        <Input keyboardType="decimal-pad" value={opening} onChangeText={setOpening} />
        <Text style={s.label}>Sayılan nakit (₺)</Text>
        <Input keyboardType="decimal-pad" value={counted} onChangeText={setCounted} placeholder="Kasada saydığınız tutar" />
        <Text style={s.label}>Not (isteğe bağlı)</Text>
        <Input value={note} onChangeText={setNote} maxLength={1000} />
        <Btn style={{ marginTop: 12 }} label="Sayımı Kaydet" disabled={busy || counted === ''} onPress={submit} />
      </Section>
      <Section title="Bugünkü Sayımlar">
        {closings.length === 0 && <Empty title="Henüz sayım yok" />}
        {items.map((c) => {
          const diff = num(c.difference);
          const needsExplanation = c.status === 'PENDING_REVIEW' && Math.abs(diff) >= 0.005 && !(c.note && c.note.trim().length >= 5);
          return (
            <View key={c.id} style={[st.line, { flexWrap: 'wrap' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800' }} numberOfLines={1}>Sayılan {moneyShort(c.countedCash)} · Beklenen {moneyShort(c.expectedCash)}</Text>
                <Text style={[s.muted, Math.abs(diff) >= 0.005 && { color: '#b45309', fontWeight: '700' }]} numberOfLines={2}>
                  {Math.abs(diff) < 0.005 ? 'Fark yok' : `${diff < 0 ? 'Açık' : 'Fazla'} ${money(Math.abs(diff))}`}{c.note ? ` · ${c.note}` : ''}{c.reviewNote ? ` · ${c.reviewNote}` : ''}
                </Text>
              </View>
              <Badge label={CLOSING_STATUS[c.status]?.label || c.status} tone={CLOSING_STATUS[c.status]?.tone} />
              {needsExplanation && (
                <View style={{ flexBasis: '100%', marginTop: 8 }}>
                  <Input value={explain[c.id] || ''} onChangeText={(v) => setExplain((p) => ({ ...p, [c.id]: v }))}
                    placeholder="Fark açıklaması (ör. para üstü hatası)" maxLength={1000} />
                  <Btn small label="Açıklamayı gönder" style={{ marginTop: 6, alignSelf: 'flex-end' }} onPress={() => sendExplanation(c)} />
                </View>
              )}
            </View>
          );
        })}
        {more}
      </Section>
    </View>
  );
}

const st = StyleSheet.create({
  offline: {
    backgroundColor: '#fef3c7', borderColor: '#fcd34d', borderWidth: 1, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8,
  },
  strip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: THEME.colors.border, paddingVertical: 10, marginBottom: 12 },
  stripCell: { flex: 1, paddingHorizontal: 10, minWidth: 0 },
  stripDiv: { width: 1, alignSelf: 'stretch', backgroundColor: THEME.colors.borderLight },
  stripLabel: { fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted },
  stripValue: { fontSize: 16, fontWeight: '900', color: THEME.colors.textPrimary, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  table: { width: '31.33%', marginHorizontal: '1%', borderWidth: 1.5, borderColor: THEME.colors.border, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 8, marginBottom: 8, minHeight: 78 },
  tableBusy: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  tableReady: { backgroundColor: '#ecfdf5', borderColor: '#34d399' },
  tableTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tableNo: { fontSize: 20, fontWeight: '900', color: THEME.colors.textPrimary, flexShrink: 1 },
  tableCap: { fontSize: 11, color: THEME.colors.textMuted, fontWeight: '700' },
  tableAmt: { fontSize: 14, fontWeight: '900', color: '#9a3412', marginTop: 6 },
  tableMeta: { fontSize: 11, color: THEME.colors.textMuted, marginTop: 1 },
  tableFree: { fontSize: 12, color: THEME.colors.textMuted, marginTop: 8, fontWeight: '600' },
  formRow: { flexDirection: 'row', alignItems: 'flex-end' },
  close: { fontSize: 18, color: THEME.colors.textMuted, paddingHorizontal: 6 },
  warn: { marginTop: 8, color: '#b45309', fontWeight: '700', fontSize: 12 },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  mini: { width: '23%', marginHorizontal: '1%', marginBottom: 6, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 10, paddingVertical: 7, alignItems: 'center', backgroundColor: '#fff' },
  miniOff: { backgroundColor: '#f1f5f9', borderStyle: 'dashed' },
  miniSel: { borderColor: THEME.colors.accentDark, borderWidth: 2, backgroundColor: '#ecfdf5' },
  miniNo: { fontSize: 16, fontWeight: '900', color: THEME.colors.textPrimary },
  miniCap: { fontSize: 10, color: THEME.colors.textMuted, fontWeight: '700', marginTop: 1 },
  editor: { marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: THEME.colors.borderLight },
  rowHead: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800', color: THEME.colors.textPrimary },
  overlay: { flex: 1, backgroundColor: 'rgba(7,25,14,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, maxHeight: '92%' },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: THEME.colors.borderLight },
  half: { flexGrow: 1, flexBasis: '46%' },
  pendingBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 10, padding: 10, marginBottom: 8 },
});
