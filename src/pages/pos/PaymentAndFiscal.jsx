import React, { useState } from 'react'
import { FiPrinter, FiFileText, FiDownload, FiRotateCcw, FiTrash2, FiEdit3, FiPlus, FiRefreshCw } from 'react-icons/fi'
import { Card, Button, Modal, Field, Notice, Badge, DataTable, EmptyState, Loading } from '../../components/ui'
import { money, formatDateTime, SALES_PAYMENT, toNumber, todayIso } from '../../utils/format'
import {
  useAddPayment, useVoidPayment, usePrintCheck, usePrinters, usePrintJobs, useSavePrinter, useDeletePrinter, useTestPrinter,
  useRetryPrint, useFiscalStatus, useCheckFiscal, useFiscalSummary, useIssueEArsiv, useRecordOkc, useCancelFiscal,
} from '../../hooks/usePosQuery'
import { fiscalApi } from '../../api'

const METHOD_LABEL = { ...SALES_PAYMENT, MIXED: 'Karışık (parçalı)' }
const round2 = (n) => Math.round(n * 100) / 100

/**
 * Tahsilat: tamamı, tutar, kişi başı eşit bölme veya kalem seçerek parçalı ödeme.
 * Nakit + kart karışık alınabilir; kalan sıfırlanınca adisyon kapanır, satış kaydı ve stok düşümü yapılır.
 */
