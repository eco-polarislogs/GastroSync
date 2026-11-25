import React, { useState } from 'react'
import { FiCheck, FiX, FiCornerUpLeft } from 'react-icons/fi'
import { Badge, Button, DataTable, EmptyState, ErrorState, Field, Loading, Modal, Notice, Pagination, serverPager } from './ui'
import { money, formatDateTime } from '../utils/format'
import {
  APPROVAL_STATUS, APPROVAL_TYPE, useApprovalLiveUpdates, useApprovals, useDecideApproval, useWithdrawApproval,
} from '../hooks/useApprovalQuery'

/**
 * Roller arası onay talepleri listesi.
 *  scope="inbox": karar verebildiğim talepler (İşletme Müdürü) — Onayla / Reddet
 *  scope="mine":  kendi taleplerim (Kasiyer, Depo Sorumlusu) — durum takibi ve geri çekme
 *  scope="all":   tüm geçmiş (denetim)
 */
export default function ApprovalsPanel({ scope = 'inbox', defaultStatus = 'PENDING', compact = false }) {
  const [status, setStatus] = useState(defaultStatus)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(compact ? 10 : 20)
  const [rejecting, setRejecting] = useState(null)
  useApprovalLiveUpdates()
  const { data, isLoading, error, refetch } = useApprovals({ scope, status, page, size })
  const decideM = useDecideApproval()
  const withdrawM = useWithdrawApproval()

  const rows = data?.content || []
  const filters = [
    { id: 'PENDING', label: 'Bekleyen' },
    { id: 'APPROVED', label: 'Onaylanan' },
    { id: 'REJECTED', label: 'Reddedilen' },
    { id: 'ALL', label: 'Tümü' },
  ]

  return (
    <div>
      <div className="gs-filterbar" role="group" aria-label="Talep durumu">
        {filters.map((f) => (
          <Button key={f.id} size="sm" variant={status === f.id ? 'primary' : 'secondary'}
            onClick={() => { setStatus(f.id); setPage(0) }}>
            {f.label}
          </Button>
        ))}
        {scope === 'inbox' && status === 'PENDING' && data && (
          <span className="gs-muted">{data.totalElements} talep kararınızı bekliyor</span>
        )}
      </div>
      {isLoading ? <Loading /> : error ? <ErrorState message={error.message} onRetry={refetch} /> : (
        <>
          <DataTable
            rows={rows}
            empty={<EmptyState title={status === 'PENDING' ? 'Bekleyen talep yok' : 'Talep yok'}
              description={scope === 'inbox' ? 'Kasiyer ve Depo Sorumlusunun onay talepleri burada görünür.' : 'Müdür onayına gönderdiğiniz talepler burada görünür.'} />}
            columns={[
              {
                key: 'type', title: 'Talep',
                render: (a) => (
                  <div>
                    <Badge tone={APPROVAL_TYPE[a.type]?.tone}>{a.typeLabel || APPROVAL_TYPE[a.type]?.label || a.type}</Badge>
                    <div className="gs-cell-title" style={{ marginTop: 4 }}>{a.summary}</div>
                    <div className="gs-cell-sub">Gerekçe: {a.reason}</div>
                  </div>
                ),
              },
              {
                key: 'requestedBy', title: 'Talep eden',
                render: (a) => (
                  <div>
                    <div>{a.requestedByName}</div>
                    <div className="gs-cell-sub">{a.requestedRoleLabel} · {formatDateTime(a.requestedAt)}</div>
                  </div>
                ),
              },
              {
                key: 'amount', title: 'Tutar', align: 'right',
                render: (a) => (a.amount != null ? (
                  <div>
                    <strong>{money(a.amount)}</strong>
                    {a.percent != null && a.type === 'DISCOUNT' && <div className="gs-cell-sub">%{Number(a.percent)}</div>}
                    {a.type === 'STOCK_ADJUST' && a.percent != null && <div className="gs-cell-sub">fark %{Number(a.percent)}</div>}
                  </div>
                ) : '-'),
              },
              {
                key: 'status', title: 'Durum',
                render: (a) => (
                  <div>
                    <Badge tone={APPROVAL_STATUS[a.status]?.tone}>{a.statusLabel || APPROVAL_STATUS[a.status]?.label}</Badge>
                    {a.decidedByName && <div className="gs-cell-sub">{a.decidedByName} · {formatDateTime(a.decidedAt)}</div>}
                    {a.decisionNote && <div className="gs-cell-sub">Not: {a.decisionNote}</div>}
                  </div>
                ),
              },
              {
                key: 'act', title: '', align: 'right',
                render: (a) => (
                  <div className="gs-actions">
                    {a.canDecide && (
                      <>
                        <Button size="sm" loading={decideM.isPending && decideM.variables?.id === a.id}
                          onClick={() => decideM.mutate({ id: a.id, decision: 'APPROVE' })}>
                          <FiCheck /> Onayla
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRejecting(a)}><FiX /> Reddet</Button>
                      </>
                    )}
                    {a.canWithdraw && (
                      <Button size="sm" variant="ghost" loading={withdrawM.isPending} onClick={() => withdrawM.mutate(a.id)}>
                        <FiCornerUpLeft /> Geri çek
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination {...serverPager(data, setPage, setSize)} />
        </>
      )}
      <RejectModal target={rejecting} onClose={() => setRejecting(null)}
        onSubmit={(note) => decideM.mutate({ id: rejecting.id, decision: 'REJECT', note }, { onSuccess: () => setRejecting(null) })}
        loading={decideM.isPending} />
    </div>
  )
}

export function RejectModal({ target, onClose, onSubmit, loading }) {
  const [note, setNote] = useState('')
  if (!target) return null
  return (
    <Modal open onClose={onClose} title={`Reddet: ${target.typeLabel}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button variant="danger" disabled={note.trim().length < 5} loading={loading} onClick={() => { onSubmit(note.trim()); setNote('') }}>Reddet</Button>
        </>
      )}>
      <div className="gs-form">
        <Notice tone="info">{target.summary}<br />Talep eden: {target.requestedByName} · Gerekçe: {target.reason}</Notice>
        <Field label="Ret gerekçesi" required hint="Talep sahibine bildirimle iletilir">
          <input className="gs-input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)}
            placeholder={target.type === 'STOCK_ADJUST' ? 'Ör. rafta 2 koli daha var, yeniden sayın' : 'Ör. iptal yerine porsiyon değişimi yapın'} />
        </Field>
      </div>
    </Modal>
  )
}
