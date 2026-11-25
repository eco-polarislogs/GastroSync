import React, { useEffect, useState } from 'react'
import { Modal, Field, Button, Notice } from '../../components/ui'
import { EXPENSE_SUBTYPES, EXPENSE_PAYMENT, todayIso, money, toNumber } from '../../utils/format'
import { useCreateExpense, useUpdateExpense } from '../../hooks/useExpenseQuery'

const EMPTY = {
  title: '', subType: 'ELECTRICITY', category: 'VARIABLE', amount: '', vatRate: 20,
  expenseDate: todayIso(), dueDate: todayIso(), invoiceNumber: '', counterparty: '', note: '',
  paymentStatus: 'UNPAID', paidAmount: '', paymentMethod: 'CASH',
}

/**
 * Gider kaydı / düzeltme formu.
 * - Dönem belge tarihinden otomatik belirlenir (elle seçilemez).
 * - Peşin ödeme seçeneği yalnızca yeni kayıtta ve kasa yetkilileri içindir.
 */
export default function ExpenseFormModal({ open, onClose, expense }) {
  const isEdit = !!expense
  const [form, setForm] = useState(EMPTY)
  const createM = useCreateExpense()
  const updateM = useUpdateExpense()

  useEffect(() => {
    if (!open) return
    setForm(expense
      ? {
        ...EMPTY,
        title: expense.title, subType: expense.subType, category: expense.category,
        amount: expense.amount, vatRate: expense.vatRate, expenseDate: expense.expenseDate,
        dueDate: expense.dueDate || expense.expenseDate, invoiceNumber: expense.invoiceNumber || '',
        counterparty: expense.counterparty || '', note: expense.note || '',
      }
      : EMPTY)
  }, [open, expense])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const onSubType = (code) => {
    const t = EXPENSE_SUBTYPES[code]
    setForm((f) => ({ ...f, subType: code, category: t?.category || f.category, vatRate: t?.vat ?? f.vatRate }))
  }

  const amount = toNumber(form.amount)
  const vat = toNumber(form.vatRate)
  const vatAmount = vat > 0 ? Math.round((amount * vat / (100 + vat)) * 100) / 100 : 0

  const submit = (e) => {
    e.preventDefault()
    const payload = {
      title: form.title.trim(), category: form.category, subType: form.subType,
      amount, vatRate: vat, expenseDate: form.expenseDate, dueDate: form.dueDate || form.expenseDate,
      invoiceNumber: form.invoiceNumber.trim(), counterparty: form.counterparty.trim(), note: form.note.trim(),
    }
    if (!isEdit) {
      payload.paymentStatus = form.paymentStatus
      payload.paymentMethod = form.paymentMethod
      if (form.paymentStatus === 'PARTIAL') payload.paidAmount = toNumber(form.paidAmount)
    }
    const m = isEdit ? updateM : createM
    m.mutate(isEdit ? { id: expense.id, ...payload } : payload, { onSuccess: () => onClose() })
  }

  const busy = createM.isPending || updateM.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? (expense.status === 'REJECTED' ? 'Reddedilen Gideri Düzelt ve Tekrar Onaya Sun' : 'Gideri Düzelt') : 'Yeni Gider / Fatura Kaydı'}
      width={680}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button type="submit" form="expense-form" loading={busy}>{isEdit ? 'Kaydet' : 'Kaydet ve Onaya Sun'}</Button>
        </>
      )}
    >
      <form id="expense-form" className="gs-form" onSubmit={submit}>
        {isEdit && expense.status === 'REJECTED' && expense.rejectionReason && (
          <Notice tone="danger"><strong>Ret gerekçesi:</strong> {expense.rejectionReason}</Notice>
        )}
        <Field label="Açıklama" required>
          <input className="gs-input" value={form.title} onChange={(e) => set('title', e.target.value)} minLength={3} maxLength={150} required />
        </Field>
        <div className="gs-form-row">
          <Field label="Gider türü" required>
            <select className="gs-select" value={form.subType} onChange={(e) => onSubType(e.target.value)}>
              {Object.entries(EXPENSE_SUBTYPES).map(([code, t]) => <option key={code} value={code}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Sınıf">
            <select className="gs-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="FIXED">Sabit gider</option>
              <option value="VARIABLE">Değişken gider</option>
            </select>
          </Field>
        </div>
        <div className="gs-form-row">
          <Field label="Tutar (KDV dahil, ₺)" required>
            <input className="gs-input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
          </Field>
          <Field label="KDV oranı" hint={vatAmount > 0 ? `İndirilecek KDV: ${money(vatAmount)}` : 'KDV yok'}>
            <select className="gs-select" value={form.vatRate} onChange={(e) => set('vatRate', e.target.value)} disabled={form.subType === 'TAX'}>
              {[0, 1, 10, 20].map((r) => <option key={r} value={r}>%{r}</option>)}
            </select>
          </Field>
        </div>
        <div className="gs-form-row">
          <Field label="Belge (fatura) tarihi" required hint={`Muhasebe dönemi: ${form.expenseDate?.slice(0, 7) || '-'}`}>
            <input className="gs-input" type="date" max={todayIso()} value={form.expenseDate} onChange={(e) => set('expenseDate', e.target.value)} required />
          </Field>
          <Field label="Son ödeme tarihi (vade)">
            <input className="gs-input" type="date" min={form.expenseDate} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </Field>
        </div>
        <div className="gs-form-row">
          <Field label="Fatura / fiş / dekont no" hint="Belgesiz kayıt Mali Müşavir tarafından deftere işlenemez">
            <input className="gs-input" value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} maxLength={60} />
          </Field>
          <Field label="Karşı taraf (tedarikçi / kurum)">
            <input className="gs-input" value={form.counterparty} onChange={(e) => set('counterparty', e.target.value)} maxLength={150} />
          </Field>
        </div>
        <Field label="Not">
          <textarea className="gs-textarea" value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={500} />
        </Field>

        {!isEdit && (
          <div className="gs-form-row">
            <Field label="Ödeme durumu" hint="Peşin ödeme kasadan çıkış olarak kaydedilir; kayıt yine de onaya düşer">
              <select className="gs-select" value={form.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}>
                <option value="UNPAID">Ödenmedi (borç / vade)</option>
                <option value="PAID">Peşin ödendi (tamamı)</option>
                <option value="PARTIAL">Kısmi ödendi</option>
              </select>
            </Field>
            {form.paymentStatus !== 'UNPAID' && (
              <Field label="Ödeme yöntemi">
                <select className="gs-select" value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
                  {Object.entries(EXPENSE_PAYMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            )}
            {form.paymentStatus === 'PARTIAL' && (
              <Field label="Ödenen tutar (₺)" required>
                <input className="gs-input" type="number" min="0.01" step="0.01" value={form.paidAmount} onChange={(e) => set('paidAmount', e.target.value)} required />
              </Field>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
