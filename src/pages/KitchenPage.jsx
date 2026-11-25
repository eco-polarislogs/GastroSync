import React, { useState } from 'react'
import { FiPlay, FiCheck } from 'react-icons/fi'
import { useAuthStore, hasPermission } from '../store'
import { Card, Button, Loading, ErrorState, Notice, Badge, EmptyState } from '../components/ui'
import { usePosLiveUpdates, useKitchenBoard, useItemStatus } from '../hooks/usePosQuery'

const COLUMNS = [
  { status: 'ORDERED', title: 'Yeni Sipariş', next: 'PREPARING', action: 'Hazırlamaya Başla', icon: FiPlay },
  { status: 'PREPARING', title: 'Hazırlanıyor', next: 'READY', action: 'Hazır', icon: FiCheck },
  { status: 'READY', title: 'Servis Bekliyor', next: null },
]

const LATE_MINUTES = 15

/**
 * Mutfak ekranı. Kasiyerin girdiği siparişler buraya düşer; Şef hazırlama durumunu günceller,
 * hazır olan kalem kasada "servis bekliyor" olarak görünür. Müdür yalnızca izler.
 */
export default function KitchenPage() {
  const user = useAuthStore((s) => s.user)
  const canOperate = hasPermission(user, 'KITCHEN_OPERATE')
  const [station, setStation] = useState('all')
  const { data, isLoading, error, refetch } = useKitchenBoard()
  const statusM = useItemStatus()
  usePosLiveUpdates()

  if (isLoading) return <Loading />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const items = (data || []).filter((i) => station === 'all' || (station === 'bar' ? i.bar : !i.bar))

  return (
    <div className="gs-page animate-fade-in">
      {!canOperate && <Notice tone="info">Mutfak ekranını izliyorsunuz; hazırlama durumunu Mutfak Şefi günceller.</Notice>}
      <div className="gs-filterbar">
        {[['all', 'Tümü'], ['kitchen', 'Mutfak'], ['bar', 'Bar / İçecek']].map(([id, label]) => (
          <Button key={id} size="sm" variant={station === id ? 'primary' : 'secondary'} onClick={() => setStation(id)}>{label}</Button>
        ))}
        <span className="gs-muted">{items.length} aktif kalem · canlı</span>
      </div>
      <div className="kds-board">
        {COLUMNS.map((col) => {
          const list = items.filter((i) => i.status === col.status)
          return (
            <section key={col.status} className="kds-col">
              <h4><span>{col.title}</span><Badge tone={list.length ? 'warning' : 'neutral'}>{list.length}</Badge></h4>
              {list.length === 0 && <EmptyState title="Sıra boş" />}
              {list.map((i) => {
                const late = i.waitMinutes >= LATE_MINUTES && col.status !== 'READY'
                const Icon = col.icon
                return (
                  <article key={i.id} className={`kds-ticket ${late ? 'kds-ticket--late' : ''} ${col.status === 'READY' ? 'kds-ticket--ready' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{i.quantity} × {i.productName}</strong>
                      <Badge tone="info">Masa {i.tableNumber}</Badge>
                    </div>
                    {i.note && <div className="gs-cell-sub">Not: {i.note}</div>}
                    <div className="gs-cell-sub">{i.checkNo} · {i.waitMinutes} dk{late ? ' · gecikti' : ''}</div>
                    {canOperate && col.next && (
                      <Button size="sm" loading={statusM.isPending} onClick={() => statusM.mutate({ itemId: i.id, status: col.next })}>
                        <Icon /> {col.action}
                      </Button>
                    )}
                  </article>
                )
              })}
            </section>
          )
        })}
      </div>
      <Card>
        <p className="gs-muted" style={{ margin: 0 }}>
          {LATE_MINUTES} dakikayı aşan siparişler kırmızı işaretlenir. Hazır kalemleri kasiyer servis edildi olarak kapatır; iptal kararı İşletme Müdürüne aittir.
        </p>
      </Card>
    </div>
  )
}
