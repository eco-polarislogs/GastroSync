import React, { useMemo, useState } from 'react'
import { FiPlus, FiMinus, FiSend, FiX, FiCreditCard, FiRepeat, FiSearch, FiEdit3, FiGift, FiPercent, FiCheck, FiPrinter, FiFileText } from 'react-icons/fi'
import { useAuthStore, hasPermission } from '../store'
import {
  PageHeader, Card, Stat, StatGrid, Tabs, Button, Loading, ErrorState, Notice, Modal, Field, Badge, DataTable,
  EmptyState, Pagination, serverPager,
} from '../components/ui'
import { money, formatDateTime, todayIso, SALES_PAYMENT, toNumber } from '../utils/format'
import {
  usePosLiveUpdates, usePosTables, usePosMenu, usePosCheck, usePosSummary, useClosedChecks, useOpenCheck, useAddItems,
  useCancelItem, useTransferCheck, useCancelCheck, useItemStatus, useCreateTable, useUpdateTable, usePrintCheck,
} from '../hooks/usePosQuery'
import { PayModal, ReceiptModal, FiscalModal, FiscalSummaryPanel, PrintersPanel } from './pos/PaymentAndFiscal'
import { ZReportPanel } from './accounting/ReportPanels'
import ApprovalsPanel, { RejectModal } from '../components/ApprovalsPanel'
import {
  APPROVAL_TYPE, useApprovalLiveUpdates, useApprovalSummary, useRequestApproval, useDecideApproval, useCompItem, useSetDiscount,
  useRemoveDiscount,
} from '../hooks/useApprovalQuery'

const ITEM_STATUS = {
  ORDERED: { label: 'Mutfakta sırada', tone: 'warning' },
  PREPARING: { label: 'Hazırlanıyor', tone: 'info' },
  READY: { label: 'Hazır · servis bekliyor', tone: 'success' },
  SERVED: { label: 'Servis edildi', tone: 'neutral' },
  CANCELLED: { label: 'İptal', tone: 'danger' },
}

/**
 * Masalar & Kasa.
 *  Kasiyer: adisyon açar, sipariş girer (mutfağa düşer), tahsilat alır, gün sonu kasa sayımını yapar.
 *  Müdür:   masa düzenini yönetir, hazırlanmış kalem / adisyon iptalini, ikram ve indirimi onaylar
 *           veya doğrudan uygular (sipariş ve tahsilat yapmaz).
 *  Kasiyer yetkisini aşan işlem için Müdüre gerekçeli onay talebi gönderir ("Taleplerim" sekmesinden izler).
 */
