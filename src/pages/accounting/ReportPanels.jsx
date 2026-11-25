import React, { useMemo, useState } from 'react'
import { FiDownload, FiLock, FiUnlock } from 'react-icons/fi'
import { Card, Button, Field, Notice, Loading, ErrorState, DataTable, Badge, StatGrid, Stat, Modal, Pagination, usePaged, useSorted } from '../../components/ui'
import { money, toNumber, formatDateTime, formatDate, todayIso, SALES_PAYMENT, appLocale } from '../../utils/format'
import {
  useZReport, useVatReport, useJournal, usePeriods, useCreateCashClosing, useClosePeriod, useReopenPeriod,
} from '../../hooks/useExpenseQuery'
import { exportToExcel, exportToCSV } from '../../utils/exportUtils'
import { notifySuccess, notifyError } from '../../utils/notify'
import { reportApi } from '../../api'
import { useCashClosings, useCashReport, useReviewCashClosing } from '../../hooks/usePosQuery'
import { can } from './permissions'

// ── Z raporu & kasa sayımı ─────────────────────────────────────
export function ZReportPanel({ user }) {
  const [date, setDate] = useState(todayIso())
  const [opening, setOpening] = useState('0')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [explain, setExplain] = useState({})
  const { data, isLoading, error, refetch } = useZReport(date)
  const closeM = useCreateCashClosing()

  if (isLoading) return <Loading />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  // KÖR SAYIM: sayımı yapan kişi, o gün için sayım kaydedilene kadar beklenen nakdi ve satış toplamlarını görmez.
  // İlk sayım her zaman kaydedilir; fark varsa sayan kişi sonradan açıklama ekler, Muhasebe mutabakatı yapar.
  const counter = can.cashClosing(user)
  const blind = counter && !(data.closings || []).length
  const expected = toNumber(opening) + toNumber(data.cashSales) - toNumber(data.cashPaidOut)

  const submit = () => closeM.mutate(
    { date, openingFloat: toNumber(opening), countedCash: toNumber(counted), note },
    {
      onSuccess: (saved) => {
        const d = toNumber(saved?.difference)
        notifySuccess(Math.abs(d) < 0.005 ? 'Sayım kaydedildi · kasa mutabık' : `Sayım kaydedildi · kasa ${d < 0 ? 'açığı' : 'fazlası'} ${money(Math.abs(d))}; açıklama ekleyin`)
        setCounted(''); setNote(''); refetch()
      },
    },
  )
  const sendExplanation = async (c) => {
    const text = (explain[c.id] || '').trim()
    if (text.length < 5) { notifyError('Açıklama en az 5 karakter olmalı'); return }
    try {
      await reportApi.explainCashClosing(c.id, text)
      notifySuccess('Açıklama Muhasebeye iletildi')
      setExplain((p) => ({ ...p, [c.id]: '' }))
      refetch()
    } catch (e) { notifyError(e.message) }
  }
  const awaitingExplanation = counter
    ? (data.closings || []).filter((c) => c.status === 'PENDING_REVIEW' && Math.abs(toNumber(c.difference)) >= 0.005
      && !(c.note && c.note.trim().length >= 5) && (c.closedBy || '').toLowerCase() === (user?.name || '').toLowerCase())
    : []

  return (
    <div className="gs-page">
      <div className="gs-toolbar">
        <Field label="İş günü">
          <input className="gs-input" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      {blind ? (
        <Notice tone="info">Kör sayım: önce kasadaki nakdi sayıp kaydedin. Satış toplamları, beklenen nakit ve fark sayım kaydedildikten sonra görünür.</Notice>
      ) : (
      <StatGrid>
        <Stat label="Toplam satış (KDV dahil)" value={money(data.grossSales)} hint={`${data.receiptCount} adisyon · ${data.lineCount} satır`} tone="success" />
        {Object.entries(data.salesByPaymentMethod || {}).map(([k, v]) => (
          <Stat key={k} label={SALES_PAYMENT[k] || k} value={money(v)} />
        ))}
        <Stat label="Hesaplanan KDV" value={money(data.totalVat)} />
        <Stat label="İptal edilen satış" value={money(data.voidAmount)} hint={`${data.voidCount} satır`} tone={data.voidCount > 0 ? 'warning' : 'neutral'} />
      </StatGrid>
      )}

      <div className="gs-grid-2">
        <Card title="Kasa Mutabakatı">
          {!blind && (
          <dl className="gs-kv">
            <dt>Nakit satışlar</dt><dd>{money(data.cashSales)}</dd>
            <dt>Kasadan nakit ödemeler</dt><dd>- {money(data.cashPaidOut)}</dd>
            <dt>Açılış kasası (devir)</dt><dd>{money(opening)}</dd>
            <dt>Beklenen nakit</dt><dd>{money(expected)}</dd>
          </dl>
          )}
          {can.cashClosing(user) ? (
            <div className="gs-form" style={{ marginTop: 14 }}>
              <div className="gs-form-row">
                <Field label="Açılış kasası (₺)">
                  <input className="gs-input" type="number" min="0" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} />
                </Field>
                <Field label="Sayılan nakit (₺)" required>
                  <input className="gs-input" type="number" min="0" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Kasada saydığınız tutar" />
                </Field>
              </div>
              <Field label="Not (isteğe bağlı)">
                <input className="gs-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
              </Field>
              <Button onClick={submit} loading={closeM.isPending} disabled={counted === ''}>
                Kasa Sayım Tutanağını Kaydet
              </Button>
              {awaitingExplanation.map((c) => (
                <Notice key={c.id} tone="warning">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>
                      {formatDateTime(c.closedAt)} sayımında kasa {toNumber(c.difference) < 0 ? 'açığı' : 'fazlası'} {money(Math.abs(toNumber(c.difference)))}. Açıklama ekleyin; Muhasebe açıklamasız farkı onaylayamaz.
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="gs-input" value={explain[c.id] || ''} maxLength={1000} placeholder="Fark açıklaması"
                        onChange={(e) => setExplain((p) => ({ ...p, [c.id]: e.target.value }))} />
                      <Button size="sm" onClick={() => sendExplanation(c)}>Gönder</Button>
                    </div>
                  </div>
                </Notice>
              ))}
            </div>
          ) : <Notice tone="info">Gün sonu kasa sayımını Kasiyer girer; Muhasebe mutabakatı yapar.</Notice>}
        </Card>

        <Card title="Bu Güne Ait Kasa Sayımları">
          <DataTable
            rows={data.closings || []}
            columns={[
              { key: 'closedAt', title: 'Saat', render: (c) => formatDateTime(c.closedAt) },
              { key: 'expectedCash', title: 'Beklenen', align: 'right', render: (c) => money(c.expectedCash) },
              { key: 'countedCash', title: 'Sayılan', align: 'right', render: (c) => money(c.countedCash) },
              {
                key: 'difference', title: 'Fark', align: 'right',
                render: (c) => <Badge tone={toNumber(c.difference) === 0 ? 'success' : 'warning'}>{money(c.difference)}</Badge>,
              },
              { key: 'closedBy', title: 'Sayan', render: (c) => <span title={c.note || ''}>{c.closedBy}</span> },
              { key: 'status', title: 'Mutabakat', render: (c) => <ClosingStatus c={c} /> },
            ]}
          />
          <p className="gs-muted" style={{ marginTop: 10 }}>{data.disclaimer}</p>
        </Card>
      </div>
    </div>
  )
}

