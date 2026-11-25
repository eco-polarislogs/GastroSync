import React, { useState } from 'react'
import { Pagination, usePaged, Modal, Button, Field, Notice } from '../components/ui'
import { useAuthStore, hasPermission } from '../store'
import { inventoryApi } from '../api'
import { useQueryClient } from '@tanstack/react-query'
import { useInventoryItems, usePurchaseRequest } from '../hooks/useInventoryQuery'
import { FiSearch, FiAlertCircle, FiArrowUp, FiArrowDown, FiFilter, FiDownload, FiFileText, FiShoppingCart, FiPlus, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi'
import { notifySuccess, notifyError } from '../utils/notify'
import { exportToExcel, exportToCSV } from '../utils/exportUtils'
import { TRANSLATIONS, getCategoryLabel } from '../utils/translations'
import '../styles/pages.css'

export default function InventoryPage() {
  const currentLanguage = useAuthStore((s) => s.currentLanguage) || 'tr'
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr

  // TanStack Query: Server State management with automatic caching & background refetch
  const { data: items = [], isLoading, isError, error, refetch } = useInventoryItems()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const handleExportExcel = () => {
    const exportData = filtered.map(i => ({
      'ID': i.id,
      [t.productNameCol]: i.name,
      [t.categoryCol]: i.category,
      [t.barcodeCol]: i.barcode,
      [t.stockCol]: `${i.stock} ${i.unit}`,
      [t.minStockCol]: `${i.minStock} ${i.unit}`,
      [`${t.unitPriceCol} (TL)`]: i.price,
      [`${t.totalValueCol} (TL)`]: (i.stock * i.price),
      [t.supplier]: i.supplier || '',
      [t.statusTh]: i.stock <= i.minStock ? t.statusCritical : t.statusSufficient
    }))
    const success = exportToExcel(exportData, 'GastroSync_Inventory_Report', 'Inventory')
    if (success) {
      notifySuccess(t.exportExcel, t.appName)
    }
  }

  const handleExportCSV = () => {
    const exportData = filtered.map(i => ({
      'ID': i.id,
      [t.productNameCol]: i.name,
      [t.categoryCol]: i.category,
      [t.barcodeCol]: i.barcode,
      [t.stockCol]: `${i.stock} ${i.unit}`,
      [t.minStockCol]: `${i.minStock} ${i.unit}`,
      [`${t.unitPriceCol} (TL)`]: i.price,
      [`${t.totalValueCol} (TL)`]: (i.stock * i.price),
      [t.supplier]: i.supplier || '',
      [t.statusTh]: i.stock <= i.minStock ? t.statusCritical : t.statusSufficient
    }))
    const success = exportToCSV(exportData, 'GastroSync_Inventory_Report')
    if (success) {
      notifySuccess(t.exportCsv, t.appName)
    }
  }

  const categories = ['all', ...new Set(items.map((i) => i.category))]

  const filtered = items
    .filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.barcode.includes(search)
      const matchCategory =
        categoryFilter === 'all' || item.category === categoryFilter
      const critical = item.stock <= item.minStock
      const matchStock = stockFilter === 'all' || (stockFilter === 'critical' ? critical : !critical)
      return matchSearch && matchCategory && matchStock
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'tr')
      else if (sortBy === 'stock') cmp = a.stock - b.stock
      else if (sortBy === 'price') cmp = a.price - b.price
      else if (sortBy === 'category') cmp = a.category.localeCompare(b.category, 'tr')
      else if (sortBy === 'minStock') cmp = a.minStock - b.minStock
      else if (sortBy === 'value') cmp = a.stock * a.price - b.stock * b.price
      else if (sortBy === 'coverage') cmp = (a.minStock ? a.stock / a.minStock : 99) - (b.minStock ? b.stock / b.minStock : 99)
      return sortDir === 'asc' ? cmp : -cmp
    })
  const inventoryPage = usePaged(filtered, 20)

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }) =>
    sortBy === field ? (
      sortDir === 'asc' ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />
    ) : null

  const { user } = useAuthStore()
  const purchaseM = usePurchaseRequest()
  // Yetkiler sunucudan gelir (sunucu her işlemde ayrıca zorunlu kılar)
  const canRequest = hasPermission(user, 'PURCHASE_REQUEST')
  const canEditCost = hasPermission(user, 'INVENTORY_COST_EDIT')
  const hasActions = canRequest || canEditCost
  const qc = useQueryClient()
  const [costTarget, setCostTarget] = useState(null)
  const [costSaving, setCostSaving] = useState(false)
  const saveCost = async () => {
    const value = parseFloat(String(costTarget.cost).replace(',', '.'))
    if (!(value >= 0)) { notifyError('Geçerli bir birim maliyet girin.'); return }
    setCostSaving(true)
    try {
      const it = costTarget.item
      await inventoryApi.update(it.id, {
        name: it.name, category: it.category, minStock: it.minStock, unit: it.unit,
        supplier: it.supplier, barcode: it.barcode || undefined, unitCost: value,
      })
      notifySuccess(`${it.name} birim maliyeti güncellendi; reçete maliyetleri yeniden hesaplandı.`)
      qc.invalidateQueries({ queryKey: ['inventory'] })
      setCostTarget(null)
    } catch (err) {
      notifyError(err.message, 'İşlem reddedildi')
    } finally {
      setCostSaving(false)
    }
  }

  const [orderModalItem, setOrderModalItem] = useState(null)
  const [orderQuantity, setOrderQuantity] = useState('15')
  const [orderUrgent, setOrderUrgent] = useState(false)
  const [orderNote, setOrderNote] = useState('')

  // Talep sunucuda açılır: muhasebe onayına tahmini tutarlı gider kaydı + ilgili rollere bildirim + depo kanalına mesaj
  const handleCreateOrder = (e) => {
    e.preventDefault()
    if (!orderModalItem) return
    const qty = parseFloat(String(orderQuantity).replace(',', '.')) || 0
    if (qty <= 0) {
      notifyError('Lütfen geçerli bir sipariş miktarı giriniz.')
      return
    }
    purchaseM.mutate(
      { id: orderModalItem.id, quantity: qty, urgent: orderUrgent, note: orderNote.trim() },
      {
        onSuccess: () => {
          setOrderModalItem(null)
          setOrderQuantity('15')
          setOrderUrgent(false)
          setOrderNote('')
        },
      },
    )
  }

  const criticalCount = items.filter((i) => i.stock <= i.minStock).length
  const totalValue = items.reduce((sum, i) => sum + i.stock * i.price, 0)
  const activeFilters = (search ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0) + (stockFilter !== 'all' ? 1 : 0)
  const clearFilters = () => { setSearch(''); setCategoryFilter('all'); setStockFilter('all') }

  return (
    <div className="page-container inv-page">
      {/* Özet: kritik kutucuğu listeyi kritik ürünlere süzer */}
      <div className="inv-stats">
        <button type="button" className={`inv-stat ${stockFilter === 'all' && !search && categoryFilter === 'all' ? 'is-active' : ''}`} onClick={clearFilters}>
          <span className="inv-stat-value">{items.length}</span>
          <span className="inv-stat-label">{t.totalProductsStat}</span>
        </button>
        <button type="button" className={`inv-stat inv-stat--warn ${stockFilter === 'critical' ? 'is-active' : ''}`}
          onClick={() => setStockFilter(stockFilter === 'critical' ? 'all' : 'critical')}>
          <span className="inv-stat-value">{criticalCount}</span>
          <span className="inv-stat-label">{t.criticalStockStat}</span>
        </button>
        <div className="inv-stat inv-stat--static">
          <span className="inv-stat-value">{totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
          <span className="inv-stat-label">{t.totalInventoryValueStat}</span>
        </div>
        <div className="inv-stat inv-stat--static">
          <span className="inv-stat-value">{categories.length - 1}</span>
          <span className="inv-stat-label">Kategori</span>
        </div>
      </div>

      <div className="inv-panel">
        {/* Araç çubuğu: sayfayla birlikte kaymaz, tek satır; dar ekranda alt alta */}
        <div className="inv-toolbar">
          <div className="inv-search">
            <FiSearch className="inv-search-icon" />
            <input
              type="text"
              placeholder={t.searchInventoryPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t.searchInventoryPlaceholder}
            />
            {search && <button type="button" className="inv-clear" onClick={() => setSearch('')} aria-label="Temizle"><FiX size={14} /></button>}
          </div>
          <select className="inv-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label={t.categoryCol}>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat === 'all' ? t.allCategories : getCategoryLabel(cat, currentLanguage)}</option>
            ))}
          </select>
          <select className="inv-select" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} aria-label="Stok durumu">
            <option value="all">Tüm stok durumları</option>
            <option value="critical">Yalnızca kritik</option>
            <option value="ok">Yeterli</option>
          </select>
          <div className="inv-toolbar-end">
            <span className="inv-count">{filtered.length} / {items.length} ürün</span>
            {activeFilters > 0 && (
              <button type="button" className="inv-icon-btn" onClick={clearFilters} title="Filtreleri temizle"><FiX size={15} /> Temizle</button>
            )}
            <button type="button" className="inv-icon-btn" onClick={handleExportExcel} title={t.exportExcel}><FiDownload size={15} /> Excel</button>
            <button type="button" className="inv-icon-btn" onClick={handleExportCSV} title={t.exportCsv}><FiFileText size={15} /> CSV</button>
            <button type="button" className="inv-icon-btn" onClick={() => refetch()} title="Veritabanından yenile" aria-label="Yenile"><FiRefreshCw size={15} /></button>
          </div>
        </div>

      {/* Loading & Error States */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
          <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
            Stok ve envanter verileri PostgreSQL veritabanından çekiliyor...
          </p>
        </div>
      ) : isError ? (
        <div style={{ textAlign: 'center', padding: '30px 20px', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fecaca', color: '#b91c1c' }}>
          <FiAlertCircle size={28} style={{ marginBottom: '8px' }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700 }}>Veritabanı Senkronizasyon Hatası</h4>
          <p style={{ margin: 0, fontSize: '13px' }}>{error?.message || 'Stok listesi sunucudan yüklenemedi.'}</p>
          <button 
            onClick={() => refetch()} 
            style={{ marginTop: '12px', padding: '6px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12.5px' }}
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
      /* Tablo: kendi içinde kayar, başlık sabit kalır */
      <>
        <div className="inv-table-scroll">
          <table className="data-table-main inv-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')} className="th-sortable">
                  {t.productNameCol} <SortIcon field="name" />
                </th>
                <th onClick={() => toggleSort('category')} className="th-sortable">
                  {t.categoryCol} <SortIcon field="category" />
                </th>
                <th>{t.barcodeCol}</th>
                <th onClick={() => toggleSort('stock')} className="th-sortable">
                  {t.stockCol} <SortIcon field="stock" />
                </th>
                <th onClick={() => toggleSort('minStock')} className="th-sortable">
                  {t.minStockCol} <SortIcon field="minStock" />
                </th>
                <th onClick={() => toggleSort('price')} className="th-sortable">
                  {t.unitPriceCol} <SortIcon field="price" />
                </th>
                <th onClick={() => toggleSort('value')} className="th-sortable">
                  {t.totalValueCol} <SortIcon field="value" />
                </th>
                <th onClick={() => toggleSort('coverage')} className="th-sortable">
                  {t.statusTh} <SortIcon field="coverage" />
                </th>
                {hasActions && <th style={{ textAlign: 'center' }}>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {inventoryPage.items.map((item) => (
                <tr key={item.id} className={item.stock <= item.minStock ? 'row-warning' : ''}>
                  <td className="td-bold">{item.name}</td>
                  <td>
                    <span className="category-badge">{getCategoryLabel(item.category, currentLanguage)}</span>
                  </td>
                  <td className="td-mono">{item.barcode}</td>
                  <td className={item.stock <= item.minStock ? 'td-warning-text' : ''}>
                    {item.stock} {item.unit}
                  </td>
                  <td>{item.minStock} {item.unit}</td>
                  <td>{item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</td>
                  <td className="td-bold">{(item.stock * item.price).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</td>
                  <td>
                    {item.stock <= item.minStock ? (
                      <span className="status-badge status-badge--warning">
                        <FiAlertCircle size={12} /> {t.statusCritical}
                      </span>
                    ) : (
                      <span className="status-badge status-badge--tier">
                        <span className="tier-dot"></span> {t.statusSufficient}
                      </span>
                    )}
                  </td>
                  {hasActions && (
                  <td style={{ textAlign: 'center' }}>
                    {canEditCost && (
                      <button type="button" className="export-tile-btn" style={{ padding: '6px 10px', fontSize: 12, marginRight: canRequest ? 6 : 0 }}
                        onClick={() => setCostTarget({ item, cost: String(item.price) })}>
                        Maliyet Düzelt
                      </button>
                    )}
                    {canRequest && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrderModalItem(item)
                        const needed = Math.max(10, Math.ceil(item.minStock * 2 - item.stock))
                        setOrderQuantity(needed.toString())
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '8px',
                        border: item.stock <= item.minStock ? '1px solid #f87171' : '1px solid #a7f3d0',
                        background: item.stock <= item.minStock ? '#fef2f2' : '#ecfdf5',
                        color: item.stock <= item.minStock ? '#b91c1c' : '#065f46',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <FiShoppingCart size={13} /> Sipariş Talebi Aç
                    </button>
                    )}
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="inv-empty">
              Bu filtrelerle eşleşen ürün yok.{' '}
              {activeFilters > 0 && <button type="button" className="inv-link" onClick={clearFilters}>Filtreleri temizle</button>}
            </div>
          )}
        </div>
        {filtered.length > 0 && <div className="inv-pager"><Pagination {...inventoryPage.pager} /></div>}
      </>
      )}
      </div>

      <Modal
        open={!!costTarget}
        onClose={() => setCostTarget(null)}
        title={`Birim maliyet düzeltmesi · ${costTarget?.item?.name || ''}`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCostTarget(null)}>Vazgeç</Button>
            <Button loading={costSaving} onClick={saveCost}>Kaydet</Button>
          </>
        )}
      >
        {costTarget && (
          <div className="gs-form">
            <Field label={`Birim maliyet (₺ / ${costTarget.item.unit})`} required>
              <input className="gs-input" type="number" min="0" step="0.01" value={costTarget.cost}
                onChange={(e) => setCostTarget({ ...costTarget, cost: e.target.value })} />
            </Field>
            <Notice tone="info">Ağırlıklı ortalama maliyet mal kabulde otomatik hesaplanır. Elle düzeltme yalnızca Muhasebe yapar ve denetim izine yazılır.</Notice>
          </div>
        )}
      </Modal>

      {/* SİPARİŞ / SATIN ALMA TALEP MODALI */}
      {orderModalItem && (
        <div className="modal-overlay" onClick={() => setOrderModalItem(null)}>
          <div
            className="modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '520px',
              background: '#ffffff',
              border: '1px solid #dbe7df',
              borderRadius: '16px',
              boxShadow: '0 20px 45px rgba(10, 31, 17, 0.18)',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e8f0ea', background: '#f8fbf9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '20px' }}>
                  <FiShoppingCart size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>
                    Malzeme Tedarik Talebi
                  </h3>
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                    Kasa/Muhasebeye ödeme talebi ve Ekip Telsizine anlık bildirim
                  </span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setOrderModalItem(null)} style={{ color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Ürün Bilgi Kartı */}
              <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{orderModalItem.name}</strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Barkod: {orderModalItem.barcode} | Kategori: {orderModalItem.category}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Mevcut Depo Stoğu</span>
                  <strong style={{ fontSize: '14px', color: orderModalItem.stock <= orderModalItem.minStock ? '#dc2626' : '#059669' }}>
                    {orderModalItem.stock} {orderModalItem.unit} (Min: {orderModalItem.minStock})
                  </strong>
                </div>
              </div>

              {/* Sipariş Miktarı ve Birim Fiyat */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Talep Edilen Miktar ({orderModalItem.unit}) *
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    className="form-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '14px', fontWeight: 700 }}
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Birim Maliyet / Tahmini Tutar
                  </label>
                  <div style={{ padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    {orderModalItem.price.toFixed(2)} ₺ / {orderModalItem.unit} ➔ <span style={{ color: '#059669' }}>{(parseFloat(orderQuantity || 0) * orderModalItem.price).toLocaleString('tr-TR')} ₺</span>
                  </div>
                </div>
              </div>

              {/* Acil Sipariş Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: orderUrgent ? '#dc2626' : '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={orderUrgent}
                  onChange={(e) => setOrderUrgent(e.target.checked)}
                />
                <span>⚡ Acil Tedarik (Akşam Servisi Öncesi Hemen Alınmalı)</span>
              </label>

              {/* Açıklama / Talep Notu */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Açıklama / Şef Notu
                </label>
                <textarea
                  rows="2"
                  placeholder="Örn: Akşam ızgara ve meze porsiyonları için toptancıdan hemen temin edilmeli..."
                  className="form-input"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', background: '#f8fafc' }}
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                />
              </div>

              {/* Canlı Akış Bilgi Kartı */}
              <div style={{ backgroundColor: '#f0fdf4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>🔄</span>
                <span style={{ fontSize: '12px', color: '#166534', lineHeight: '1.4' }}>
                  Bu buton onaylandığında: <strong>Kasa & Muhasebe</strong> bekleyen borçlara eklenir, <strong>Ekip Telsizi</strong>'ne otomatik anons düşer ve depocu mal kabul ekranında ürünü beklemeye alır.
                </span>
              </div>

              {/* Butonlar */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: '12px', justifyContent: 'center', fontWeight: 700 }}
                >
                  🚀 Sipariş Talebini Aç & Birimleri Tetikle
                </button>
                <button
                  type="button"
                  onClick={() => setOrderModalItem(null)}
                  className="btn-secondary"
                  style={{ padding: '12px 20px', fontWeight: 600 }}
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