export default function PosPage() {
  const user = useAuthStore((s) => s.user)
  const canOperate = hasPermission(user, 'POS_OPERATE')
  const canManageTables = hasPermission(user, 'POS_TABLE_MANAGE')
  const canApproveCancel = hasPermission(user, 'POS_CANCEL_APPROVE')
  const canCount = hasPermission(user, 'CASH_CLOSING_CREATE')
  const [tab, setTab] = useState('tables')
  usePosLiveUpdates()
  useApprovalLiveUpdates()
  const approvals = useApprovalSummary(canOperate)

  const tabs = [
    { id: 'tables', label: 'Masalar' },
    ...(canOperate ? [{ id: 'requests', label: `Taleplerim${approvals.data?.pendingMine ? ` (${approvals.data.pendingMine})` : ''}` }] : []),
    { id: 'closed', label: 'Kapanan Adisyonlar' },
    ...(canCount ? [{ id: 'eod', label: 'Gün Sonu & Kasa Sayımı' }] : []),
    ...(canCount || canApproveCancel ? [{ id: 'fiscal', label: 'Mali Belge' }] : []),
    ...(canManageTables ? [{ id: 'layout', label: 'Masa Düzeni' }] : []),
    ...(canManageTables || canOperate ? [{ id: 'printers', label: 'Yazıcılar' }] : []),
  ]

  return (
    <div className="gs-page animate-fade-in">
      <PosSummaryStats />
      {!canOperate && (
        <Notice tone="info">
          Sipariş ve tahsilat Kasiyerin işidir. Bu ekranda masa durumunu izleyebilir{canApproveCancel ? ', Kasiyerin iptal / ikram / indirim taleplerini onaylayabilir veya doğrudan uygulayabilir' : ''}{canManageTables ? ' ve masa düzenini yönetebilirsiniz' : ''}.
        </Notice>
      )}
      <Card padded={false}>
        <div style={{ padding: '0 12px' }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
        <div className="gs-card-body">
          {tab === 'tables' && <TablesView canOperate={canOperate} canApproveCancel={canApproveCancel} />}
          {tab === 'requests' && <ApprovalsPanel scope="mine" defaultStatus="ALL" />}
          {tab === 'closed' && <ClosedChecks />}
          {tab === 'eod' && <ZReportPanel user={user} />}
          {tab === 'layout' && <TableLayout />}
          {tab === 'fiscal' && <FiscalTab canOperate={canOperate} />}
          {tab === 'printers' && <PrintersPanel canManage={canManageTables} />}
        </div>
      </Card>
    </div>
  )
}

function PosSummaryStats() {
  const { data } = usePosSummary()
  const canSeeRevenue = hasPermission(useAuthStore.getState().user, 'SALES_VIEW')
  if (!data) return null
  return (
    <StatGrid>
      <Stat label="Açık masa" value={`${data.openChecks} / ${data.activeTables}`} hint={`Açık hesap ${money(data.openTotal)}`} tone="warning" />
      {/* Kör sayım: kasayı sayan Kasiyer günün tahsilat toplamını görmez (satış raporu yetkisi olanlar görür) */}
      {canSeeRevenue
        ? <Stat label="Bugünkü tahsilat" value={money(data.revenue)} hint={`${data.paidChecks} adisyon · ort. ${money(data.averageCheck)}`} tone="success" />
        : <Stat label="Kapanan adisyon" value={data.paidChecks} tone="success" />}
      <Stat label="Mutfak sırası" value={data.kitchenQueue} hint={`${data.readyToServe} kalem servis bekliyor`} tone={data.readyToServe > 0 ? 'info' : 'neutral'} />
      <Stat label="İptal" value={data.cancelledChecks} tone={data.cancelledChecks > 0 ? 'warning' : 'neutral'} />
    </StatGrid>
  )
}

function TablesView({ canOperate, canApproveCancel }) {
  const { data: tables, isLoading, error, refetch } = usePosTables()
  const [selected, setSelected] = useState(null)
  const [area, setArea] = useState('all')
  const [receipt, setReceipt] = useState(null)
  const openM = useOpenCheck()

  const areas = useMemo(() => Array.from(new Set((tables || []).map((t) => t.area).filter(Boolean))), [tables])
  if (isLoading) return <Loading />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  if (!tables?.length) return <EmptyState title="Tanımlı masa yok" description="Masa düzenini İşletme Müdürü tanımlar." />

  const shown = tables.filter((t) => area === 'all' || t.area === area)
  const current = tables.find((t) => t.id === selected)

  const pick = (t) => {
    if (t.status === 'INACTIVE') return
    setSelected(t.id)
    if (t.status === 'FREE' && canOperate) openM.mutate({ tableId: t.id, guestCount: 2 })
  }

  return (
    <div className="pos-split">
      <div>
        {areas.length > 1 && (
          <div className="gs-filterbar">
            <select className="gs-select" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Bölüm">
              <option value="all">Tüm bölümler</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className="gs-muted">{shown.filter((t) => t.status === 'OCCUPIED').length} dolu · {shown.filter((t) => t.status === 'FREE').length} boş</span>
          </div>
        )}
        <div className="pos-grid">
          {shown.map((t) => {
            const c = t.check
            const cls = t.status === 'INACTIVE' ? 'pos-table--inactive' : c?.readyCount > 0 ? 'pos-table--ready' : c ? 'pos-table--busy' : ''
            return (
              <button key={t.id} type="button" className={`pos-table ${cls} ${selected === t.id ? 'pos-table--selected' : ''}`} onClick={() => pick(t)}>
                <span className="pos-table-no">{t.label || `Masa ${t.number}`}</span>
                <span className="pos-table-meta">{t.area} · {t.capacity} kişilik</span>
                {c ? (
                  <>
                    <strong>{money(c.total)}</strong>
                    <span className="pos-table-meta">{c.itemCount} ürün · {c.minutesOpen} dk</span>
                    {c.readyCount > 0 && <Badge tone="success">{c.readyCount} hazır</Badge>}
                    {c.pendingApprovals > 0 && <Badge tone="warning">{c.pendingApprovals} onay bekliyor</Badge>}
                    {c.hasDiscount && <Badge tone="info">İndirimli</Badge>}
                  </>
                ) : <span className="pos-table-meta">{t.status === 'INACTIVE' ? 'Kullanım dışı' : canOperate ? 'Boş · dokun ve aç' : 'Boş'}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        {current?.check ? (
          <CheckPanel checkId={current.check.id} tables={tables} canOperate={canOperate} canApproveCancel={canApproveCancel}
            onClosed={() => setSelected(null)} onPaid={(r) => { setReceipt(r); setSelected(null) }} />
        ) : (
          <Card><EmptyState title="Masa seçin" description={canOperate ? 'Boş masaya dokunduğunuzda adisyon açılır.' : 'Dolu bir masanın adisyonunu görüntüleyin.'} /></Card>
        )}
      </div>
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}

function CheckPanel({ checkId, tables, canOperate, canApproveCancel, onClosed, onPaid }) {
  const user = useAuthStore((s) => s.user)
  const canDiscount = hasPermission(user, 'POS_DISCOUNT_APPROVE')
  const { data: check, isLoading, error, refetch } = usePosCheck(checkId)
  const [cart, setCart] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [compTarget, setCompTarget] = useState(null)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [rejecting, setRejecting] = useState(null)
  const addM = useAddItems()
  const statusM = useItemStatus()
  const removeDiscountM = useRemoveDiscount()
  const decideM = useDecideApproval()
  const printM = usePrintCheck()

  if (isLoading) return <Card><Loading /></Card>
  if (error) return <Card><ErrorState message={error.message} onRetry={refetch} /></Card>
  if (!check || check.status !== 'OPEN') return <Card><EmptyState title="Adisyon kapandı" /></Card>

  const items = (check.items || []).filter((i) => i.status !== 'CANCELLED')
  const pending = check.pendingApprovals || []
  const pendingFor = (itemId) => pending.filter((p) => p.targetType === 'CHECK_ITEM' && p.targetId === itemId)
  const checkPending = pending.filter((p) => p.targetType === 'CHECK')
  const anyStarted = items.some((i) => i.status !== 'ORDERED')
  const cartLines = Object.values(cart)
  const send = () => addM.mutate(
    { checkId, items: cartLines.map((l) => ({ recipeId: l.id, quantity: l.qty, note: l.note || undefined })) },
    { onSuccess: () => { setCart({}); setMenuOpen(false) } },
  )
  const hasDiscount = toNumber(check.discountAmount) > 0

  return (
    <Card
      title={`Masa ${check.tableNumber} · ${check.checkNo}`}
      extra={<span className="gs-muted">{check.guestCount} kişi · {check.openedBy}</span>}
    >
      {pending.length > 0 && (
        <Notice tone="warning">
          <strong>{pending.length} talep İşletme Müdürü kararını bekliyor.</strong> Karar verilene kadar tahsilat yapılamaz.
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {pending.map((p) => {
              const it = (check.items || []).find((i) => i.id === p.targetId && p.targetType === 'CHECK_ITEM')
              return (
                <li key={p.id} style={{ marginBottom: 4 }}>
                  {APPROVAL_TYPE[p.type]?.label || p.type}{it ? `: ${it.productName} × ${it.quantity}` : ''} — {p.reason}
                  <span className="gs-muted"> · {p.requestedByName}</span>
                  {(canApproveCancel || canDiscount) && (
                    <span className="gs-actions" style={{ display: 'inline-flex', marginLeft: 8 }}>
                      <Button size="sm" loading={decideM.isPending && decideM.variables?.id === p.id}
                        onClick={() => decideM.mutate({ id: p.id, decision: 'APPROVE' })}><FiCheck /> Onayla</Button>
                      <Button size="sm" variant="danger" onClick={() => setRejecting({ ...p, typeLabel: APPROVAL_TYPE[p.type]?.label, summary: it ? `${it.productName} × ${it.quantity}` : `Masa ${check.tableNumber}` })}><FiX /> Reddet</Button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </Notice>
      )}
      <DataTable
        rows={items}
        empty={<EmptyState title="Adisyon boş" description={canOperate ? 'Menüden ürün ekleyin.' : ''} />}
        columns={[
          {
            key: 'productName', title: 'Ürün',
            render: (i) => (
              <div>
                <div className="gs-cell-title">{i.productName} × {i.quantity} {i.comp && <Badge tone="info">İkram</Badge>}</div>
                {i.note && <div className="gs-cell-sub">{i.note}</div>}
                {i.comp && <div className="gs-cell-sub">İkram: {i.compReason}{i.compBy ? ` · onay ${i.compBy}` : ''}</div>}
                {pendingFor(i.id).map((p) => <Badge key={p.id} tone="warning">Onay bekliyor: {APPROVAL_TYPE[p.type]?.label}</Badge>)}
              </div>
            ),
          },
          { key: 'status', title: 'Durum', render: (i) => <Badge tone={ITEM_STATUS[i.status]?.tone}>{ITEM_STATUS[i.status]?.label || i.status}</Badge> },
          {
            key: 'lineTotal', title: 'Tutar', align: 'right',
            render: (i) => (i.comp
              ? <span><s className="gs-muted">{money(i.listTotal)}</s> {money(0)}</span>
              : money(i.lineTotal)),
          },
          {
            key: 'act', title: '', align: 'right',
            render: (i) => {
              const waiting = pendingFor(i.id).length > 0
              return (
                <div className="gs-actions">
                  {canOperate && i.status === 'READY' && (
                    <Button size="sm" variant="secondary" loading={statusM.isPending} onClick={() => statusM.mutate({ itemId: i.id, status: 'SERVED' })}>Servis edildi</Button>
                  )}
                  {!i.comp && !waiting && (canDiscount || canOperate) && (
                    <Button size="sm" variant="ghost" title={canDiscount ? 'İkram et' : 'İkram talebi (Müdür onayı)'} onClick={() => setCompTarget(i)}><FiGift /></Button>
                  )}
                  {!waiting && (canApproveCancel || (canOperate && i.status === 'ORDERED')) && (
                    <Button size="sm" variant="ghost" title="Gerekçeli iptal" onClick={() => setCancelTarget({ type: 'item', item: i, request: false })}><FiX /></Button>
                  )}
                  {!waiting && !canApproveCancel && canOperate && i.status !== 'ORDERED' && (
                    <Button size="sm" variant="ghost" title="İptal talebi (hazırlanmış kalem: Müdür onayı)" onClick={() => setCancelTarget({ type: 'item', item: i, request: true })}><FiX /> Talep</Button>
                  )}
                </div>
              )
            },
          },
        ]}
      />
      <dl className="gs-kv" style={{ margin: '12px 0 4px' }}>
        {(toNumber(check.compTotal) > 0 || hasDiscount) && (<><dt>Ara toplam</dt><dd>{money(check.subtotal)}</dd></>)}
        {toNumber(check.compTotal) > 0 && (<><dt>İkram (ücretsiz)</dt><dd className="gs-muted">{money(check.compTotal)}</dd></>)}
        {hasDiscount && (
          <>
            <dt>İndirim {check.discountPercent ? `%${Number(check.discountPercent)}` : ''}</dt>
            <dd>−{money(check.discountAmount)} <span className="gs-cell-sub">{check.discountReason}{check.discountBy ? ` · onay ${check.discountBy}` : ''}</span></dd>
          </>
        )}
      </dl>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 12px' }}>
        <strong>Toplam (KDV dahil)</strong>
        <strong style={{ fontSize: '1.2rem' }}>{money(check.total)}</strong>
      </div>
      {toNumber(check.paidAmount) > 0 && (
        <Notice tone="info">{`Parçalı tahsilat: ${money(check.paidAmount)} alındı · kalan ${money(check.remainingAmount)}`}</Notice>
      )}
      <div className="gs-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        {canOperate && <Button onClick={() => setMenuOpen(true)}><FiPlus /> Ürün Ekle</Button>}
        {canOperate && items.length > 0 && (
          <Button variant="secondary" disabled={pending.length > 0} title={pending.length > 0 ? 'Müdür kararını bekleyen talep var' : ''} onClick={() => setPayOpen(true)}>
            <FiCreditCard /> {toNumber(check.paidAmount) > 0 ? 'Kalanı Tahsil Et' : 'Tahsilat'}
          </Button>
        )}
        {canOperate && items.length > 0 && (
          <Button variant="ghost" loading={printM.isPending} onClick={() => printM.mutate({ checkId, type: 'BILL' })}><FiPrinter /> Adisyon Yazdır</Button>
        )}
        {canOperate && <Button variant="ghost" onClick={() => setTransferOpen(true)}><FiRepeat /> Masa Taşı</Button>}
        {items.length > 0 && !hasDiscount && checkPending.every((p) => p.type !== 'DISCOUNT') && (canDiscount || canOperate) && (
          <Button variant="ghost" onClick={() => setDiscountOpen(true)}><FiPercent /> {canDiscount ? 'İndirim' : 'İndirim Talebi'}</Button>
        )}
        {hasDiscount && canDiscount && (
          <Button variant="ghost" loading={removeDiscountM.isPending} onClick={() => removeDiscountM.mutate(checkId)}><FiPercent /> İndirimi Kaldır</Button>
        )}
        {(canOperate || canApproveCancel) && checkPending.every((p) => p.type !== 'CHECK_VOID') && (
          <Button variant="ghost" onClick={() => setCancelTarget({ type: 'check', request: !canApproveCancel && anyStarted })}>
            <FiX /> {!canApproveCancel && anyStarted ? 'Adisyon İptal Talebi' : 'Adisyonu İptal'}
          </Button>
        )}
      </div>

      <MenuModal open={menuOpen} onClose={() => setMenuOpen(false)} cart={cart} setCart={setCart} onSend={send} sending={addM.isPending} />
      <PayModal open={payOpen} check={check} onClose={() => setPayOpen(false)} onReceipt={(r) => { setPayOpen(false); onPaid(r) }} />
      <CancelModal target={cancelTarget} checkId={checkId} onClose={() => setCancelTarget(null)} onCheckCancelled={onClosed} />
      <CompModal item={compTarget} direct={canDiscount} onClose={() => setCompTarget(null)} />
      <DiscountModal open={discountOpen} check={check} direct={canDiscount} onClose={() => setDiscountOpen(false)} />
      <TransferModal open={transferOpen} checkId={checkId} tables={tables} onClose={() => setTransferOpen(false)} />
      <RejectModal target={rejecting} onClose={() => setRejecting(null)} loading={decideM.isPending}
        onSubmit={(note) => decideM.mutate({ id: rejecting.id, decision: 'REJECT', note }, { onSuccess: () => setRejecting(null) })} />
    </Card>
  )
}

function MenuModal({ open, onClose, cart, setCart, onSend, sending }) {
  const { data: menu, isLoading } = usePosMenu(open)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const cats = useMemo(() => Array.from(new Set((menu || []).map((m) => m.category))), [menu])
  const list = (menu || []).filter((m) => (cat === 'all' || m.category === cat)
    && (!q || m.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))))
  const change = (m, delta) => setCart((c) => {
    const qty = (c[m.id]?.qty || 0) + delta
    const next = { ...c }
    if (qty <= 0) delete next[m.id]
    else next[m.id] = { id: m.id, name: m.name, price: m.salePrice, qty, note: c[m.id]?.note || '' }
    return next
  })
  const lines = Object.values(cart)
  const total = lines.reduce((s, l) => s + toNumber(l.price) * l.qty, 0)

  return (
    <Modal open={open} onClose={onClose} title="Menüden Ürün Ekle" width={860}
      footer={(
        <>
          <span className="gs-muted" style={{ marginRight: 'auto' }}>{lines.length} kalem · {money(total)}</span>
          <Button variant="secondary" onClick={onClose}>Kapat</Button>
          <Button disabled={!lines.length} loading={sending} onClick={onSend}><FiSend /> Mutfağa Gönder</Button>
        </>
      )}
    >
      <div className="gs-filterbar">
        <div className="gs-search"><FiSearch /><input className="gs-input" placeholder="Ürün ara…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="gs-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori">
          <option value="all">Tüm kategoriler</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {isLoading ? <Loading /> : (
        <div className="pos-menu">
          {list.map((m) => (
            <button key={m.id} type="button" className="pos-menu-item" disabled={!m.available} onClick={() => change(m, 1)}
              title={m.unavailableReason || ''}>
              <strong>{m.name}</strong>
              <span>{money(m.salePrice)}</span>
              <span className="gs-cell-sub">{m.available ? `${m.availablePortions} porsiyon stok` : m.unavailableReason}</span>
              {cart[m.id] && <Badge tone="success">Sepette {cart[m.id].qty}</Badge>}
            </button>
          ))}
          {!list.length && <EmptyState title="Ürün bulunamadı" />}
        </div>
      )}
      {lines.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {lines.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>
              <span style={{ flex: 1 }}>{l.name}</span>
              <Button size="sm" variant="ghost" onClick={() => change({ id: l.id }, -1)}><FiMinus /></Button>
              <strong>{l.qty}</strong>
              <Button size="sm" variant="ghost" onClick={() => change({ id: l.id, name: l.name, salePrice: l.price }, 1)}><FiPlus /></Button>
              <input className="gs-input" style={{ maxWidth: 220 }} placeholder="Not (ör. acısız)" maxLength={200} value={l.note}
                onChange={(e) => setCart((c) => ({ ...c, [l.id]: { ...c[l.id], note: e.target.value } }))} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function CancelModal({ target, checkId, onClose, onCheckCancelled }) {
  const [reason, setReason] = useState('')
  const itemM = useCancelItem()
  const checkM = useCancelCheck()
  const requestM = useRequestApproval()
  if (!target) return null
  const isCheck = target.type === 'check'
  const isRequest = !!target.request
  const submit = () => {
    const why = reason.trim()
    const done = { onSuccess: () => { setReason(''); onClose(); if (isCheck && !isRequest) onCheckCancelled() } }
    if (isRequest) {
      requestM.mutate({ type: isCheck ? 'CHECK_VOID' : 'ITEM_VOID', targetId: isCheck ? checkId : target.item.id, reason: why }, done)
    } else if (isCheck) checkM.mutate({ checkId, reason: why }, done)
    else itemM.mutate({ itemId: target.item.id, reason: why }, done)
  }
  const title = isCheck
    ? (isRequest ? 'Adisyon iptal talebi' : 'Adisyonu iptal et')
    : `${isRequest ? 'İptal talebi' : 'İptal'}: ${target.item.productName}`
  return (
    <Modal open onClose={onClose} title={title}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button variant="danger" disabled={reason.trim().length < 5} loading={itemM.isPending || checkM.isPending || requestM.isPending} onClick={submit}>
            {isRequest ? 'Müdür Onayına Gönder' : 'İptal Et'}
          </Button>
        </>
      )}>
      <div className="gs-form">
        <Notice tone={isRequest ? 'info' : 'warning'}>
          {isRequest
            ? 'Mutfak hazırlamaya başladığı için iptal İşletme Müdürü onayıyla yapılır. Talebiniz bildirim olarak Müdüre gider; karar verilince size bildirilir.'
            : 'İptal gerekçesiyle denetim izine yazılır. Hazırlanmaya başlamış kalemin iptali yalnızca İşletme Müdürü yetkisindedir.'}
        </Notice>
        <Field label="Gerekçe" required>
          <input className="gs-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ör. müşteri vazgeçti, yanlış sipariş girildi" />
        </Field>
      </div>
    </Modal>
  )
}

/** İkram: Müdür doğrudan uygular; Kasiyer gerekçeyle talep eder */
function CompModal({ item, direct, onClose }) {
  const [reason, setReason] = useState('')
  const compM = useCompItem()
  const requestM = useRequestApproval()
  if (!item) return null
  const done = { onSuccess: () => { setReason(''); onClose() } }
  const submit = () => (direct
    ? compM.mutate({ itemId: item.id, reason: reason.trim() }, done)
    : requestM.mutate({ type: 'COMP', targetId: item.id, reason: reason.trim() }, done))
  return (
    <Modal open onClose={onClose} title={`${direct ? 'İkram' : 'İkram talebi'}: ${item.productName} × ${item.quantity}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button disabled={reason.trim().length < 5} loading={compM.isPending || requestM.isPending} onClick={submit}>
            <FiGift /> {direct ? 'İkram Et' : 'Müdür Onayına Gönder'}
          </Button>
        </>
      )}>
      <div className="gs-form">
        <Notice tone="info">
          İkram edilen kalem müşteriden alınmaz ({money(item.listTotal ?? item.lineTotal)}), ancak reçete malzemeleri stoktan düşer ve maliyeti
          raporlarda “ikram” olarak görünür. {direct ? '' : 'Kasiyer ikramı İşletme Müdürü onayıyla yapar.'}
        </Notice>
        <Field label="Gerekçe" required>
          <input className="gs-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ör. uzun bekleme için özür ikramı, düzenli müşteri" />
        </Field>
      </div>
    </Modal>
  )
}

/** İndirim: yüzde veya tutar. Müdür doğrudan uygular; Kasiyer talep eder */
function DiscountModal({ open, check, direct, onClose }) {
  const [mode, setMode] = useState('percent')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const discountM = useSetDiscount()
  const requestM = useRequestApproval()
  if (!open) return null
  const base = toNumber(check.subtotal ?? check.total)
  const v = toNumber(value)
  const preview = mode === 'percent' ? Math.min(base, (base * v) / 100) : Math.min(base, v)
  const invalid = !(v > 0) || (mode === 'percent' ? v > 100 : v > base) || reason.trim().length < 5
  const body = mode === 'percent' ? { percent: v } : { amount: v }
  const done = { onSuccess: () => { setValue(''); setReason(''); onClose() } }
  const submit = () => (direct
    ? discountM.mutate({ checkId: check.id, ...body, reason: reason.trim() }, done)
    : requestM.mutate({ type: 'DISCOUNT', targetId: check.id, ...body, reason: reason.trim() }, done))
  return (
    <Modal open onClose={onClose} title={`${direct ? 'İndirim' : 'İndirim talebi'} · Masa ${check.tableNumber}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button disabled={invalid} loading={discountM.isPending || requestM.isPending} onClick={submit}>
            <FiPercent /> {direct ? 'İndirimi Uygula' : 'Müdür Onayına Gönder'}
          </Button>
        </>
      )}>
      <div className="gs-form">
        <Field label="İndirim türü">
          <div className="gs-actions" style={{ justifyContent: 'flex-start' }}>
            <Button variant={mode === 'percent' ? 'primary' : 'secondary'} onClick={() => setMode('percent')}>Yüzde (%)</Button>
            <Button variant={mode === 'amount' ? 'primary' : 'secondary'} onClick={() => setMode('amount')}>Tutar (₺)</Button>
          </div>
        </Field>
        <Field label={mode === 'percent' ? 'İndirim yüzdesi' : 'İndirim tutarı (₺)'} required hint={`Adisyon (ikram hariç): ${money(base)}`}>
          <input className="gs-input" type="number" min="0" step={mode === 'percent' ? '1' : '0.01'} max={mode === 'percent' ? 100 : base}
            value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label="Gerekçe" required>
          <input className="gs-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ör. öğrenci indirimi, kurumsal anlaşma" />
        </Field>
        {v > 0 && <Notice tone="info">İndirim {money(preview)} · Ödenecek {money(base - preview)}. İndirim KDV matrahından düşülür ve satış satırlarına oransal dağıtılır.</Notice>}
      </div>
    </Modal>
  )
}

function TransferModal({ open, checkId, tables, onClose }) {
  const [target, setTarget] = useState('')
  const m = useTransferCheck()
  if (!open) return null
  const free = (tables || []).filter((t) => t.status === 'FREE')
  return (
    <Modal open onClose={onClose} title="Adisyonu başka masaya taşı"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button disabled={!target} loading={m.isPending} onClick={() => m.mutate({ checkId, tableId: Number(target) }, { onSuccess: onClose })}>Taşı</Button>
        </>
      )}>
      <Field label="Boş masa">
        <select className="gs-select" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Seçin…</option>
          {free.map((t) => <option key={t.id} value={t.id}>{t.label || `Masa ${t.number}`} · {t.area}</option>)}
        </select>
      </Field>
    </Modal>
  )
}

function ClosedChecks() {
  const [fiscalCheck, setFiscalCheck] = useState(null)
  const [date, setDate] = useState(todayIso())
  const [status, setStatus] = useState('PAID')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const { data, isLoading, error, refetch } = useClosedChecks({ date, status, page, size })
  return (
    <>
      <div className="gs-filterbar">
        <input className="gs-input" type="date" max={todayIso()} value={date} onChange={(e) => { setDate(e.target.value); setPage(0) }} style={{ maxWidth: 180 }} />
        <select className="gs-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} style={{ maxWidth: 200 }}>
          <option value="PAID">Ödenenler</option>
          <option value="CANCELLED">İptal edilenler</option>
        </select>
      </div>
      {isLoading ? <Loading /> : error ? <ErrorState message={error.message} onRetry={refetch} /> : (
        <>
          <DataTable
            rows={data?.content || []}
            columns={[
              { key: 'checkNo', title: 'Adisyon' },
              { key: 'tableNumber', title: 'Masa', render: (c) => `Masa ${c.tableNumber}` },
              { key: 'closedAt', title: 'Kapanış', render: (c) => formatDateTime(c.closedAt) },
              { key: 'paymentMethod', title: 'Ödeme', render: (c) => (c.paymentMethod === 'MIXED' ? 'Karışık (parçalı)' : SALES_PAYMENT[c.paymentMethod] || c.paymentMethod || '-') },
              { key: 'closedBy', title: 'Kasiyer' },
              { key: 'total', title: 'Tutar', align: 'right', render: (c) => money(c.total) },
              ...(status === 'PAID' ? [{
                key: 'fiscal', title: '', align: 'right',
                render: (c) => <Button size="sm" variant="ghost" title="Mali belge / fiş" onClick={() => setFiscalCheck(c)}><FiFileText /></Button>,
              }] : []),
            ]}
          />
          <Pagination {...serverPager(data, setPage, setSize)} />
        </>
      )}
      <FiscalModal check={fiscalCheck} onClose={() => setFiscalCheck(null)} />
    </>
  )
}

function FiscalTab({ canOperate }) {
  const [check, setCheck] = useState(null)
  return (
    <>
      <FiscalSummaryPanel onOpen={canOperate ? setCheck : undefined} />
      <FiscalModal check={check} onClose={() => setCheck(null)} />
    </>
  )
}

function TableLayout() {
  const { data: tables, isLoading } = usePosTables()
  const createM = useCreateTable()
  const updateM = useUpdateTable()
  const [form, setForm] = useState({ number: '', area: 'Salon', capacity: 4 })
  const [edit, setEdit] = useState(null)
  if (isLoading) return <Loading />
  return (
    <div className="gs-grid-2">
      <Card title="Masa Ekle">
        <div className="gs-form">
          <div className="gs-form-row">
            <Field label="Masa no" required><input className="gs-input" type="number" min="1" max="999" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
            <Field label="Kişi"><input className="gs-input" type="number" min="1" max="30" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
          </div>
          <Field label="Bölüm"><input className="gs-input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Salon, Bahçe, Teras…" /></Field>
          <Button disabled={!form.number} loading={createM.isPending}
            onClick={() => createM.mutate({ number: Number(form.number), area: form.area, capacity: Number(form.capacity) }, { onSuccess: () => setForm({ ...form, number: '' }) })}>
            <FiPlus /> Masa Ekle
          </Button>
        </div>
      </Card>
      <Card title="Tanımlı Masalar">
        <DataTable
          rows={tables || []}
          columns={[
            { key: 'number', title: 'No', render: (t) => t.label || `Masa ${t.number}` },
            { key: 'area', title: 'Bölüm' },
            { key: 'capacity', title: 'Kişi', align: 'right' },
            { key: 'status', title: 'Durum', render: (t) => <Badge tone={t.status === 'INACTIVE' ? 'neutral' : t.status === 'FREE' ? 'success' : 'warning'}>{t.status === 'INACTIVE' ? 'Kapalı' : t.status === 'FREE' ? 'Boş' : 'Dolu'}</Badge> },
            {
              key: 'act', title: '', align: 'right',
              render: (t) => (
                <div className="gs-actions">
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ id: t.id, area: t.area, capacity: t.capacity })}><FiEdit3 /></Button>
                  <Button size="sm" variant="secondary" loading={updateM.isPending}
                    onClick={() => updateM.mutate({ id: t.id, active: t.status === 'INACTIVE' })}>
                    {t.status === 'INACTIVE' ? 'Kullanıma aç' : 'Kapat'}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Masayı düzenle"
        footer={<Button loading={updateM.isPending} onClick={() => updateM.mutate({ id: edit.id, area: edit.area, capacity: Number(edit.capacity) }, { onSuccess: () => setEdit(null) })}>Kaydet</Button>}>
        {edit && (
          <div className="gs-form">
            <Field label="Bölüm"><input className="gs-input" value={edit.area} onChange={(e) => setEdit({ ...edit, area: e.target.value })} /></Field>
            <Field label="Kişi"><input className="gs-input" type="number" min="1" max="30" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