export function PayModal({ open, check, onClose, onReceipt }) {
  const [mode, setMode] = useState('full')
  const [method, setMethod] = useState('CASH')
  const [amount, setAmount] = useState('')
  const [people, setPeople] = useState(2)
  const [received, setReceived] = useState('')
  const [selected, setSelected] = useState([])
  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const payM = useAddPayment()
  const voidM = useVoidPayment()
  if (!open || !check) return null

  const total = toNumber(check.total)
  const paid = toNumber(check.paidAmount)
  const remaining = check.remainingAmount != null ? toNumber(check.remainingAmount) : total
  const payments = (check.payments || []).filter((p) => !p.voided)
  const paidIds = new Set(check.paidItemIds || [])
  const payable = (check.items || []).filter((i) => i.status !== 'CANCELLED' && !i.comp && !paidIds.has(i.id))
  const itemsSum = payable.filter((i) => selected.includes(i.id)).reduce((s, i) => s + toNumber(i.lineTotal), 0)

  let due = remaining
  if (mode === 'amount') due = amount === '' ? 0 : toNumber(amount)
  if (mode === 'equal') due = Math.min(remaining, round2(total / Math.max(1, Number(people) || 1)))
  if (mode === 'items') due = itemsSum
  const overpay = due - remaining > 0.009
  const change = method === 'CASH' && received !== '' ? round2(toNumber(received) - due) : null
  const invalid = due <= 0 || overpay || (change !== null && change < 0) || (mode === 'items' && !selected.length)

  const submit = () => {
    const body = { checkId: check.id, paymentMethod: method }
    if (mode === 'amount' || mode === 'equal') body.amount = round2(due)
    if (mode === 'items') body.itemIds = selected
    if (mode === 'equal') body.label = `Kişi başı (${people} kişi)`
    if (method === 'CASH' && received !== '') body.receivedAmount = toNumber(received)
    payM.mutate(body, {
      onSuccess: (r) => {
        setAmount(''); setReceived(''); setSelected([])
        if (r?.closed) onReceipt(r)
        else setMode('full')
      },
    })
  }

  const modes = [
    { id: 'full', label: 'Kalanın tamamı' },
    { id: 'amount', label: 'Tutar gir' },
    { id: 'equal', label: 'Kişi başı böl' },
    { id: 'items', label: 'Kalem seç' },
  ]

  return (
    <Modal open onClose={onClose} title={`Tahsilat · Masa ${check.tableNumber}`} width={640}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Kapat</Button>
          <Button loading={payM.isPending} disabled={invalid} onClick={submit}>
            {`${METHOD_LABEL[method]} · ${money(due)}`}
          </Button>
        </>
      )}>
      <dl className="gs-kv">
        <dt>Hesap toplamı</dt><dd>{money(total)}</dd>
        {paid > 0 && (<><dt>Alınan</dt><dd>{money(paid)}</dd></>)}
        <dt>Kalan</dt><dd><strong style={{ fontSize: '1.15rem' }}>{money(remaining)}</strong></dd>
      </dl>

      {payments.length > 0 && (
        <div style={{ margin: '8px 0 12px' }}>
          {payments.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>
              <Badge tone="success">{METHOD_LABEL[p.method] || p.method}</Badge>
              <span style={{ flex: 1, minWidth: 0 }} className="gs-cell-sub">{p.label || ''} {p.paidBy} · {formatDateTime(p.paidAt)}</span>
              <strong>{money(p.amount)}</strong>
              <Button size="sm" variant="ghost" title="Tahsilatı geri al" onClick={() => { setVoidTarget(p); setVoidReason('') }}><FiRotateCcw /></Button>
            </div>
          ))}
        </div>
      )}

      {voidTarget && (
        <Notice tone="warning">
          <div className="gs-form">
            <strong>{`${money(voidTarget.amount)} ${METHOD_LABEL[voidTarget.method] || ''} tahsilatı geri alınsın mı?`}</strong>
            <input className="gs-input" maxLength={300} placeholder="Gerekçe (zorunlu) — ör. yanlış kart çekildi" value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)} />
            <div className="gs-actions" style={{ justifyContent: 'flex-start' }}>
              <Button size="sm" variant="danger" disabled={voidReason.trim().length < 3} loading={voidM.isPending}
                onClick={() => voidM.mutate({ paymentId: voidTarget.id, reason: voidReason.trim() }, { onSuccess: () => setVoidTarget(null) })}>
                Geri al
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setVoidTarget(null)}>Vazgeç</Button>
            </div>
          </div>
        </Notice>
      )}

      <div className="gs-form">
        <Field label="Ne kadar alınacak?">
          <div className="gs-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            {modes.map((m) => (
              <Button key={m.id} size="sm" variant={mode === m.id ? 'primary' : 'secondary'} onClick={() => setMode(m.id)}>{m.label}</Button>
            ))}
          </div>
        </Field>
        {mode === 'amount' && (
          <Field label="Tutar (₺)" hint={`En fazla ${money(remaining)}`}>
            <input className="gs-input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
        )}
        {mode === 'equal' && (
          <Field label="Kaç kişiye bölünecek?" hint={`Kişi başı ${money(due)} · her kişi için ayrı tahsilat alın`}>
            <input className="gs-input" type="number" min="2" max="30" value={people} onChange={(e) => setPeople(e.target.value)} />
          </Field>
        )}
        {mode === 'items' && (
          <Field label="Ödenecek kalemler" hint="İndirim varsa tutar oransal düşülür; kesin tutarı sunucu hesaplar">
            {payable.length === 0 ? <span className="gs-muted">Ödenmemiş kalem yok</span> : (
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {payable.map((i) => (
                  <label key={i.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                    <input type="checkbox" checked={selected.includes(i.id)}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id)))} />
                    <span style={{ flex: 1, minWidth: 0 }}>{i.productName} × {i.quantity}</span>
                    <span>{money(i.lineTotal)}</span>
                  </label>
                ))}
              </div>
            )}
          </Field>
        )}
        <Field label="Ödeme türü">
          <div className="gs-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            {Object.entries(SALES_PAYMENT).map(([k, v]) => (
              <Button key={k} size="sm" variant={method === k ? 'primary' : 'secondary'} onClick={() => setMethod(k)}>{v}</Button>
            ))}
          </div>
        </Field>
        {method === 'CASH' && (
          <Field label="Müşteriden alınan nakit (₺)" hint="Boş bırakılırsa tam tutar alınmış sayılır">
            <input className="gs-input" type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} />
          </Field>
        )}
        {overpay && <Notice tone="danger">{`Tutar kalan hesaptan (${money(remaining)}) fazla olamaz.`}</Notice>}
        {change !== null && !overpay && (
          <Notice tone={change < 0 ? 'danger' : 'success'}>{change < 0 ? `Eksik: ${money(-change)}` : `Para üstü: ${money(change)}`}</Notice>
        )}
      </div>
    </Modal>
  )
}

