import React, { useEffect, useState } from 'react'
import { Modal, Field, Button, Notice, Badge, Loading } from '../../components/ui'
import {
  money, formatDate, formatDateTime, toNumber, EXPENSE_PAYMENT, EXPENSE_STATUS, PAYMENT_STATUS, expenseTypeLabel,
} from '../../utils/format'
import { usePayExpense, useRejectExpense, useExpenseHistory, useSubmitExpense, useFinalizeExpense } from '../../hooks/useExpenseQuery'

/** Muhasebe: faturalandır (belge bilgisi) ve Mali Müşavire gönder */
export function SubmitModal({ expense, onClose }) {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [note, setNote] = useState('')
  const submitM = useSubmitExpense()
  useEffect(() => {
    if (expense) { setInvoiceNumber(expense.invoiceNumber || ''); setCounterparty(expense.counterparty || ''); setNote('') }
  }, [expense])
  if (!expense) return null
  const valid = invoiceNumber.trim() && counterparty.trim()
  const unpaid = expense.remainingAmount > 0
  return (
    <Modal
      open
      onClose={onClose}
      title="Faturalandır ve Mali Müşavire Gönder"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button disabled={!valid} loading={submitM.isPending}
            onClick={() => submitM.mutate({ id: expense.id, invoiceNumber: invoiceNumber.trim(), counterparty: counterparty.trim(), note: note.trim() || undefined }, { onSuccess: onClose })}>
            Müşavire Gönder
          </Button>
        </>
      )}
    >
      <div className="gs-form">
        <dl className="gs-kv">
          <dt>Gider</dt><dd>{expense.title}</dd>
          <dt>Tutar</dt><dd>{money(expense.amount)} (KDV {money(expense.vatAmount)})</dd>
          <dt>Ödeme</dt><dd>{unpaid ? `Kalan borç ${money(expense.remainingAmount)} · vade ${formatDate(expense.dueDate)}` : 'Tamamı ödendi'}</dd>
        </dl>
        <div className="gs-form-row">
          <Field label="Fatura / fiş numarası" required>
            <input className="gs-input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} maxLength={100} placeholder="Örn: ABC2026000123" />
          </Field>
          <Field label="Karşı taraf (tedarikçi)" required>
            <input className="gs-input" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={200} />
          </Field>
        </div>
        <Field label="Müşavire not (isteğe bağlı)">
          <input className="gs-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Örn: Dekont ve e-fatura ekte" />
        </Field>
        {unpaid
          ? <Notice tone="warning">Gider henüz tamamen ödenmedi. Tahakkuk esasına göre vadeli fatura da gönderilebilir; ödeme durumu müşavire bildirilir.</Notice>
          : <Notice tone="info">Tutar değiştirilemez. Tutar farkı varsa kaydı reddedip düzeltin.</Notice>}
      </div>
    </Modal>
  )
}

/** Mali Müşavir: gönderilen belgeyi onaylayıp resmi deftere işler */
export function FinalizeModal({ expense, user, onClose }) {
  const [note, setNote] = useState('')
  const finalizeM = useFinalizeExpense()
  useEffect(() => { setNote('') }, [expense])
  if (!expense) return null
  return (
    <Modal
      open
      onClose={onClose}
      title="Belgeyi Onayla ve Deftere İşle"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button loading={finalizeM.isPending}
            onClick={() => finalizeM.mutate({ id: expense.id, note: note.trim() || undefined }, { onSuccess: onClose })}>
            Onayla ve Deftere İşle
          </Button>
        </>
      )}
    >
      <div className="gs-form">
        <dl className="gs-kv">
          <dt>Gider</dt><dd>{expense.title} · {money(expense.amount)}</dd>
          <dt>Belge</dt><dd>{expense.invoiceNumber || 'YOK'} · {expense.counterparty || 'Karşı taraf yok'}</dd>
          <dt>Gönderen</dt><dd>{expense.submittedBy || '-'} · {formatDateTime(expense.submittedAt)}</dd>
          <dt>Ödeme</dt><dd>{PAYMENT_STATUS[expense.paymentStatus]?.label || expense.paymentStatus} (kalan {money(expense.remainingAmount)})</dd>
        </dl>
        <Field label="Onay notu (isteğe bağlı)">
          <input className="gs-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Örn: e-Fatura kontrol edildi" />
        </Field>
        <Notice tone="warning">Deftere işlenen kayıt bir daha değiştirilemez ve silinemez.</Notice>
      </div>
    </Modal>
  )
}

export function PaymentModal({ expense, onClose }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [note, setNote] = useState('')
  const payM = usePayExpense()

  useEffect(() => {
    if (expense) { setAmount(String(expense.remainingAmount)); setMethod('CASH'); setNote('') }
  }, [expense])

  if (!expense) return null
  const value = toNumber(amount)
  const tooMuch = value - expense.remainingAmount > 0.005

  return (
    <Modal
      open
      onClose={onClose}
      title="Ödeme Kaydı"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button
            loading={payM.isPending}
            disabled={value <= 0 || tooMuch}
            onClick={() => payM.mutate({ id: expense.id, amount: value, method, note }, { onSuccess: onClose })}
          >
            {money(value)} Öde
          </Button>
        </>
      )}
    >
      <div className="gs-form">
        <dl className="gs-kv">
          <dt>Gider</dt><dd>{expense.title}</dd>
          <dt>Toplam</dt><dd>{money(expense.amount)}</dd>
          <dt>Ödenen</dt><dd>{money(expense.paidAmount)}</dd>
          <dt>Kalan borç</dt><dd>{money(expense.remainingAmount)}</dd>
        </dl>
        <div className="gs-form-row">
          <Field label="Ödenecek tutar (₺)" hint={tooMuch ? 'Kalan borcu aşamaz' : 'Kısmi ödeme yapılabilir'}>
            <input className="gs-input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Ödeme yöntemi">
            <select className="gs-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {Object.entries(EXPENSE_PAYMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Açıklama (dekont no vb.)">
          <input className="gs-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <Notice tone="info">Nakit ödemeler gün sonu kasa sayımında beklenen nakitten düşülür.</Notice>
      </div>
    </Modal>
  )
}

