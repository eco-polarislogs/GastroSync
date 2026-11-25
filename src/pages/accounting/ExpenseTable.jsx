import React from 'react'
import { FiCheck, FiX, FiEdit3, FiTrash2, FiDollarSign, FiBookOpen, FiInfo, FiSend } from 'react-icons/fi'
import { DataTable, Badge, Button, EmptyState } from '../../components/ui'
import { money, formatDate, EXPENSE_STATUS, PAYMENT_STATUS, expenseTypeLabel } from '../../utils/format'
import { can } from './permissions'

/**
 * Gider tablosu. Her satırdaki butonlar kullanıcının rolüne ve kaydın durumuna göre
 * yalnızca izin verilen işlemleri gösterir.
 */
export default function ExpenseTable({ expenses, user, onAction, emptyText, sort, onSortChange }) {
  const today = new Date().toISOString().slice(0, 10)
  const columns = [
    {
      key: 'title', sortKey: 'title', title: 'Gider',
      render: (e) => (
        <div>
          <div className="gs-cell-title">{e.title}</div>
          <div className="gs-cell-sub">
            {expenseTypeLabel(e.subType)} · {e.counterparty || 'Karşı taraf yok'} · {e.invoiceNumber || 'Belge no yok'}
          </div>
        </div>
      ),
    },
    {
      key: 'date', sortKey: 'expenseDate', title: 'Tarih / Vade',
      render: (e) => {
        const overdue = e.remainingAmount > 0 && e.dueDate && e.dueDate < today && e.status !== 'REJECTED'
        return (
          <div className="gs-num">
            {formatDate(e.expenseDate)}
            <div className="gs-cell-sub" style={overdue ? { color: '#b91c1c', fontWeight: 700 } : undefined}>
              Vade {formatDate(e.dueDate)}{overdue ? ' · gecikmiş' : ''}
            </div>
          </div>
        )
      },
    },
    {
      key: 'amount', sortKey: 'amount', title: 'Tutar', align: 'right',
      render: (e) => (
        <div className="gs-num">
          <strong>{money(e.amount)}</strong>
          {e.remainingAmount > 0 && e.status !== 'PENDING_APPROVAL' && <div className="gs-cell-sub">Kalan {money(e.remainingAmount)}</div>}
        </div>
      ),
    },
    {
      key: 'status', title: 'Durum',
      render: (e) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <Badge tone={EXPENSE_STATUS[e.status]?.tone}>{EXPENSE_STATUS[e.status]?.label || e.status}</Badge>
          {e.status === 'APPROVED' && (e.sentToAdvisor
            ? <Badge tone="info">Müşavir incelemesinde</Badge>
            : <Badge tone="warning">Müşavire gönderilmedi</Badge>)}
          <Badge tone={PAYMENT_STATUS[e.paymentStatus]?.tone}>{PAYMENT_STATUS[e.paymentStatus]?.label || e.paymentStatus}</Badge>
        </div>
      ),
    },
    {
      key: 'actions', title: '', align: 'right',
      render: (e) => (
        <div className="gs-actions" onClick={(ev) => ev.stopPropagation()}>
          {can.approve(user, e) && <Button size="sm" onClick={() => onAction('approve', e)}><FiCheck /> Onayla</Button>}
          {can.approveBlockedBySegregation(user, e) && (
            <Badge tone="neutral" title="Görevler ayrılığı: kendi kaydınızı başka bir yetkili onaylamalıdır">Başka yetkili onaylamalı</Badge>
          )}
          {can.pay(user, e) && <Button size="sm" variant="secondary" onClick={() => onAction('pay', e)}><FiDollarSign /> Öde</Button>}
          {can.submit(user, e) && <Button size="sm" onClick={() => onAction('submit', e)}><FiSend /> Faturalandır & Gönder</Button>}
          {can.finalize(user, e) && <Button size="sm" onClick={() => onAction('finalize', e)}><FiBookOpen /> Onayla & Deftere İşle</Button>}
          {can.edit(user, e) && <Button size="sm" variant="secondary" onClick={() => onAction('edit', e)}><FiEdit3 /> Düzelt</Button>}
          {can.reject(user, e) && <Button size="sm" variant="danger" onClick={() => onAction('reject', e)}><FiX /> Gerekçeli Reddet</Button>}
          {can.remove(user, e) && <Button size="sm" variant="ghost" onClick={() => onAction('delete', e)} title="Arşivle"><FiTrash2 /></Button>}
          <Button size="sm" variant="ghost" onClick={() => onAction('detail', e)} title="Detay ve denetim izi"><FiInfo /></Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={expenses}
      onRowClick={(e) => onAction('detail', e)}
      sort={sort}
      onSortChange={onSortChange}
      empty={<EmptyState title={emptyText || 'Bu listede kayıt yok'} />}
    />
  )
}