/** Adisyon kapandıktan sonra gösterilir (adisyon paneli kapansa da açık kalır) */
export function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null
  return (
    <Modal open onClose={onClose} title={`Tahsilat tamamlandı · ${receipt.checkNo}`} width={640}
      footer={<Button onClick={onClose}>Tamam</Button>}>
      <ReceiptSummary receipt={receipt} />
      <FiscalActions checkId={receipt.checkId} />
    </Modal>
  )
}

function ReceiptSummary({ receipt }) {
  const payments = (receipt.payments || []).filter((p) => !p.voided)
  return (
    <>
      <dl className="gs-kv">
        <dt>Ödeme</dt><dd>{METHOD_LABEL[receipt.paymentMethod] || receipt.paymentMethod}</dd>
        {payments.length > 1 && payments.map((p) => (
          <React.Fragment key={p.id}><dt className="gs-muted">· {METHOD_LABEL[p.method] || p.method}</dt><dd>{money(p.amount)}</dd></React.Fragment>
        ))}
        {toNumber(receipt.compAmount) > 0 && (<><dt>İkram</dt><dd>{money(receipt.compAmount)} (ücretsiz)</dd></>)}
        {toNumber(receipt.discountAmount) > 0 && (<><dt>Ara toplam</dt><dd>{money(receipt.subtotal)}</dd><dt>İndirim</dt><dd>−{money(receipt.discountAmount)}</dd></>)}
        <dt>Toplam</dt><dd>{money(receipt.total)}</dd>
        <dt>KDV</dt><dd>{money(receipt.vatAmount)}</dd>
        {receipt.change != null && toNumber(receipt.change) > 0 && (<><dt>Para üstü</dt><dd><strong>{money(receipt.change)}</strong></dd></>)}
      </dl>
      <Notice tone="info">Satış kaydı oluşturuldu, reçete malzemeleri stoktan düşüldü ve KDV ayrıldı.</Notice>
    </>
  )
}

const FISCAL_TYPE = { E_ARSIV: 'e-Arşiv Fatura', E_ADISYON: 'e-Adisyon', OKC: 'ÖKC Fişi' }
const FISCAL_STATUS = {
  DRAFT: { label: 'Taslak (XML hazır)', tone: 'warning' },
  SENT: { label: 'Gönderildi', tone: 'info' },
  ACCEPTED: { label: 'Kabul edildi', tone: 'success' },
  RECORDED: { label: 'Kaydedildi', tone: 'success' },
  ERROR: { label: 'Hata', tone: 'danger' },
  CANCELLED: { label: 'İptal', tone: 'neutral' },
}

