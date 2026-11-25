import React, { useEffect, useState } from 'react'
import { FiPlus, FiDownload, FiSearch } from 'react-icons/fi'
import { useAuthStore, hasPermission } from '../../store'
import {
  PageHeader, Card, Stat, StatGrid, Tabs, Button, Loading, ErrorState, Notice, Modal, Pagination, serverPager, sortParam,
} from '../../components/ui'
import { money, pct, toNumber, currentPeriod, expenseTypeLabel, EXPENSE_STATUS, PAYMENT_STATUS, formatDate } from '../../utils/format'
import {
  useExpenseSearch, useReportSummary, useApproveExpense, useDeleteExpense,
} from '../../hooks/useExpenseQuery'
import { exportToExcel } from '../../utils/exportUtils'
import { expenseApi } from '../../api'
import { notifyError } from '../../utils/notify'
import ExpenseTable from './ExpenseTable'
import ExpenseFormModal from './ExpenseFormModal'
import { PaymentModal, RejectModal, ExpenseDetailModal, SubmitModal, FinalizeModal } from './ExpenseActionModals'
import { ZReportPanel, VatPanel, JournalPanel, PeriodsPanel, CashClosingsPanel, CashReportPanel } from './ReportPanels'
import { can } from './permissions'
import ApprovalsPanel from '../../components/ApprovalsPanel'
import { useApprovalSummary } from '../../hooks/useApprovalQuery'

/**
 * Görünüm başına sekmeler. Her sekme ayrıca izinle süzülür (sunucudan gelen user.permissions).
 *  accounting     → Muhasebe: gider/fatura kaydı, ödeme, müşavire gönderim, kasa mutabakatı, kasa raporu
 *                   (Yönetici aynı ekranı salt okunur izler)
 *  manager        → İşletme Müdürü: harcama onayı / reddi, kasa farkları
 *  advisor        → Mali Müşavir: belge kontrolü, deftere işleme, KDV, yevmiye, dönem kapanışı
 */
const VIEW_TABS = {
  accounting: ['pending', 'payable', 'submit', 'rejected', 'ledger', 'all', 'closings', 'cashreport', 'vat', 'journal', 'periods'],
  manager: ['opreq', 'pending', 'rejected', 'all', 'closings', 'cashreport'],
  advisor: ['ledger', 'finalized', 'rejected', 'cashreport', 'vat', 'journal', 'periods', 'closings'],
}

const canDecideOps = (u) => hasPermission(u, 'POS_CANCEL_APPROVE', 'POS_DISCOUNT_APPROVE', 'INVENTORY_ADJUST_APPROVE')

const TAB_PERMISSION = {
  opreq: canDecideOps,
  closings: (u) => can.cashReport(u) || can.reviewCashClosing(u),
  cashreport: (u) => can.cashReport(u),
  vat: (u) => can.vat(u),
  journal: (u) => can.journal(u),
}

/** Sunucuda sıralanabilen gider alanları */
const EXPENSE_SORTS = [
  ['', 'Varsayılan sıra'],
  ['expenseDate,desc', 'Belge tarihi (yeni → eski)'],
  ['expenseDate,asc', 'Belge tarihi (eski → yeni)'],
  ['dueDate,asc', 'Vade (yakın → uzak)'],
  ['amount,desc', 'Tutar (büyük → küçük)'],
  ['amount,asc', 'Tutar (küçük → büyük)'],
  ['title,asc', 'Açıklama (A → Z)'],
  ['counterparty,asc', 'Karşı taraf (A → Z)'],
]