const CLOSING_STATUS = {
  PENDING_REVIEW: { label: 'Muhasebe onayı bekliyor', tone: 'warning' },
  RECONCILED: { label: 'Mutabık', tone: 'success' },
  REJECTED: { label: 'Yeniden sayım istendi', tone: 'danger' },
}

function ClosingStatus({ c }) {
  const s = CLOSING_STATUS[c.status] || { label: c.status, tone: 'neutral' }
  return <Badge tone={s.tone} title={c.reviewNote || ''}>{s.label}</Badge>
}

const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// ── Kasa sayımı mutabakatı (Muhasebe) ─────────────────────────
const CLOSING_SORT = {
  businessDate: (c) => c.businessDate,
  difference: (c) => toNumber(c.difference),
  countedCash: (c) => toNumber(c.countedCash),
  closedBy: (c) => c.closedBy,
  status: (c) => c.status,
}

export function CashClosingsPanel({ user }) {
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(todayIso())
  const [status, setStatus] = useState('all')
  const [review, setReview] = useState(null)
  const { data, isLoading, error, refetch } = useCashClosings(from, to)
  const reviewM = useReviewCashClosing()
  const canReview = can.reviewCashClosing(user)

  const filtered = useMemo(() => (data || []).filter((c) => status === 'all' || c.status === status), [data, status])
  const { sorted, sort, setSort } = useSorted(filtered, CLOSING_SORT, { key: 'businessDate', dir: 'desc' })
  const { items, pager } = usePaged(sorted, 10)
  const pending = (data || []).filter((c) => c.status === 'PENDING_REVIEW').length
  const totalDiff = (data || []).reduce((s, c) => s + toNumber(c.difference), 0)

  return (
    <div className="gs-page">
      <StatGrid>
        <Stat label="Mutabakat bekleyen" value={pending} tone={pending ? 'warning' : 'success'} />
        <Stat label="Seçili aralıkta kasa farkı" value={money(totalDiff)} tone={Math.abs(totalDiff) >= 0.005 ? 'warning' : 'neutral'} />
        <Stat label="Tutanak sayısı" value={(data || []).length} />
      </StatGrid>
      <div className="gs-filterbar">
        <input className="gs-input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 170 }} aria-label="Başlangıç" />
        <input className="gs-input" type="date" value={to} min={from} max={todayIso()} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 170 }} aria-label="Bitiş" />
        <select className="gs-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }} aria-label="Durum">
          <option value="all">Tüm durumlar</option>
          {Object.entries(CLOSING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {isLoading ? <Loading /> : error ? <ErrorState message={error.message} onRetry={refetch} /> : (
        <>
          <DataTable
            rows={items}
            sort={sort}
            onSortChange={setSort}
            columns={[
              { key: 'businessDate', sortKey: 'businessDate', title: 'İş günü', render: (c) => formatDate(c.businessDate) },
              { key: 'cashSales', title: 'Nakit satış', align: 'right', render: (c) => money(c.cashSales) },
              { key: 'cardSales', title: 'Kart / Yemek k.', align: 'right', render: (c) => `${money(c.cardSales)} / ${money(c.mealCardSales)}` },
              { key: 'expectedCash', title: 'Beklenen', align: 'right', render: (c) => money(c.expectedCash) },
              { key: 'countedCash', sortKey: 'countedCash', title: 'Sayılan', align: 'right', render: (c) => money(c.countedCash) },
              {
                key: 'difference', sortKey: 'difference', title: 'Fark', align: 'right',
                render: (c) => <Badge tone={toNumber(c.difference) === 0 ? 'success' : 'warning'} title={c.note || ''}>{money(c.difference)}</Badge>,
              },
              { key: 'closedBy', sortKey: 'closedBy', title: 'Kasiyer', render: (c) => <span title={formatDateTime(c.closedAt)}>{c.closedBy}</span> },
              { key: 'status', sortKey: 'status', title: 'Mutabakat', render: (c) => <ClosingStatus c={c} /> },
              {
                key: 'act', title: '', align: 'right',
                render: (c) => (canReview && c.status === 'PENDING_REVIEW' ? (
                  <div className="gs-actions">
                    <Button size="sm" onClick={() => setReview({ c, decision: 'APPROVE', note: '' })}>Mutabık</Button>
                    <Button size="sm" variant="danger" onClick={() => setReview({ c, decision: 'REJECT', note: '' })}>Yeniden say</Button>
                  </div>
                ) : (c.reviewedBy ? <span className="gs-cell-sub">{c.reviewedBy}</span> : null)),
              },
            ]}
          />
          <Pagination {...pager} />
        </>
      )}
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={review?.decision === 'APPROVE' ? 'Kasa sayımını onayla' : 'Yeniden sayım iste'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setReview(null)}>Vazgeç</Button>
            <Button
              variant={review?.decision === 'APPROVE' ? 'primary' : 'danger'}
              loading={reviewM.isPending}
              disabled={review?.decision === 'REJECT' && (review?.note || '').trim().length < 10}
              onClick={() => reviewM.mutate(
                { id: review.c.id, decision: review.decision, note: review.note.trim() || undefined },
                { onSuccess: () => setReview(null) },
              )}
            >
              {review?.decision === 'APPROVE' ? 'Mutabık' : 'Reddet'}
            </Button>
          </>
        )}
      >
        {review && (
          <div className="gs-form">
            <p>{formatDate(review.c.businessDate)} · {review.c.closedBy} · fark <strong>{money(review.c.difference)}</strong></p>
            {review.c.note && <Notice tone="info">Kasiyer açıklaması: {review.c.note}</Notice>}
            <Notice tone="info">Z özeti, POS slipleri ve yemek kartı raporlarını sayımla karşılaştırın. Kendi girdiğiniz sayımı onaylayamazsınız.</Notice>
            <Field label={review.decision === 'REJECT' ? 'Gerekçe (zorunlu, en az 10 karakter)' : 'Not'}>
              <input className="gs-input" value={review.note} maxLength={500} onChange={(e) => setReview({ ...review, note: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Günlük / aylık / yıllık kasa ve gelir raporu ──────────────
const CASH_COLUMNS = [
  { key: 'grossSales', title: 'Satış (KDV dahil)' },
  { key: 'netSales', title: 'Net satış' },
  { key: 'cashSales', title: 'Nakit' },
  { key: 'cardSales', title: 'Kart' },
  { key: 'mealCardSales', title: 'Yemek kartı' },
  { key: 'payments', title: 'Ödemeler' },
  { key: 'cashPayments', title: 'Kasadan ödeme' },
  { key: 'netCashFlow', title: 'Net nakit' },
  { key: 'countDifference', title: 'Sayım farkı' },
]

const CASH_SORT = Object.fromEntries([
  ['period', (r) => r.period],
  ['receiptCount', (r) => r.receiptCount],
  ...CASH_COLUMNS.map((c) => [c.key, (r) => toNumber(r[c.key])]),
])

const thisYear = () => Number(todayIso().slice(0, 4))

export function CashReportPanel() {
  const [granularity, setGranularity] = useState('day')
  const [month, setMonth] = useState(todayIso().slice(0, 7))
  const [year, setYear] = useState(String(thisYear()))
  const period = granularity === 'day' ? month : granularity === 'month' ? year : undefined
  const { data, isLoading, error, refetch } = useCashReport(granularity, period)
  const rows = useMemo(() => data?.rows || [], [data])
  const { sorted, sort, setSort } = useSorted(rows, CASH_SORT, null)
  const { items, pager } = usePaged(sorted, granularity === 'day' ? 31 : 12)
  const t = data?.totals || {}
  const label = (p) => {
    if (granularity === 'day') return formatDate(p)
    if (granularity === 'month') return new Date(`${p}-01T00:00:00`).toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' })
    return p
  }
  const exportRows = () => exportToExcel(rows.map((r) => ({
    Dönem: label(r.period),
    Adisyon: r.receiptCount,
    ...Object.fromEntries(CASH_COLUMNS.map((c) => [c.title, toNumber(r[c.key])])),
  })), `GastroSync_Kasa_Raporu_${data?.label || granularity}`, 'Kasa Raporu')

  return (
    <div className="gs-page">
      <div className="gs-filterbar">
        {[['day', 'Günlük'], ['month', 'Aylık'], ['year', 'Yıllık']].map(([g, l]) => (
          <Button key={g} size="sm" variant={granularity === g ? 'primary' : 'secondary'} onClick={() => setGranularity(g)}>{l}</Button>
        ))}
        {granularity === 'day' && (
          <input className="gs-input" type="month" value={month} max={todayIso().slice(0, 7)}
            onChange={(e) => setMonth(e.target.value || todayIso().slice(0, 7))} style={{ maxWidth: 170 }} aria-label="Ay" />
        )}
        {granularity === 'month' && (
          <select className="gs-select" value={year} onChange={(e) => setYear(e.target.value)} style={{ maxWidth: 120 }} aria-label="Yıl">
            {Array.from({ length: 6 }, (_, i) => String(thisYear() - i)).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <Button size="sm" variant="secondary" onClick={exportRows} disabled={!rows.length}><FiDownload /> Excel</Button>
      </div>
      {isLoading ? <Loading /> : error ? <ErrorState message={error.message} onRetry={refetch} /> : (
        <>
          <StatGrid>
            <Stat label="Toplam tahsilat (KDV dahil)" value={money(t.grossSales)} hint={`${t.receiptCount || 0} adisyon`} tone="success" />
            <Stat label="Net satış (KDV hariç)" value={money(t.netSales)} hint={`KDV ${money(t.vat)}`} />
            <Stat label="Nakit satış" value={money(t.cashSales)} hint={`Kart ${money(t.cardSales)} · Yemek k. ${money(t.mealCardSales)}`} />
            <Stat label="Ödenen giderler" value={money(t.payments)} hint={`Kasa ${money(t.cashPayments)} · Banka ${money(t.bankPayments)}`} tone="warning" />
            <Stat label="Net nakit akışı (kasa)" value={money(t.netCashFlow)} tone={toNumber(t.netCashFlow) < 0 ? 'danger' : 'success'} />
            <Stat label="Sayım farkı" value={money(t.countDifference)} tone={Math.abs(toNumber(t.countDifference)) >= 0.005 ? 'warning' : 'neutral'} />
          </StatGrid>
          <DataTable
            rowKey="period"
            rows={items}
            sort={sort}
            onSortChange={setSort}
            columns={[
              { key: 'period', sortKey: 'period', title: 'Dönem', render: (r) => label(r.period) },
              { key: 'receiptCount', sortKey: 'receiptCount', title: 'Adisyon', align: 'right' },
              ...CASH_COLUMNS.map((c) => ({
                key: c.key,
                sortKey: c.key,
                title: c.title,
                align: 'right',
                render: (r) => <span style={toNumber(r[c.key]) < 0 ? { color: '#b91c1c' } : undefined}>{money(r[c.key])}</span>,
              })),
            ]}
          />
          <Pagination {...pager} />
          <p className="gs-muted">{data?.note}</p>
        </>
      )}
    </div>
  )
}

// ── KDV ön izleme ──────────────────────────────────────────────
function VatTable({ rows }) {
  const list = Object.entries(rows || {}).map(([rate, r]) => ({ rate, base: r.base, vat: r.vat }))
  return (
    <DataTable
      rowKey="rate"
      rows={list}
      columns={[
        { key: 'rate', title: 'Oran', render: (r) => `%${r.rate}` },
        { key: 'base', title: 'Matrah', align: 'right', render: (r) => money(r.base) },
        { key: 'vat', title: 'KDV', align: 'right', render: (r) => money(r.vat) },
      ]}
    />
  )
}

export function VatPanel({ period }) {
  const { data, isLoading, error, refetch } = useVatReport(period)
  if (isLoading) return <Loading />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  return (
    <div className="gs-page">
      <StatGrid>
        <Stat label="Hesaplanan KDV (satış)" value={money(data.totalOutputVat)} />
        <Stat label="İndirilecek KDV (deftere işlenmiş)" value={money(data.totalInputVat)} />
        <Stat label="Ödenecek KDV" value={money(data.payableVat)} tone={toNumber(data.payableVat) > 0 ? 'warning' : 'success'} />
        <Stat label="Devreden KDV" value={money(data.carriedForwardVat)} />
        <Stat label="Defter onayı bekleyen KDV" value={money(data.inputVatAwaitingLedger)} hint="Kesinleşince indirime girer" tone="info" />
      </StatGrid>
      <div className="gs-grid-3">
        <Card title="Satışlar (Hesaplanan)"><VatTable rows={data.outputVatByRate} /></Card>
        <Card title="Alışlar (İndirilecek)"><VatTable rows={data.inputVatByRate} /></Card>
        <Card title="Defter Onayı Bekleyen Alışlar"><VatTable rows={data.inputVatPendingLedgerByRate} /></Card>
      </div>
      <Notice tone="info">{data.disclaimer}</Notice>
    </div>
  )
}

// ── Yevmiye fiş dökümü ─────────────────────────────────────────
export function JournalPanel({ period, user }) {
  const { data, isLoading, error, refetch } = useJournal(period, can.journal(user))
  if (!can.journal(user)) return <Notice tone="info">Yevmiye fiş dökümü Muhasebe ve Mali Müşavir içindir.</Notice>
  if (isLoading) return <Loading />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const flat = data.entries.flatMap((e) => e.lines.map((l) => ({
    'Fiş No': e.entryNo,
    Tarih: formatDate(e.date),
    Açıklama: e.description,
    'Hesap Kodu': l.accountCode,
    'Hesap Adı': l.accountName,
    Borç: toNumber(l.debit),
    Alacak: toNumber(l.credit),
  })))
  const fileName = `GastroSync_Yevmiye_${data.period}`

  return (
    <div className="gs-page">
      <div className="gs-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge tone={data.balanced ? 'success' : 'danger'}>{data.balanced ? 'Borç = Alacak (dengeli)' : 'Denge bozuk!'}</Badge>
          <span className="gs-muted">{data.entries.length} fiş · Borç {money(data.totalDebit)} · Alacak {money(data.totalCredit)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" disabled={!flat.length}
            onClick={() => exportToExcel(flat, fileName, 'Yevmiye') && notifySuccess('Yevmiye dökümü Excel olarak indirildi')}>
            <FiDownload /> Excel
          </Button>
          <Button variant="secondary" disabled={!flat.length}
            onClick={() => exportToCSV(flat, fileName) && notifySuccess('Yevmiye dökümü CSV olarak indirildi')}>
            <FiDownload /> CSV
          </Button>
        </div>
      </div>
      <Notice tone="warning">{data.disclaimer}</Notice>
      {data.entries.length === 0 ? <Notice tone="info">Bu dönemde fiş üretilecek kayıt yok.</Notice> : data.entries.map((e) => (
        <Card key={e.entryNo} title={`#${e.entryNo} · ${formatDate(e.date)} · ${e.description}`} padded={false}>
          <DataTable
            rowKey={(l) => `${e.entryNo}-${l.accountCode}-${l.accountName}-${l.debit}-${l.credit}`}
            rows={e.lines}
            columns={[
              { key: 'accountCode', title: 'Hesap', width: 90, render: (l) => <strong>{l.accountCode}</strong> },
              { key: 'accountName', title: 'Hesap Adı' },
              { key: 'debit', title: 'Borç', align: 'right', render: (l) => (toNumber(l.debit) ? money(l.debit) : '') },
              { key: 'credit', title: 'Alacak', align: 'right', render: (l) => (toNumber(l.credit) ? money(l.credit) : '') },
            ]}
          />
        </Card>
      ))}
    </div>
  )
}

// ── Dönem kapanışı ─────────────────────────────────────────────
export function PeriodsPanel({ user }) {
  const { data, isLoading, error, refetch } = usePeriods()
  const closeM = useClosePeriod()
  const reopenM = useReopenPeriod()
  const [reopenTarget, setReopenTarget] = useState(null)
  const [reason, setReason] = useState('')
  const manage = can.managePeriods(user)

  if (isLoading) return <Loading />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  return (
    <Card title="Muhasebe Dönemleri" extra={!manage && <Badge tone="neutral">Yalnızca Mali Müşavir kapatabilir</Badge>}>
      <Notice tone="info">
        Kapatılan dönemde gider eklenemez, düzeltilemez, onaylanamaz ve satış iptal edilemez. Kapanış için dönemdeki tüm
        kayıtların deftere işlenmiş veya reddedilmiş olması gerekir.
      </Notice>
      <div style={{ marginTop: 12 }}>
        <DataTable
          rowKey="period"
          rows={data || []}
          columns={[
            { key: 'period', title: 'Dönem', render: (p) => <strong>{p.period}</strong> },
            { key: 'status', title: 'Durum', render: (p) => <Badge tone={p.status === 'CLOSED' ? 'neutral' : 'success'}>{p.status === 'CLOSED' ? 'Kapalı' : 'Açık'}</Badge> },
            { key: 'openItems', title: 'Kesinleşmemiş kayıt', align: 'right', render: (p) => (p.openItems > 0 ? <Badge tone="warning">{p.openItems}</Badge> : '0') },
            { key: 'closedBy', title: 'Kapatan', render: (p) => (p.closedBy ? `${p.closedBy} · ${formatDateTime(p.closedAt)}` : '-') },
            { key: 'note', title: 'Not', render: (p) => <span className="gs-muted">{p.note || ''}</span> },
            {
              key: 'actions', title: '', align: 'right',
              render: (p) => manage && (
                p.status === 'CLOSED'
                  ? <Button size="sm" variant="secondary" onClick={() => { setReopenTarget(p.period); setReason('') }}><FiUnlock /> Yeniden Aç</Button>
                  : p.canClose && (
                    <Button size="sm" disabled={p.openItems > 0} loading={closeM.isPending}
                      title={p.openItems > 0 ? 'Önce tüm kayıtlar kesinleşmeli veya reddedilmeli' : ''}
                      onClick={() => closeM.mutate({ period: p.period, note: 'Dönem sonu kapanışı' })}>
                      <FiLock /> Dönemi Kapat
                    </Button>
                  )
              ),
            },
          ]}
        />
      </div>
      <Modal
        open={!!reopenTarget}
        onClose={() => setReopenTarget(null)}
        title={`${reopenTarget} dönemini yeniden aç`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setReopenTarget(null)}>Vazgeç</Button>
            <Button disabled={reason.trim().length < 10} loading={reopenM.isPending}
              onClick={() => reopenM.mutate({ period: reopenTarget, reason: reason.trim() }, { onSuccess: () => setReopenTarget(null) })}>
              Yeniden Aç
            </Button>
          </>
        )}
      >
        <Field label="Gerekçe" required hint="En az 10 karakter. Tüm finans ekibine bildirilir ve denetim izine yazılır.">
          <textarea className="gs-textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </Card>
  )
}