export function RejectModal({ expense, onClose }) {
  const [reason, setReason] = useState('')
  const rejectM = useRejectExpense()
  useEffect(() => { setReason('') }, [expense])
  if (!expense) return null
  const valid = reason.trim().length >= 10
  return (
    <Modal
      open
      onClose={onClose}
      title="Gerekçeli Ret"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button variant="danger" disabled={!valid} loading={rejectM.isPending}
            onClick={() => rejectM.mutate({ id: expense.id, reason: reason.trim() }, { onSuccess: onClose })}>
            Reddet
          </Button>
        </>
      )}
    >
      <div className="gs-form">
        <p className="gs-muted"><strong>{expense.title}</strong> · {money(expense.amount)}</p>
        <Field label="Ret gerekçesi" required hint="En az 10 karakter. Gerekçe denetim izine yazılır ve muhasebeye bildirilir.">
          <textarea className="gs-textarea" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Örn: Fatura aslı eksik, vergi numarası hatalı, stopaj oranı kontrol edilmeli" />
        </Field>
      </div>
    </Modal>
  )
}

const ACTION_LABELS = {
  EXPENSE_CREATED: 'Kaydedildi', EXPENSE_UPDATED: 'Düzeltildi', EXPENSE_RESUBMITTED: 'Düzeltilip tekrar onaya sunuldu',
  EXPENSE_APPROVED: 'Onaylandı', EXPENSE_PAID: 'Ödeme yapıldı', EXPENSE_SUBMITTED: 'Faturalandırılıp Mali Müşavire gönderildi',
  EXPENSE_FINALIZED: 'Mali Müşavir onayladı · deftere işlendi',
  EXPENSE_REJECTED: 'Reddedildi', EXPENSE_DELETED: 'Arşivlendi', PURCHASE_REQUESTED: 'Tedarik talebi açıldı',
}

export function ExpenseDetailModal({ expenseId, onClose }) {
  const { data, isLoading } = useExpenseHistory(expenseId)
  if (!expenseId) return null
  const e = data?.expense
  return (
    <Modal open onClose={onClose} title="Gider Detayı ve Denetim İzi" width={720}>
      {isLoading || !e ? <Loading /> : (
        <div className="gs-form">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone={EXPENSE_STATUS[e.status]?.tone}>{EXPENSE_STATUS[e.status]?.label || e.status}</Badge>
            <Badge tone={PAYMENT_STATUS[e.paymentStatus]?.tone}>{PAYMENT_STATUS[e.paymentStatus]?.label || e.paymentStatus}</Badge>
          </div>
          <dl className="gs-kv">
            <dt>Açıklama</dt><dd>{e.title}</dd>
            <dt>Tür</dt><dd>{expenseTypeLabel(e.subType)} ({e.category === 'FIXED' ? 'Sabit' : 'Değişken'})</dd>
            <dt>Tutar</dt><dd>{money(e.amount)} (KDV %{toNumber(e.vatRate)}: {money(e.vatAmount)} · Net {money(e.netAmount)})</dd>
            <dt>Ödenen / Kalan</dt><dd>{money(e.paidAmount)} / {money(e.remainingAmount)}</dd>
            <dt>Belge</dt><dd>{e.invoiceNumber || <span className="gs-muted">Belge numarası yok</span>} · {e.counterparty || '-'}</dd>
            <dt>Belge tarihi / vade</dt><dd>{formatDate(e.expenseDate)} / {formatDate(e.dueDate)} · Dönem {e.period}</dd>
            <dt>Kaydeden</dt><dd>{e.recordedBy} ({e.createdBy})</dd>
            {e.approvedBy && <><dt>Onaylayan</dt><dd>{e.approvedBy} · {formatDateTime(e.approvedAt)}</dd></>}
            {e.submittedBy && <><dt>Müşavire gönderen</dt><dd>{e.submittedBy} · {formatDateTime(e.submittedAt)}</dd></>}
            {e.finalizedBy && <><dt>Deftere işleyen</dt><dd>{e.finalizedBy} · {formatDateTime(e.finalizedAt)}{e.advisorNote ? ` · ${e.advisorNote}` : ''}</dd></>}
            {e.rejectionReason && <><dt>Ret gerekçesi</dt><dd>{e.rejectionReason} ({e.rejectedBy})</dd></>}
            {e.note && <><dt>Not</dt><dd>{e.note}</dd></>}
          </dl>

          {data.payments?.length > 0 && (
            <>
              <strong>Ödemeler</strong>
              <ul className="gs-timeline">
                {data.payments.map((p) => (
                  <li key={p.id}><strong>{money(p.amount)}</strong> · {EXPENSE_PAYMENT[p.method] || p.method} · {formatDate(p.paymentDate)} · {p.paidBy}{p.note ? ` · ${p.note}` : ''}</li>
                ))}
              </ul>
            </>
          )}

          <strong>Denetim izi</strong>
          <ul className="gs-timeline">
            {(data.auditTrail || []).map((a) => (
              <li key={a.id}>
                <strong>{ACTION_LABELS[a.action] || a.action}</strong> — {a.actor} ({a.actorRole}) · {formatDateTime(a.timestamp)}
                {a.detail && <div className="gs-muted">{a.detail}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