export default function AccountingPage({ viewMode = 'accounting' }) {
  const user = useAuthStore((s) => s.user)
  const isAdvisorView = viewMode === 'advisor'
  const readOnly = can.readOnly(user)
  const [period, setPeriod] = useState(currentPeriod())
  const startsWithOps = viewMode === 'manager' && canDecideOps(user)
  const [tab, setTab] = useState(isAdvisorView ? 'ledger' : startsWithOps ? 'opreq' : 'pending')
  const opSummary = useApprovalSummary(startsWithOps)
  const [sort, setSort] = useState(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [formState, setFormState] = useState({ open: false, expense: null })
  const [payTarget, setPayTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [submitTarget, setSubmitTarget] = useState(null)
  const [finalizeTarget, setFinalizeTarget] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const summary = useReportSummary(period)
  const approveM = useApproveExpense()
  const deleteM = useDeleteExpense()

  // Aramayı yazarken her tuşta sunucuya gitmemek için kısa gecikme
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])
  // Sekme, dönem, arama veya sayfa boyutu değişince ilk sayfaya dön
  useEffect(() => { setPage(0) }, [tab, period, query, size, sort])

  const LIST_TABS = ['pending', 'payable', 'submit', 'rejected', 'all', 'ledger', 'finalized']
  const listKey = LIST_TABS.includes(tab) ? tab : null
  // Ödenmemiş borçlar dönemden bağımsızdır; diğer listeler seçili döneme aittir
  const searchQ = useExpenseSearch({
    tab: listKey || 'all',
    period: listKey === 'payable' ? undefined : period,
    q: query || undefined,
    sort: sortParam(sort),
    page,
    size,
  })
  const counts = searchQ.data?.meta?.counts || {}

  const tabDefs = {
    pending: { label: viewMode === 'manager' ? 'Onayımı Bekleyen' : 'Müdür Onayında', count: counts.pending },
    payable: { label: 'Ödenecek Borçlar', count: counts.payable },
    submit: { label: 'Müşavire Gönderilecek', count: counts.submit },
    rejected: { label: 'Reddedilen · Düzeltme', count: counts.rejected },
    all: { label: 'Dönemin Tüm Giderleri' },
    ledger: { label: isAdvisorView ? 'İnceleme Bekleyen Belgeler' : 'Müşavir İncelemesinde', count: counts.ledger },
    finalized: { label: 'Deftere İşlenenler' },
    vat: { label: 'KDV Ön İzleme' },
    journal: { label: 'Yevmiye Fişleri' },
    periods: { label: 'Dönemler' },
    closings: { label: can.reviewCashClosing(user) ? 'Kasa Mutabakatı' : 'Kasa Sayımları' },
    cashreport: { label: 'Kasa Raporu' },
    opreq: { label: 'İptal · İkram · İndirim · Sayım', count: opSummary.data?.pendingInbox },
  }
  const tabs = (VIEW_TABS[viewMode] || VIEW_TABS.accounting)
    .filter((id) => !TAB_PERMISSION[id] || TAB_PERMISSION[id](user))
    .map((id) => ({ id, ...tabDefs[id] }))

  const onAction = (action, e) => {
    switch (action) {
      case 'approve': setConfirm({ type: 'approve', expense: e }); break
      case 'finalize': setFinalizeTarget(e); break
      case 'submit': setSubmitTarget(e); break
      case 'delete': setConfirm({ type: 'delete', expense: e }); break
      case 'pay': setPayTarget(e); break
      case 'reject': setRejectTarget(e); break
      case 'edit': setFormState({ open: true, expense: e }); break
      default: setDetailId(e.id)
    }
  }

  const runConfirm = () => {
    const { type, expense } = confirm
    const done = { onSuccess: () => setConfirm(null) }
    if (type === 'approve') approveM.mutate(expense.id, done)
    if (type === 'delete') deleteM.mutate(expense.id, done)
  }

  // Excel: seçili dönemin tüm giderleri (sayfadan bağımsız) istek anında çekilir
  const exportPeriod = async () => {
    let list
    try {
      list = await expenseApi.getAll(period)
    } catch (err) {
      notifyError(err.message, 'Dışa aktarılamadı')
      return
    }
    const rows = (list || []).map((e) => ({
      'Belge Tarihi': formatDate(e.expenseDate),
      Dönem: e.period,
      Açıklama: e.title,
      Tür: expenseTypeLabel(e.subType),
      'Karşı Taraf': e.counterparty || '',
      'Belge No': e.invoiceNumber || '',
      'Tutar (KDV dahil)': toNumber(e.amount),
      'KDV %': toNumber(e.vatRate),
      KDV: toNumber(e.vatAmount),
      'Net Tutar': toNumber(e.netAmount),
      Ödenen: toNumber(e.paidAmount),
      Kalan: toNumber(e.remainingAmount),
      Durum: EXPENSE_STATUS[e.status]?.label || e.status,
      'Ödeme Durumu': PAYMENT_STATUS[e.paymentStatus]?.label || e.paymentStatus,
      Kaydeden: e.recordedBy,
      Onaylayan: e.approvedBy || '',
      'Müşavire Gönderen': e.submittedBy || '',
      'Deftere İşleyen': e.finalizedBy || '',
    }))
    if (!rows.length) {
      notifyError(`${period} döneminde gider kaydı yok.`, 'Dışa aktarım')
      return
    }
    exportToExcel(rows, `GastroSync_Giderler_${period}`, 'Giderler')
  }

  const s = summary.data
  return (
    <div className="gs-page animate-fade-in">
      <PageHeader
        actions={(
          <>
            <input className="gs-input" type="month" value={period} max={currentPeriod()}
              onChange={(e) => setPeriod(e.target.value || currentPeriod())} style={{ width: 160 }} aria-label="Muhasebe dönemi" />
            <Button variant="secondary" onClick={exportPeriod}><FiDownload /> Excel</Button>
            {listKey && (
              <select className="gs-select" value={sortParam(sort) || ''} aria-label="Sıralama" style={{ width: 220 }}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(',')
                  setSort(key ? { key, dir } : null)
                }}>
                {EXPENSE_SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
            {!isAdvisorView && can.create(user) && (
              <Button onClick={() => setFormState({ open: true, expense: null })}><FiPlus /> Yeni Gider</Button>
            )}
          </>
        )}
      />

      {summary.error ? <ErrorState message={summary.error.message} onRetry={summary.refetch} /> : (
        <StatGrid>
          <Stat label="Net satış (KDV hariç)" value={s ? money(s.netRevenue) : '…'} hint={s ? `Brüt ${money(s.grossRevenue)}` : ''} tone="success" />
          <Stat label="Satılan malın maliyeti" value={s ? money(s.cogs) : '…'}
            hint={s ? `Food cost ${pct(s.foodCostPercent)} (hedef ${pct(s.targetFoodCostPercent)})` : ''}
            tone={s && toNumber(s.foodCostPercent) > toNumber(s.targetFoodCostPercent) ? 'warning' : 'neutral'} />
          <Stat label="Faaliyet giderleri (net)" value={s ? money(s.operatingExpenses) : '…'} hint="Onaylı + deftere işlenmiş" />
          <Stat label="Faaliyet kârı" value={s ? money(s.operatingProfit) : '…'}
            hint={s ? `Marj ${pct(s.profitMarginPercent)} · Fire ${money(s.wasteCost)}` : ''}
            tone={s && toNumber(s.operatingProfit) < 0 ? 'danger' : 'success'} />
          <Stat label="Ödenmemiş borçlar" value={s ? money(s.unpaidPayables) : '…'} tone={s && toNumber(s.unpaidPayables) > 0 ? 'warning' : 'neutral'} />
          <Stat label="Ödenecek KDV (ön izleme)" value={s ? money(s.vatPayable) : '…'} hint={s ? `Dönem ${s.period} · ${s.periodStatus === 'CLOSED' ? 'Kapalı' : 'Açık'}` : ''} tone="info" />
        </StatGrid>
      )}

      {readOnly && (
        <Notice tone="info">
          Gözetim görünümü (salt okunur). Kayıt, ödeme ve gönderim Muhasebenin; harcama onayı İşletme Müdürünün; deftere işleme ve dönem kapanışı Mali Müşavirin görevidir.
        </Notice>
      )}
      {viewMode === 'manager' && tab === 'pending' && (
        <Notice tone="info">
          Harcama onayı yetkilendirmedir: onayladığınız gideri Muhasebe öder, faturalandırır ve Mali Müşavire gönderir. Uygun bulmadığınız kaydı gerekçeyle reddedin.
        </Notice>
      )}
      {!isAdvisorView && tab === 'submit' && (
        <Notice tone="info">
          Akış: harcama onayı → ödeme → faturalandırma (belge no ve tedarikçi) → Mali Müşavire gönderim → Mali Müşavir onayı veya gerekçeli ret.
        </Notice>
      )}
      {s?.periodStatus === 'CLOSED' && (
        <Notice tone="warning">{s.period} dönemi kapatılmıştır. Bu döneme ait kayıtlar değiştirilemez.</Notice>
      )}

      <Card padded={false}>
        <div style={{ padding: '0 12px' }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
        <div className="gs-card-body">
          {listKey && (
            <>
              <div className="gs-toolbar gs-listbar">
                <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
                  <FiSearch style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
                  <input className="gs-input" style={{ paddingLeft: 32 }} placeholder="Açıklama, tedarikçi, belge no ara…"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {listKey === 'payable' && <span className="gs-muted">Tüm dönemlerdeki onaylı ve ödenmemiş borçlar (vadeye göre)</span>}
              </div>
              {searchQ.isLoading ? <Loading /> : searchQ.error ? <ErrorState message={searchQ.error.message} onRetry={searchQ.refetch} /> : (
                <>
                  <ExpenseTable expenses={searchQ.data?.content || []} user={user} onAction={onAction} sort={sort} onSortChange={setSort} />
                  <Pagination {...serverPager(searchQ.data, setPage, setSize)} />
                </>
              )}
            </>
          )}
          {tab === 'opreq' && (
            <>
              <Notice tone="info">
                Kasiyerin hazırlanmış kalem / adisyon iptali, ikram ve indirim talepleri ile Depo Sorumlusunun eşiği aşan sayım farkları
                ({opSummary.data?.countRule || 'büyük sayım farkları'}) burada kararınızı bekler. Onayladığınız işlem hemen uygulanır;
                reddederken yazdığınız gerekçe talep sahibine iletilir. Kendi talebinize karar veremezsiniz.
              </Notice>
              <ApprovalsPanel scope="inbox" />
            </>
          )}
          {tab === 'cash' && <ZReportPanel user={user} />}
          {tab === 'closings' && <CashClosingsPanel user={user} />}
          {tab === 'cashreport' && <CashReportPanel />}
          {tab === 'vat' && <VatPanel period={period} />}
          {tab === 'journal' && <JournalPanel period={period} user={user} />}
          {tab === 'periods' && <PeriodsPanel user={user} />}
        </div>
      </Card>

      <ExpenseFormModal open={formState.open} expense={formState.expense} onClose={() => setFormState({ open: false, expense: null })} />
      <PaymentModal expense={payTarget} onClose={() => setPayTarget(null)} />
      <RejectModal expense={rejectTarget} onClose={() => setRejectTarget(null)} />
      <SubmitModal expense={submitTarget} onClose={() => setSubmitTarget(null)} />
      <FinalizeModal expense={finalizeTarget} user={user} onClose={() => setFinalizeTarget(null)} />
      <ExpenseDetailModal expenseId={detailId} onClose={() => setDetailId(null)} />

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.type === 'approve' ? 'Harcama onayı' : 'Gideri arşivle'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Vazgeç</Button>
            <Button variant={confirm?.type === 'delete' ? 'danger' : 'primary'}
              loading={approveM.isPending || deleteM.isPending} onClick={runConfirm}>
              Onaylıyorum
            </Button>
          </>
        )}
      >
        {confirm && (
          <div className="gs-form">
            <p><strong>{confirm.expense.title}</strong> · {money(confirm.expense.amount)}</p>
            {confirm.type === 'approve' && <Notice tone="info">Onay harcama yetkisidir. Ardından muhasebe ödemeyi kaydeder, faturalandırır ve Mali Müşavire gönderir.</Notice>}
            {confirm.type === 'delete' && <Notice tone="danger">Kayıt arşivlenir; denetim izinde kalır.</Notice>}
          </div>
        )}
      </Modal>
    </div>
  )
}