/** Ödenmiş adisyon için mali belge: ÖKC fiş numarası bağlama, e-Arşiv fatura, bilgi fişi yazdırma */
export function FiscalActions({ checkId }) {
  const status = useFiscalStatus()
  const docs = useCheckFiscal(checkId)
  const earsivM = useIssueEArsiv()
  const okcM = useRecordOkc()
  const printM = usePrintCheck()
  const [tab, setTab] = useState('okc')
  const [okc, setOkc] = useState({ receiptNo: '', zNo: '' })
  const [buyer, setBuyer] = useState({ buyerName: '', buyerTaxId: '', buyerTaxOffice: '', buyerEmail: '' })
  const list = docs.data || []
  const live = list.filter((d) => d.status !== 'CANCELLED' && d.status !== 'ERROR')
  const hasEarsiv = live.some((d) => d.type === 'E_ARSIV')
  const taxLen = buyer.buyerTaxId.replace(/\s/g, '').length
  const buyerInvalid = (taxLen > 0 && taxLen !== 10 && taxLen !== 11) || (taxLen === 10 && !buyer.buyerTaxOffice.trim())

  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ margin: '0 0 8px' }}>Mali belge</h4>
      {live.length === 0 && (
        <Notice tone="warning">
          Bu adisyonun henüz mali belgesi yok. Yazar kasada (ÖKC) fiş kestiyseniz numarasını bağlayın ya da e-Arşiv fatura düzenleyin.
        </Notice>
      )}
      {list.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {list.map((d) => (
            <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', flexWrap: 'wrap' }}>
              <Badge tone={FISCAL_STATUS[d.status]?.tone}>{FISCAL_TYPE[d.type] || d.type}</Badge>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{d.documentNo}{d.okcZNo ? ` · Z ${d.okcZNo}` : ''}</span>
              <span className="gs-cell-sub">{FISCAL_STATUS[d.status]?.label || d.status}</span>
              {d.type === 'E_ARSIV' && (
                <Button size="sm" variant="ghost" title="UBL-TR XML indir" onClick={() => fiscalApi.downloadXml(d.id, d.documentNo)}><FiDownload /></Button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="gs-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }}>
        <Button size="sm" variant={tab === 'okc' ? 'primary' : 'secondary'} onClick={() => setTab('okc')}>ÖKC fiş no</Button>
        {!hasEarsiv && <Button size="sm" variant={tab === 'earsiv' ? 'primary' : 'secondary'} onClick={() => setTab('earsiv')}><FiFileText /> e-Arşiv fatura</Button>}
        <Button size="sm" variant="ghost" loading={printM.isPending} onClick={() => printM.mutate({ checkId, type: 'RECEIPT' })}><FiPrinter /> Bilgi fişi yazdır</Button>
      </div>
      {tab === 'okc' && (
        <div className="gs-form-row">
          <Field label="ÖKC fiş no" required><input className="gs-input" maxLength={20} value={okc.receiptNo} onChange={(e) => setOkc({ ...okc, receiptNo: e.target.value })} /></Field>
          <Field label="Z no"><input className="gs-input" maxLength={10} value={okc.zNo} onChange={(e) => setOkc({ ...okc, zNo: e.target.value })} /></Field>
          <div style={{ alignSelf: 'end' }}>
            <Button size="sm" disabled={!okc.receiptNo.trim()} loading={okcM.isPending}
              onClick={() => okcM.mutate({ checkId, receiptNo: okc.receiptNo.trim(), zNo: okc.zNo.trim() || undefined }, { onSuccess: () => setOkc({ receiptNo: '', zNo: '' }) })}>
              Bağla
            </Button>
          </div>
        </div>
      )}
      {tab === 'earsiv' && !hasEarsiv && (
        <div className="gs-form">
          <Notice tone="info">Alıcı bilgisi boş bırakılırsa "Nihai Tüketici" adına düzenlenir. {status.data?.message}</Notice>
          <div className="gs-form-row">
            <Field label="Alıcı adı / unvan"><input className="gs-input" maxLength={150} value={buyer.buyerName} onChange={(e) => setBuyer({ ...buyer, buyerName: e.target.value })} /></Field>
            <Field label="VKN / TCKN" hint="VKN 10, TCKN 11 hane"><input className="gs-input" inputMode="numeric" maxLength={11} value={buyer.buyerTaxId} onChange={(e) => setBuyer({ ...buyer, buyerTaxId: e.target.value.replace(/\D/g, '') })} /></Field>
          </div>
          <div className="gs-form-row">
            <Field label="Vergi dairesi" required={taxLen === 10}><input className="gs-input" maxLength={80} value={buyer.buyerTaxOffice} onChange={(e) => setBuyer({ ...buyer, buyerTaxOffice: e.target.value })} /></Field>
            <Field label="E-posta"><input className="gs-input" type="email" maxLength={120} value={buyer.buyerEmail} onChange={(e) => setBuyer({ ...buyer, buyerEmail: e.target.value })} /></Field>
          </div>
          <div><Button size="sm" disabled={buyerInvalid} loading={earsivM.isPending}
            onClick={() => earsivM.mutate({ checkId, ...Object.fromEntries(Object.entries(buyer).map(([k, v]) => [k, v.trim() || undefined])) })}>
            <FiFileText /> e-Arşiv düzenle
          </Button></div>
        </div>
      )}
    </div>
  )
}

/** Kapanan adisyonun mali belgesini sonradan düzenlemek için */
export function FiscalModal({ check, onClose }) {
  if (!check) return null
  return (
    <Modal open onClose={onClose} title={`Mali belge · ${check.checkNo}`} width={640} footer={<Button onClick={onClose}>Kapat</Button>}>
      <dl className="gs-kv">
        <dt>Masa</dt><dd>Masa {check.tableNumber}</dd>
        <dt>Toplam</dt><dd>{money(check.total)}</dd>
        <dt>Ödeme</dt><dd>{METHOD_LABEL[check.paymentMethod] || check.paymentMethod}</dd>
      </dl>
      <FiscalActions checkId={check.id} />
    </Modal>
  )
}

/** Gün sonu mali belge mutabakatı: belgesiz kalan ödenmiş adisyonlar */
export function FiscalSummaryPanel({ onOpen }) {
  const [date, setDate] = useState(todayIso())
  const { data, isLoading } = useFiscalSummary(date)
  return (
    <Card title="Mali Belge Mutabakatı" extra={<input className="gs-input" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 170 }} />}>
      {isLoading ? <Loading /> : (
        <>
          <dl className="gs-kv">
            <dt>Ödenen adisyon</dt><dd>{data?.paidChecks ?? 0}</dd>
            <dt>Belgesi olan</dt><dd>{data?.documentedChecks ?? 0}</dd>
            <dt>Belgesiz</dt><dd><strong>{data?.missingCount ?? 0}</strong> · {money(data?.missingTotal)}</dd>
          </dl>
          {(data?.missingCount ?? 0) > 0
            ? <Notice tone="warning">Belgesiz adisyonlar için ÖKC fiş numarasını bağlayın veya e-Arşiv düzenleyin. Mali belgesiz satış vergi cezasına konu olur.</Notice>
            : <Notice tone="success">Tüm ödenmiş adisyonların mali belgesi var.</Notice>}
          <DataTable
            rows={data?.missing || []}
            rowKey="checkId"
            empty={<EmptyState title="Belgesiz adisyon yok" />}
            columns={[
              { key: 'checkNo', title: 'Adisyon' },
              { key: 'tableNumber', title: 'Masa', render: (c) => `Masa ${c.tableNumber}` },
              { key: 'closedAt', title: 'Kapanış', render: (c) => formatDateTime(c.closedAt) },
              { key: 'total', title: 'Tutar', align: 'right', render: (c) => money(c.total) },
              ...(onOpen ? [{ key: 'act', title: '', align: 'right', render: (c) => <Button size="sm" variant="secondary" onClick={() => onOpen({ ...c, id: c.checkId })}>Belge</Button> }] : []),
            ]}
          />
        </>
      )}
    </Card>
  )
}

const STATION = { KITCHEN: 'Mutfak', BAR: 'Bar', RECEIPT: 'Kasa (adisyon / fiş)' }
const JOB_STATUS = { PENDING: { label: 'Bekliyor', tone: 'warning' }, PRINTED: { label: 'Basıldı', tone: 'success' }, FAILED: { label: 'Hata', tone: 'danger' } }

/** Yazıcı tanımları ve son yazdırma işleri (Müdür / Yönetici / Kasiyer) */
export function PrintersPanel({ canManage }) {
  const printers = usePrinters()
  const jobs = usePrintJobs()
  const saveM = useSavePrinter()
  const delM = useDeletePrinter()
  const testM = useTestPrinter()
  const retryM = useRetryPrint()
  const empty = { name: '', station: 'KITCHEN', host: '', port: 9100, connection: 'DIRECT', charsPerLine: 48, active: true }
  const [form, setForm] = useState(null)
  return (
    <div className="gs-grid-2">
      <Card title="Yazıcılar" extra={canManage && <Button size="sm" onClick={() => setForm(empty)}><FiPlus /> Yazıcı Ekle</Button>}>
        <Notice tone="info">
          {'Ağ (Ethernet / Wi-Fi) ESC/POS fiş yazıcıları desteklenir. Sunucu buluttaysa yazıcıya restorandaki bir cihazda çalışan yazıcı köprüsü ile ulaşılır (bağlantı türü: Köprü). Sipariş girilince mutfak / bar fişi otomatik basılır.'}
        </Notice>
        {printers.isLoading ? <Loading /> : (
          <DataTable
            rows={printers.data || []}
            empty={<EmptyState title="Yazıcı tanımlı değil" description={canManage ? 'Mutfak, bar ve kasa yazıcılarını ekleyin.' : ''} />}
            columns={[
              { key: 'name', title: 'Yazıcı', render: (p) => <div><div className="gs-cell-title">{p.name}</div><div className="gs-cell-sub">{STATION[p.station]} · {p.host}:{p.port}</div></div> },
              { key: 'connection', title: 'Bağlantı', render: (p) => (p.connection === 'BRIDGE' ? 'Köprü' : 'Doğrudan') },
              { key: 'active', title: 'Durum', render: (p) => <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'Açık' : 'Kapalı'}</Badge> },
              ...(canManage ? [{
                key: 'act', title: '', align: 'right',
                render: (p) => (
                  <div className="gs-actions">
                    <Button size="sm" variant="ghost" title="Test baskısı" loading={testM.isPending && testM.variables === p.id} onClick={() => testM.mutate(p.id)}><FiPrinter /></Button>
                    <Button size="sm" variant="ghost" title="Düzenle" onClick={() => setForm({ ...p })}><FiEdit3 /></Button>
                    <Button size="sm" variant="ghost" title="Sil" onClick={() => window.confirm(`${p.name} silinsin mi?`) && delM.mutate(p.id)}><FiTrash2 /></Button>
                  </div>
                ),
              }] : []),
            ]}
          />
        )}
      </Card>
      <Card title="Son Yazdırma İşleri">
        {jobs.isLoading ? <Loading /> : (
          <DataTable
            rows={jobs.data || []}
            empty={<EmptyState title="Yazdırma işi yok" />}
            columns={[
              { key: 'title', title: 'İş', render: (j) => <div><div className="gs-cell-title">{j.title}</div><div className="gs-cell-sub">{j.printerName} · {formatDateTime(j.createdAt)}</div>{j.error && <div className="gs-cell-sub" style={{ color: 'var(--color-danger)' }}>{j.error}</div>}</div> },
              { key: 'status', title: 'Durum', render: (j) => <Badge tone={JOB_STATUS[j.status]?.tone}>{JOB_STATUS[j.status]?.label || j.status}</Badge> },
              {
                key: 'act', title: '', align: 'right',
                render: (j) => j.status === 'FAILED' && <Button size="sm" variant="ghost" title="Yeniden dene" loading={retryM.isPending && retryM.variables === j.id} onClick={() => retryM.mutate(j.id)}><FiRefreshCw /></Button>,
              },
            ]}
          />
        )}
      </Card>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Yazıcıyı düzenle' : 'Yazıcı ekle'}
        footer={<Button loading={saveM.isPending} disabled={!form?.name?.trim() || !form?.host?.trim()} onClick={() => saveM.mutate(form, { onSuccess: () => setForm(null) })}>Kaydet</Button>}>
        {form && (
          <div className="gs-form">
            <Field label="Ad" required><input className="gs-input" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mutfak yazıcısı" /></Field>
            <div className="gs-form-row">
              <Field label="İstasyon">
                <select className="gs-select" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })}>
                  {Object.entries(STATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Bağlantı">
                <select className="gs-select" value={form.connection} onChange={(e) => setForm({ ...form, connection: e.target.value })}>
                  <option value="DIRECT">Doğrudan (sunucu aynı ağda)</option>
                  <option value="BRIDGE">Köprü (sunucu bulutta)</option>
                </select>
              </Field>
            </div>
            <div className="gs-form-row">
              <Field label="IP adresi" required><input className="gs-input" maxLength={120} value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.50" /></Field>
              <Field label="Port"><input className="gs-input" type="number" min="1" max="65535" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} /></Field>
            </div>
            <div className="gs-form-row">
              <Field label="Kâğıt genişliği">
                <select className="gs-select" value={form.charsPerLine} onChange={(e) => setForm({ ...form, charsPerLine: Number(e.target.value) })}>
                  <option value={32}>58 mm (32 karakter)</option>
                  <option value={42}>80 mm (42 karakter)</option>
                  <option value={48}>80 mm (48 karakter)</option>
                </select>
              </Field>
              <Field label="Durum">
                <select className="gs-select" value={form.active ? '1' : '0'} onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}>
                  <option value="1">Açık</option>
                  <option value="0">Kapalı</option>
                </select>
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
