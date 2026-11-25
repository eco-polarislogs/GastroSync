import React, { useMemo, useState } from 'react'
import { FiSearch, FiClipboard } from 'react-icons/fi'
import { useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, EmptyState, Field, Notice } from '../components/ui'
import ApprovalsPanel from '../components/ApprovalsPanel'
import { useApprovalSummary } from '../hooks/useApprovalQuery'
import { inventoryApi } from '../api'
import { useInventoryStore } from '../store'
import { money } from '../utils/format'
import { notifyError, notifySuccess } from '../utils/notify'

/**
 * Depo sayımı (web). Mobil uygulamadaki sayım düzeltmesiyle aynı sunucu kuralı:
 * küçük fark doğrudan stoğa işlenir; eşiği aşan fark İşletme Müdürü onayına gider ve onaylanınca işlenir.
 */
export default function StockCountPanel() {
  const items = useInventoryStore((s) => s.items)
  const refresh = useInventoryStore((s) => s.refresh)
  const qc = useQueryClient()
  const summary = useApprovalSummary()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [counted, setCounted] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr')
    return (items || [])
      .filter((i) => !needle || i.name.toLocaleLowerCase('tr').includes(needle) || String(i.barcode || '').includes(needle))
      .slice(0, 30)
  }, [items, q])

  const submit = async () => {
    const value = parseFloat(String(counted).replace(',', '.'))
    if (!(value >= 0)) { notifyError('Sayılan miktarı girin (0 veya daha büyük).'); return }
    setSaving(true)
    try {
      const res = await inventoryApi.adjust(selected.id, { countedQuantity: value, reason: reason.trim() })
      setResult({ item: selected, ...res })
      if (res?.approvalRequired) notifySuccess('Sayım farkı eşiği aştı; İşletme Müdürü onayına gönderildi.', 'Onaya gönderildi')
      else notifySuccess('Sayım farkı stoğa işlendi.')
      setCounted('')
      setReason('')
      setSelected(null)
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['approvals'] })
      refresh?.()
    } catch (err) {
      notifyError(err.message, 'Sayım kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="gs-page" style={{ padding: 12 }}>
      <Notice tone="info">
        Fiziki sayım sonucunu girin. Küçük farklar doğrudan stoğa işlenir; {summary.data?.countRule || 'büyük farklar'} İşletme Müdürü onayına gider.
        Onay beklerken yapılan satışlar düşülerek yalnızca sayım farkı uygulanır.
      </Notice>
      {result && (
        <Notice tone={result.approvalRequired ? 'warning' : 'success'}>
          <strong>{result.item.name}:</strong>{' '}
          fark {Number(result.evaluation?.delta) > 0 ? '+' : ''}{Number(result.evaluation?.delta)} {result.item.unit}
          {' '}({money(result.evaluation?.value)}, %{Number(result.evaluation?.percent)}) —{' '}
          {result.approvalRequired ? 'Müdür onayı bekleniyor.' : 'stoğa işlendi.'}
        </Notice>
      )}
      <Card title="Sayım Gir" extra={<FiClipboard />}>
        {!selected ? (
          <>
            <div className="gs-search" style={{ marginBottom: 8 }}>
              <FiSearch />
              <input className="gs-input" placeholder="Ürün adı veya barkod…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {list.length === 0 ? <EmptyState title="Ürün bulunamadı" /> : (
              <div style={{ display: 'grid', gap: 6 }}>
                {list.map((i) => (
                  <button key={i.id} type="button" className="pos-menu-item" style={{ textAlign: 'left' }} onClick={() => setSelected(i)}>
                    <strong>{i.name}</strong>
                    <span className="gs-cell-sub">Sistem: {i.stock} {i.unit} · {i.category}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="gs-form">
            <div><strong>{selected.name}</strong> <Badge>{selected.category}</Badge></div>
            <div className="gs-muted">Sistemdeki stok: {selected.stock} {selected.unit} · Birim maliyet {money(selected.price)}</div>
            <Field label={`Sayılan miktar (${selected.unit})`} required>
              <input className="gs-input" type="number" min="0" step="0.001" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
            </Field>
            <Field label="Açıklama" required hint="Ör. ay sonu sayımı, raf sayımı">
              <input className="gs-input" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="gs-actions" style={{ justifyContent: 'flex-start' }}>
              <Button variant="secondary" onClick={() => setSelected(null)}>Geri</Button>
              <Button loading={saving} disabled={counted === '' || reason.trim().length < 3} onClick={submit}>Sayımı Kaydet</Button>
            </div>
          </div>
        )}
      </Card>
      <Card title={`Sayım Onay Taleplerim${summary.data?.pendingMine ? ` (${summary.data.pendingMine} bekliyor)` : ''}`}>
        <ApprovalsPanel scope="mine" defaultStatus="ALL" compact />
      </Card>
    </div>
  )
}
