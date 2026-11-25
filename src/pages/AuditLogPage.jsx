import React, { useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { reportApi } from '../api'
import { PageHeader, Card, DataTable, Badge, Loading, ErrorState, Notice, Pagination, serverPager, sortParam } from '../components/ui'
import { formatDateTime } from '../utils/format'

const ENTITY_FILTERS = [
  { id: '', label: 'Tümü' },
  { id: 'SECURITY', label: 'Güvenlik (yetkisiz erişim)' },
  { id: 'USER', label: 'Kullanıcı & oturum' },
  { id: 'EXPENSE', label: 'Giderler' },
  { id: 'SALE', label: 'Satış & iptal' },
  { id: 'INVENTORY', label: 'Stok' },
  { id: 'RECIPE', label: 'Reçete & fiyat' },
  { id: 'PERIOD', label: 'Dönem kapanışı' },
  { id: 'CASH_CLOSING', label: 'Kasa sayımı' },
]

const ACTION_LABELS = {
  LOGIN_SUCCESS: 'Giriş', LOGIN_FAILED: 'Hatalı giriş', ACCESS_DENIED: 'Yetkisiz erişim',
  USER_CREATED: 'Kullanıcı eklendi', ROLE_CHANGED: 'Rol değişti', USER_DEACTIVATED: 'Pasife alındı',
  USER_ACTIVATED: 'Aktifleştirildi', PASSWORD_RESET: 'Şifre sıfırlandı', PASSWORD_CHANGED: 'Şifre değişti',
  USER_DELETED: 'Kullanıcı arşivlendi', USER_PROFILE_UPDATED: 'Bilgi güncellendi',
  EXPENSE_CREATED: 'Gider kaydı', EXPENSE_APPROVED: 'Gider onayı', EXPENSE_PAID: 'Ödeme', EXPENSE_FINALIZED: 'Deftere işlendi',
  EXPENSE_REJECTED: 'Gider reddi', EXPENSE_UPDATED: 'Gider düzeltme', EXPENSE_RESUBMITTED: 'Tekrar onaya sunuldu',
  EXPENSE_DELETED: 'Gider arşivlendi', PURCHASE_REQUESTED: 'Tedarik talebi', SALE_CREATED: 'Satış', SALE_VOIDED: 'Satış iptali',
  STOCK_COUNT_ADJUSTED: 'Sayım farkı', UNIT_COST_CHANGED: 'Maliyet düzeltme', MENU_PRICE_CHANGED: 'Menü fiyatı',
  PERIOD_CLOSED: 'Dönem kapatıldı', PERIOD_REOPENED: 'Dönem açıldı', CASH_CLOSING: 'Kasa sayımı',
}

const toneFor = (action) => {
  if (/DENIED|FAILED|REJECTED|VOIDED|DELETED|DEACTIVATED|REOPENED/.test(action)) return 'danger'
  if (/CHANGED|RESET|ADJUSTED|CLOSING|UPDATED/.test(action)) return 'warning'
  if (/FINALIZED|APPROVED|SUCCESS|CLOSED|PAID/.test(action)) return 'success'
  return 'neutral'
}

/** Değiştirilemez denetim izi (yalnızca okuma, sunucu tarafı sayfalama) */
export default function AuditLogPage() {
  const [entity, setEntity] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [sort, setSort] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { setPage(0) }, [entity, query, size, sort])

  const q = useQuery({
    queryKey: ['audit', entity, query, page, size, sort],
    queryFn: () => reportApi.auditLogs({ entityType: entity || undefined, q: query || undefined, sort: sortParam(sort), page, size }),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="gs-page animate-fade-in">
      <PageHeader
        title="Denetim İzi"
        subtitle="Giriş denemeleri, yetkisiz erişimler, yetki değişiklikleri, mali kayıt durum geçişleri ve stok düzeltmeleri. Kayıtlar değiştirilemez ve silinemez."
        actions={(
          <>
            <input className="gs-input" placeholder="Kullanıcı, işlem veya ayrıntı ara…" value={search}
              onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
            <select className="gs-select" value={entity} onChange={(e) => setEntity(e.target.value)} style={{ width: 220 }}>
              {ENTITY_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </>
        )}
      />
      <Notice tone="info">Kişisel veri içerdiğinden bu ekran yalnızca Yönetici ve Mali Müşavir tarafından görüntülenebilir.</Notice>
      <Card>
        {q.isLoading ? <Loading /> : q.error ? <ErrorState message={q.error.message} onRetry={q.refetch} /> : (
          <>
            <DataTable
              rows={q.data?.content || []}
              sort={sort}
              onSortChange={setSort}
              columns={[
                { key: 'timestamp', sortKey: 'timestamp', title: 'Zaman', render: (a) => <span className="gs-num">{formatDateTime(a.timestamp)}</span> },
                { key: 'actor', sortKey: 'actor', title: 'Kullanıcı', render: (a) => <div><div className="gs-cell-title">{a.actor}</div><div className="gs-cell-sub">{a.actorRole || '-'}{a.ipAddress ? ` · ${a.ipAddress}` : ''}</div></div> },
                { key: 'action', sortKey: 'action', title: 'İşlem', render: (a) => <Badge tone={toneFor(a.action)} title={a.action}>{ACTION_LABELS[a.action] || a.action}</Badge> },
                { key: 'entity', sortKey: 'entityType', title: 'Kayıt', render: (a) => (a.entityType ? `${a.entityType}${a.entityId ? ` #${a.entityId}` : ''}` : '-') },
                { key: 'change', title: 'Değişim', render: (a) => (a.fromStatus || a.toStatus ? `${a.fromStatus || '–'} → ${a.toStatus || '–'}` : '') },
                { key: 'detail', title: 'Ayrıntı', render: (a) => <span className="gs-muted">{a.detail}</span> },
              ]}
            />
            <Pagination {...serverPager(q.data, setPage, setSize)} />
          </>
        )}
      </Card>
    </div>
  )
}
