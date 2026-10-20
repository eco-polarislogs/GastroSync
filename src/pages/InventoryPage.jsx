import React, { useState } from 'react'
import { useInventoryStore, useAuthStore, useExpenseStore, useNotificationStore, ROLES } from '../store'
import { FiSearch, FiAlertCircle, FiArrowUp, FiArrowDown, FiFilter, FiDownload, FiFileText, FiShoppingCart, FiPlus, FiCheck, FiX } from 'react-icons/fi'
import { notifySuccess, notifyError } from '../utils/notify'
import { exportToExcel, exportToCSV } from '../utils/exportUtils'
import { TRANSLATIONS, getCategoryLabel } from '../utils/translations'
import '../styles/pages.css'

export default function InventoryPage() {
  const currentLanguage = useAuthStore((s) => s.currentLanguage) || 'tr'
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr

  const { items, fetchItems } = useInventoryStore()
  
  React.useEffect(() => {
    if (fetchItems) fetchItems()
  }, [fetchItems])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
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
      return matchSearch && matchCategory
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'tr')
      else if (sortBy === 'stock') cmp = a.stock - b.stock
      else if (sortBy === 'price') cmp = a.price - b.price
      return sortDir === 'asc' ? cmp : -cmp
    })

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
  const { addExpense } = useExpenseStore()
  const { sendNotification } = useNotificationStore()

  const [orderModalItem, setOrderModalItem] = useState(null)
  const [orderQuantity, setOrderQuantity] = useState('15')
  const [orderUrgent, setOrderUrgent] = useState(false)
  const [orderNote, setOrderNote] = useState('')

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    if (!orderModalItem) return
    const qty = parseFloat(orderQuantity) || 0
    if (qty <= 0) {
      notifyError('Lütfen geçerli bir sipariş miktarı giriniz.')
      return
    }

    const estimatedCost = Math.round(qty * orderModalItem.price)
    const orderTitle = `${orderModalItem.name} Malzeme Alımı (${qty} ${orderModalItem.unit})`

    // 1. Kasa / Muhasebe ekranına bekleyen ödeme/harcama talebi olarak otomatik işle
    await addExpense({
      title: orderTitle,
      category: 'VARIABLE',
      subType: 'CONSUMABLES',
      amount: estimatedCost,
      period: new Date().toISOString().substring(0, 7),
      expenseDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      recordedBy: user?.name || 'Mutfak Şefi',
      note: `${orderUrgent ? '⚡ [ACİL TALEP] ' : ''}${user?.name || 'Mutfak'} tarafından sipariş talebi açıldı. Mevcut stok: ${orderModalItem.stock} ${orderModalItem.unit}. ${orderNote ? 'Not: ' + orderNote : ''}`,
      counterparty: 'Toptancı Hal / Gıda Tedarik',
      invoiceNumber: `SIP-${Date.now().toString().slice(-6)}`,
      paymentStatus: 'UNPAID', // Muhasebe kasasından ödenmeyi bekliyor
      paidByCashier: false,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    })

    // 2. Canlı Telsiz Mesajı oluştur (Tüm departmanlar anlık görsün)
    try {
      const savedChat = localStorage.getItem('gastrosync_team_chat')
      const chatList = savedChat ? JSON.parse(savedChat) : []
      const newChatMessage = {
        id: Date.now(),
        channelId: 'kitchen',
        sender: user?.name || 'Mehmet Şef',
        role: user?.role || 'chef',
        text: `Depoda ${orderModalItem.name} stoğu ${orderModalItem.stock} ${orderModalItem.unit} kaldı! ${qty} ${orderModalItem.unit} acil sipariş talebi açtım, muhasebeden ${estimatedCost.toLocaleString('tr-TR')} ₺ kasa onayı bekleniyor.`,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        avatar: user?.avatar || 'MŞ',
        priority: orderUrgent ? 'urgent' : 'high'
      }
      localStorage.setItem('gastrosync_team_chat', JSON.stringify([...chatList, newChatMessage]))
    } catch (_) { }

    // 3. Muhasebeci ve Kasaya anlık sistem bildirimi gönder
    sendNotification({
      title: orderUrgent ? '⚡ Acil Malzeme Tedarik Talebi' : '📦 Yeni Malzeme Sipariş Talebi',
      message: `${user?.name || 'Mutfak Şefi'}, ${orderModalItem.name} (${qty} ${orderModalItem.unit}) için sipariş talebi açtı. Tahmini tutar: ${estimatedCost.toLocaleString('tr-TR')} ₺. Kasa onayı bekliyor.`,
      targetRole: 'ACCOUNTANT',
      senderName: user?.name || 'Mutfak Şefi',
      type: 'EXPENSE_APPROVAL',
      relatedEntityId: null
    })

    // 4. Depo Sorumlusuna anlık bildirim düşür (Depo haberdar olsun)
    sendNotification({
      title: orderUrgent ? '⚡ Depo: Acil Malzeme Siparişi Açıldı' : '📦 Depo: Yeni Malzeme Siparişi Açıldı',
      message: `Mutfak tarafından ${orderModalItem.name} için ${qty} ${orderModalItem.unit} tedarik talebi açıldı. Kasa ödemesi ardından sevkiyat masanızda listelenecektir.`,
      targetRole: 'WAREHOUSE',
      senderName: user?.name || 'Mutfak Şefi',
      type: 'PROCUREMENT_REQUESTED',
      relatedEntityId: orderModalItem.id
    })

    notifySuccess(
      `${orderModalItem.name} için ${qty} ${orderModalItem.unit} sipariş talebi oluşturuldu. Kasa, Muhasebe ve Depo ekranına iletildi!`,
      'Tedarik Talebi Açıldı 🚀'
    )

    setOrderModalItem(null)
    setOrderQuantity('15')
    setOrderUrgent(false)
    setOrderNote('')
  }

  return (
    <div className="page-container">
      {/* Actions Row */}
      <div className="page-header-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '-8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Kritik stoktaki ürünler için anında <strong>Sipariş Talebi</strong> açabilir, Kasa ve Depo birimlerini eş zamanlı tetikleyebilirsiniz.
          </span>
        </div>
        <div className="export-btn-group">
          <button 
            className="export-tile-btn export-tile-btn--excel" 
            onClick={handleExportExcel}
            title={t.exportExcel}
          >
            <FiDownload className="export-tile-icon" /> {t.exportExcel}
          </button>
          <button 
            className="export-tile-btn export-tile-btn--csv" 
            onClick={handleExportCSV}
            title={t.exportCsv}
          >
            <FiFileText className="export-tile-icon" /> {t.exportCsv}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={t.searchInventoryPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <FiFilter className="filter-icon" />
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? t.allCategories : getCategoryLabel(cat, currentLanguage)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-value">{items.length}</span>
          <span className="mini-stat-label">{t.totalProductsStat}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value mini-stat-value--warning">
            {items.filter((i) => i.stock <= i.minStock).length}
          </span>
          <span className="mini-stat-label">{t.criticalStockStat}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">
            {items.reduce((sum, i) => sum + i.stock * i.price, 0).toLocaleString('tr-TR')} ₺
          </span>
          <span className="mini-stat-label">{t.totalInventoryValueStat}</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-wrapper">
          <table className="data-table-main">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')} className="th-sortable">
                  {t.productNameCol} <SortIcon field="name" />
                </th>
                <th>{t.categoryCol}</th>
                <th>{t.barcodeCol}</th>
                <th onClick={() => toggleSort('stock')} className="th-sortable">
                  {t.stockCol} <SortIcon field="stock" />
                </th>
                <th>{t.minStockCol}</th>
                <th onClick={() => toggleSort('price')} className="th-sortable">
                  {t.unitPriceCol} <SortIcon field="price" />
                </th>
                <th>{t.totalValueCol}</th>
                <th>{t.statusTh}</th>
                <th style={{ textAlign: 'center' }}>Hızlı İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
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
                  <td>{item.price.toFixed(2)} ₺</td>
                  <td className="td-bold">{(item.stock * item.price).toLocaleString('tr-TR')} ₺</td>
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
                  <td style={{ textAlign: 'center' }}>
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
                      title="Bu malzeme için satın alma talebi aç"
                    >
                      <FiShoppingCart size={13} /> Sipariş Talebi Aç
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
