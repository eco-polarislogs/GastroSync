import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useInventoryStore, ROLE_COLORS } from '../store'
import { FiAlertTriangle, FiSearch, FiFilter, FiLogOut, FiPackage, FiBarChart2, FiSettings, FiCheck, FiX, FiArrowLeft, FiCamera } from 'react-icons/fi'
import { notifySuccess, notifyError } from '../utils/notify'
import { TRANSLATIONS, getCategoryLabel } from '../utils/translations'
import '../styles/warehouse.css'

export default function WarehouseMobile({ isEmbedded = false }) {
  const navigate = useNavigate()
  const currentLanguage = useAuthStore((s) => s.currentLanguage) || 'tr'
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr
  const { user, logout } = useAuthStore()
  const { items, recentActions, addStock, reportWaste, fetchItems, fetchTransactions } = useInventoryStore()

  useEffect(() => {
    if (fetchItems) fetchItems()
    if (fetchTransactions) fetchTransactions()
  }, [fetchItems, fetchTransactions])

  const [activeTab, setActiveTab] = useState('operations')
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [showWasteModal, setShowWasteModal] = useState(false)
  const [wasteSearchQuery, setWasteSearchQuery] = useState('')
  const [wasteCategoryFilter, setWasteCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [stockSearchQuery, setStockSearchQuery] = useState('')
  const [stockCategoryFilter, setStockCategoryFilter] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [wasteReason, setWasteReason] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState(null)
  const [assignSearch, setAssignSearch] = useState('')
  const [showNewItemModal, setShowNewItemModal] = useState(false)
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    category: 'Kuru Gıda',
    unit: 'kg',
    currentStock: '',
    minStock: '',
    unitCost: '',
    supplier: '',
    barcode: ''
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Barkod simülasyonu
  const handleBarcodeScanned = () => {
    setShowBarcodeModal(true)
  }

  const handleCreateNewItem = async (e) => {
    e.preventDefault()
    if (!newItemForm.name.trim()) return

    const payload = {
      name: newItemForm.name.trim(),
      category: newItemForm.category || 'Genel',
      currentStock: parseFloat(newItemForm.currentStock) || 0,
      minStock: parseFloat(newItemForm.minStock) || 0,
      unit: newItemForm.unit || 'adet',
      unitCost: parseFloat(newItemForm.unitCost) || 0,
      supplier: newItemForm.supplier || '',
      barcode: newItemForm.barcode ? newItemForm.barcode.trim() : `GS-${Date.now().toString().slice(-8)}`,
      lastUpdated: 'Bugün'
    }

    try {
      const res = await fetch('http://localhost:8080/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.success) {
        notifySuccess(`"${payload.name}" ürünü depoya eklendi! (Barkod: ${payload.barcode})`, 'Ürün Oluşturuldu')
      }
    } catch (_) {
      notifySuccess(`"${payload.name}" ürünü depoya eklendi!`, 'Ürün Oluşturuldu')
    }

    if (fetchItems) fetchItems()
    setShowNewItemModal(false)
    setNewItemForm({
      name: '',
      category: 'Kuru Gıda',
      unit: 'kg',
      currentStock: '',
      minStock: '',
      unitCost: '',
      supplier: '',
      barcode: ''
    })
  }

  const handleReceive = async () => {
    if (selectedItem && quantity > 0) {
      const parsedQty = parseFloat(quantity)
      try {
        const res = await fetch(`http://localhost:8080/api/inventory/${selectedItem.id}/receive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: parsedQty, recordedBy: user?.name || 'Depo Sorumlusu' })
        })
        const data = await res.json()
        if (data.success) {
          notifySuccess(data.message || `${selectedItem.name} stoğa işlendi (+${parsedQty} ${selectedItem.unit})`, 'Mal Kabul Onaylandı')
        }
      } catch (err) {
        notifySuccess(`${selectedItem.name} stoğa eklendi (+${parsedQty} ${selectedItem.unit})`, 'Mal Kabul Onaylandı')
      }
      addStock(selectedItem.id, parsedQty)
      if (fetchItems) fetchItems()
      if (fetchTransactions) fetchTransactions()
      setShowBarcodeModal(false)
      setSelectedItem(null)
      setQuantity('')
    }
  }

  const handleWaste = async () => {
    if (selectedItem && quantity > 0 && wasteReason) {
      const parsedQty = parseFloat(quantity)
      try {
        const res = await fetch(`http://localhost:8080/api/inventory/${selectedItem.id}/waste`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: parsedQty, reason: wasteReason, recordedBy: user?.name || 'Depo Sorumlusu' })
        })
        const data = await res.json()
        if (data && data.success) {
          notifySuccess(data.message || `${selectedItem.name} için -${parsedQty} ${selectedItem.unit} fire kaydedildi`, 'Zayiat Kaydedildi')
        } else {
          notifySuccess(`${selectedItem.name} için -${parsedQty} ${selectedItem.unit} zayiat kaydedildi`, 'Zayiat Kaydedildi')
        }
      } catch (err) {
        notifySuccess(`${selectedItem.name} için -${parsedQty} ${selectedItem.unit} zayiat kaydedildi`, 'Zayiat Kaydedildi')
      }
      reportWaste(selectedItem.id, parsedQty, wasteReason)
      if (fetchItems) fetchItems()
      if (fetchTransactions) fetchTransactions()
      setShowWasteModal(false)
      setSelectedItem(null)
      setQuantity('')
      setWasteReason('')
    }
  }

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode.includes(searchQuery)
  )

  const warehouseCategories = ['all', ...new Set(items.map((i) => i.category))]

  const filteredStockItems = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
      item.barcode.includes(stockSearchQuery)
    const matchCat = stockCategoryFilter === 'all' || item.category === stockCategoryFilter
    return matchSearch && matchCat
  })

  const filteredWasteItems = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(wasteSearchQuery.toLowerCase()) ||
      item.barcode.includes(wasteSearchQuery)
    const matchCat = wasteCategoryFilter === 'all' || item.category === wasteCategoryFilter
    return matchSearch && matchCat
  })

  const todayActions = recentActions.filter((a) => a.date === new Date().toISOString().split('T')[0] || a.date === '2026-10-13')

  return (
    <div className="wh-page">
      {/* Success Toast */}
      {showSuccess && (
        <div className="wh-toast animate-fade-in-up">
          <FiCheck className="wh-toast-icon" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      {!isEmbedded && (
        <header className="wh-header">
          <div className="wh-header-brand-wrap">
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <button
                className="wh-back-btn"
                onClick={() => navigate('/dashboard')}
                title={t.backToDashboard}
              >
                <FiArrowLeft /> {t.backToDashboard}
              </button>
            )}
            <div className="wh-header-brand">GastroSync Terminal</div>
          </div>
          <div className="wh-header-right">
            {user?.role === 'warehouse' && (
              <button className="wh-logout-btn" onClick={handleLogout} title={t.logout}>
                <FiLogOut />
              </button>
            )}
            <div
              className="wh-avatar"
              style={{ backgroundColor: ROLE_COLORS[user?.role] }}
            >
              {user?.avatar}
            </div>
          </div>
        </header>
      )}

      {isEmbedded && (
        <div className="wh-embedded-bar">
          <button
            className="wh-back-btn"
            onClick={() => navigate('/dashboard')}
            title={t.backToFinancialSummary}
          >
            <FiArrowLeft /> {t.backToFinancialSummary}
          </button>
          <span className="wh-embedded-title">{t.warehouseTerminalModule}</span>
        </div>
      )}

      {/* Content */}
      <div className="wh-content">
        {activeTab === 'operations' && (
          <>
            {/* Primary Action Buttons */}
            <div className="wh-actions" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <button className="wh-action-btn wh-action-btn--primary" onClick={handleBarcodeScanned}>
                <div className="wh-action-icon">⌨️</div>
                <span className="wh-action-label">{t.goodsReceiptBtn}</span>
                <span className="wh-action-sub">{t.barcodeEntrySub}</span>
              </button>
              <button className="wh-action-btn wh-action-btn--danger" onClick={() => setShowWasteModal(true)}>
                <div className="wh-action-icon">⚠️</div>
                <span className="wh-action-label">{t.reportWasteBtn}</span>
                <span className="wh-action-sub">{t.spoilageRecordSub}</span>
              </button>
              <button 
                className="wh-action-btn" 
                onClick={() => setShowNewItemModal(true)}
                style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)' }}
              >
                <div className="wh-action-icon">➕</div>
                <span className="wh-action-label">{t.addNewProductBtn}</span>
                <span className="wh-action-sub">{t.rawMaterialRecordSub}</span>
              </button>
            </div>

            {/* Search */}
            <div className="wh-search-card">
              <div className="wh-search-label">{t.manualSearchPlaceholder}</div>
              <div className="wh-search-input-wrapper">
                <FiSearch className="wh-search-icon" />
                <input
                  type="text"
                  className="wh-search-input"
                  placeholder={t.manualSearchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {searchQuery && (
                <div className="wh-search-results">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      className="wh-search-result"
                      onClick={() => {
                        setSelectedItem(item)
                        setShowBarcodeModal(true)
                        setSearchQuery('')
                      }}
                    >
                      <div>
                        <div className="wh-search-result-name">{item.name}</div>
                        <div className="wh-search-result-detail">
                          {t.stockCol}: {item.stock} {item.unit} | {t.barcodeCol}: {item.barcode}
                        </div>
                      </div>
                      <span className="wh-search-result-arrow">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Actions */}
            <div className="wh-recent-card">
              <div className="wh-recent-header">{t.todayTransactions}</div>
              {todayActions.map((action) => (
                <div
                  key={action.id}
                  className={`wh-recent-item ${action.type === 'waste' ? 'wh-recent-item--waste' : ''}`}
                >
                  <div className="wh-recent-left">
                    <div className={`wh-recent-dot ${action.type === 'waste' ? 'wh-recent-dot--danger' : 'wh-recent-dot--success'}`}></div>
                    <div>
                      <div className="wh-recent-name">{action.itemName}</div>
                      <div className="wh-recent-detail">
                        {action.type === 'waste' ? `${t.reasonLabel}: ${action.reason}` : `${t.barcodeCol}: ${action.barcode || '—'}`}
                      </div>
                    </div>
                  </div>
                  <div className="wh-recent-right">
                    <div className={`wh-recent-qty ${action.type === 'waste' ? 'wh-recent-qty--danger' : ''}`}>
                      {action.type === 'waste' ? '-' : '+'} {action.quantity} {action.unit}
                    </div>
                    <div className={`wh-recent-type ${action.type === 'waste' ? 'wh-recent-type--danger' : 'wh-recent-type--success'}`}>
                      {action.type === 'waste' ? t.wasteDeduction : t.goodsReceiptSuccess}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'stock' && (
          <div className="wh-stock-list">
            <div className="wh-stock-header-row" style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(10, 31, 17, 0.04)',
                boxSizing: 'border-box'
              }}>
                <div style={{ position: 'relative', flex: '1', minWidth: '180px' }}>
                  <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Depoda ara (isim/barkod)..."
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                      outline: 'none',
                      background: '#f8fafc',
                      color: '#1e293b',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <FiFilter style={{ color: '#10b981' }} size={15} />
                  <select
                    value={stockCategoryFilter}
                    onChange={(e) => setStockCategoryFilter(e.target.value)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                      fontWeight: '600',
                      outline: 'none',
                      background: '#f8fafc',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    {warehouseCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'all' ? 'Tüm Kategoriler' : cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ marginLeft: 'auto', flexShrink: 0, paddingLeft: '8px', borderLeft: '1px solid #e2e8f0' }}>
                  <span className="wh-stock-count" style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    <strong>{filteredStockItems.length}</strong> / {items.length} ürün
                  </span>
                </div>
              </div>
            </div>
            {filteredStockItems.map((item) => (
              <div key={item.id} className={`wh-stock-item ${item.stock <= item.minStock ? 'wh-stock-item--low' : ''}`}>
                <div className="wh-stock-item-top">
                  <span className="wh-stock-item-name">{item.name}</span>
                  <span className={`wh-stock-item-qty ${item.stock <= item.minStock ? 'wh-stock-item-qty--low' : ''}`}>
                    {item.stock} {item.unit}
                  </span>
                </div>
                <div className="wh-stock-item-bottom">
                  <span className="wh-stock-item-cat">{item.category}</span>
                  <span className="wh-stock-item-min">Min: {item.minStock} {item.unit}</span>
                </div>
                {item.stock <= item.minStock && (
                  <div className="wh-stock-item-warning">⚠️ Kritik stok seviyesi!</div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && user?.role === 'warehouse' && (
          <div className="wh-settings">
            <div className="wh-settings-card">
              <div className="wh-settings-avatar" style={{ backgroundColor: ROLE_COLORS[user?.role] }}>
                {user?.avatar}
              </div>
              <h3 className="wh-settings-name">{user?.name}</h3>
              <p className="wh-settings-role">Depo Sorumlusu</p>
              <p className="wh-settings-email">{user?.email}</p>
            </div>
            <button className="wh-settings-logout" onClick={handleLogout}>
              <FiLogOut /> Oturumu Kapat
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="wh-bottom-nav">
        <button
          className={`wh-nav-item ${activeTab === 'operations' ? 'wh-nav-item--active' : ''}`}
          onClick={() => setActiveTab('operations')}
        >
          <FiPackage />
          <span>{t.tabStockOps}</span>
        </button>
        <button
          className={`wh-nav-item ${activeTab === 'stock' ? 'wh-nav-item--active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          <FiBarChart2 />
          <span>{t.tabWarehouseStatus}</span>
        </button>
        {user?.role === 'warehouse' && (
          <button
            className={`wh-nav-item ${activeTab === 'settings' ? 'wh-nav-item--active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <FiSettings />
            <span>Ayarlar</span>
          </button>
        )}
      </nav>

      {/* Barkod / Mal Kabul Modal */}
      {showBarcodeModal && (
        <div className="wh-modal-overlay" onClick={() => setShowBarcodeModal(false)}>
          <div className="wh-modal wh-modal--wide animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header">
              <h3>Mal Kabul — Barkod / QR Terminali</h3>
              <button className="wh-modal-close" onClick={() => setShowBarcodeModal(false)}>
                <FiX />
              </button>
            </div>

            {/* Durum 1: Barkod başarıyla okundu fakat sistemde tanımlı değil */}
            {unrecognizedBarcode ? (
              <div className="wh-modal-body" style={{ padding: '24px' }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#065f46', fontWeight: '700', fontSize: '15px' }}>
                    <FiCheck style={{ fontSize: '20px', color: '#10b981' }} />
                    Barkod Başarıyla Okundu: <span style={{ fontFamily: 'monospace', letterSpacing: '1px', background: '#d1fae5', padding: '2px 8px', borderRadius: '6px' }}>{unrecognizedBarcode}</span>
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#047857' }}>
                    Bu barkod henüz hiçbir hammaddeye atanmamış. Aşağıdaki depodaki ürünlerden birine bu barkodu tek tıkla tanımlayabilir ve mal kabulünü hemen yapabilirsiniz:
                  </p>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    placeholder="Ürün ara (Örn: Domates, Un, Kolonya)..."
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #dbe7df',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    autoFocus
                  />
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items
                    .filter(i => !assignSearch || i.name.toLowerCase().includes(assignSearch.toLowerCase()) || i.category.toLowerCase().includes(assignSearch.toLowerCase()))
                    .map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: '#f8faf9',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{item.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Mevcut Stok: <strong>{item.stock} {item.unit}</strong> | Eski Barkod: {item.barcode || 'Yok'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              // Backend'e barkodu bu ürüne kalıcı ata
                              await fetch(`http://localhost:8080/api/inventory/${item.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...item, barcode: unrecognizedBarcode })
                              })
                              if (fetchItems) fetchItems()
                            } catch (_) { }

                            const updatedItem = { ...item, barcode: unrecognizedBarcode }
                            setSelectedItem(updatedItem)
                            setUnrecognizedBarcode(null)
                            notifySuccess(`"${item.name}" ürününe ${unrecognizedBarcode} barkodu tanımlandı!`, 'Barkod Eşleştirildi')
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: '#10b981',
                            color: '#ffffff',
                            fontWeight: '700',
                            fontSize: '13px',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Bu Ürüne Tanımla ve Mal Kabul Et
                        </button>
                      </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUnrecognizedBarcode(null)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      padding: '8px 4px'
                    }}
                  >
                    ← Yeniden Barkod Tara
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const codeToKeep = unrecognizedBarcode
                      setUnrecognizedBarcode(null)
                      setShowBarcodeModal(false)
                      setNewItemForm(prev => ({
                        ...prev,
                        barcode: codeToKeep,
                        currentStock: '',
                        name: ''
                      }))
                      setShowNewItemModal(true)
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
                    }}
                  >
                    ➕ Bu Barkod ile Yeni Ürün Kaydet ({unrecognizedBarcode})
                  </button>
                </div>
              </div>
            ) : !selectedItem ? (
              <div className="wh-modal-body">
                <div className="wh-scanner-horizontal-grid">
                  {/* Sol Sütun: Manuel Barkod Giriş Kutusu (Kamerasız) */}
                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #dbe7df' }}>
                    <p className="wh-modal-info" style={{ textAlign: 'left', marginBottom: '10px', fontWeight: 800, color: '#0f172a' }}>
                      ⌨️ Barkod Numarasını Girin:
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        placeholder="Örn: 8691234567890"
                        className="wh-modal-input"
                        style={{ flex: 1, fontSize: '15px', fontFamily: 'monospace' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            const cleanCode = searchQuery.trim()
                            if (!cleanCode) return
                            let found = items.find(i => i.barcode === cleanCode || (i.barcode && i.barcode.replace(/\s+/g, '') === cleanCode))
                            if (!found) {
                              try {
                                const res = await fetch(`http://localhost:8080/api/inventory/barcode/${encodeURIComponent(cleanCode)}`)
                                const json = await res.json()
                                if (json.success && json.data) {
                                  found = {
                                    id: json.data.id,
                                    name: json.data.name,
                                    category: json.data.category,
                                    stock: parseFloat(json.data.currentStock) || 0,
                                    minStock: parseFloat(json.data.minStock) || 0,
                                    unit: json.data.unit,
                                    price: parseFloat(json.data.unitCost) || 0,
                                    supplier: json.data.supplier || '',
                                    barcode: json.data.barcode || cleanCode,
                                    lastUpdated: json.data.lastUpdated || 'Bugün'
                                  }
                                }
                              } catch (_) { }
                            }
                            if (found) {
                              setSelectedItem(found)
                              notifySuccess(`Ürün bulundu: ${found.name}`, 'Barkod Eşleşti')
                              setSearchQuery('')
                            } else {
                              setUnrecognizedBarcode(cleanCode)
                              setAssignSearch('')
                            }
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="action-btn action-btn--primary"
                        style={{ padding: '10px 16px', fontWeight: 700 }}
                        onClick={async () => {
                          const cleanCode = searchQuery.trim()
                          if (!cleanCode) return
                          let found = items.find(i => i.barcode === cleanCode || (i.barcode && i.barcode.replace(/\s+/g, '') === cleanCode))
                          if (!found) {
                            try {
                              const res = await fetch(`http://localhost:8080/api/inventory/barcode/${encodeURIComponent(cleanCode)}`)
                              const json = await res.json()
                              if (json.success && json.data) {
                                found = {
                                  id: json.data.id,
                                  name: json.data.name,
                                  category: json.data.category,
                                  stock: parseFloat(json.data.currentStock) || 0,
                                  minStock: parseFloat(json.data.minStock) || 0,
                                  unit: json.data.unit,
                                  price: parseFloat(json.data.unitCost) || 0,
                                  supplier: json.data.supplier || '',
                                  barcode: json.data.barcode || cleanCode,
                                  lastUpdated: json.data.lastUpdated || 'Bugün'
                                }
                              }
                            } catch (_) { }
                          }
                          if (found) {
                            setSelectedItem(found)
                            notifySuccess(`Ürün bulundu: ${found.name}`, 'Barkod Eşleşti')
                            setSearchQuery('')
                          } else {
                            setUnrecognizedBarcode(cleanCode)
                            setAssignSearch('')
                          }
                        }}
                      >
                        Getir
                      </button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Barkod numarasını elle yazıp <strong>Enter</strong> veya <strong>Getir</strong> butonuna basarak mal kabul miktarını girebilirsiniz.
                    </div>
                  </div>

                  {/* Sağ Sütun: Hızlı Seçim Listesi */}
                  <div style={{ background: '#f8faf9', padding: '14px', borderRadius: '12px', border: '1px solid #dbe7df' }}>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#0a1f11', marginBottom: '8px' }}>
                      Hızlı Ürün Seçimi:
                    </p>
                    <div className="wh-modal-list" style={{ maxHeight: '250px' }}>
                      {items.slice(0, 7).map((item) => (
                        <button
                          key={item.id}
                          className="wh-modal-list-item"
                          onClick={() => setSelectedItem(item)}
                        >
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.name}</div>
                            <small style={{ color: '#64748b', fontFamily: 'monospace' }}>{item.barcode}</small>
                          </div>
                          <span className="wh-modal-list-stock" style={{ fontWeight: '700', color: '#10b981' }}>
                            {item.stock} {item.unit}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="wh-modal-body">
                <div className="wh-modal-selected">
                  <span className="wh-modal-selected-name">{selectedItem.name}</span>
                  <span className="wh-modal-selected-stock">
                    Mevcut: {selectedItem.stock} {selectedItem.unit}
                  </span>
                </div>
                <div className="wh-modal-field">
                  <label>Gelen Miktar ({selectedItem.unit})</label>
                  <input
                    type="number"
                    className="wh-modal-input"
                    placeholder={`Örn: 25`}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="0"
                    step="0.1"
                    autoFocus
                  />
                </div>
                <button
                  className="wh-modal-submit wh-modal-submit--primary"
                  onClick={handleReceive}
                  disabled={!quantity || quantity <= 0}
                >
                  <FiCheck /> Stoğa Ekle
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zayiat Modal */}
      {showWasteModal && (
        <div className="wh-modal-overlay" onClick={() => setShowWasteModal(false)}>
          <div className="wh-modal animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header wh-modal-header--danger">
              <h3>⚠️ Zayiat Bildirimi</h3>
              <button className="wh-modal-close" onClick={() => setShowWasteModal(false)}>
                <FiX />
              </button>
            </div>

            <div className="wh-modal-body">
              {!selectedItem ? (
                <div>
                  <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="Ürün adı veya barkod ara..."
                          value={wasteSearchQuery}
                          onChange={(e) => setWasteSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px 8px 32px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '13px',
                            outline: 'none',
                            background: '#f8fafc',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiFilter style={{ color: '#ef4444' }} size={14} />
                        <select
                          value={wasteCategoryFilter}
                          onChange={(e) => setWasteCategoryFilter(e.target.value)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            fontWeight: '600',
                            outline: 'none',
                            background: '#f8fafc',
                            color: '#334155',
                            cursor: 'pointer'
                          }}
                        >
                          {warehouseCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat === 'all' ? 'Tüm Kategoriler' : cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
                      <p className="wh-modal-info" style={{ margin: 0 }}>Hasarlı / Zayiat ürünü seçiniz:</p>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                        {filteredWasteItems.length} ürün listelendi
                      </span>
                    </div>
                  </div>

                  <div className="wh-modal-list" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {filteredWasteItems.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '16px' }}>
                        Aramanızla eşleşen ürün bulunamadı.
                      </p>
                    ) : (
                      filteredWasteItems.map((item) => (
                        <button
                          key={item.id}
                          className="wh-modal-list-item"
                          onClick={() => {
                            setSelectedItem(item)
                            setWasteSearchQuery('')
                            setWasteCategoryFilter('all')
                          }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.name}</div>
                            <small style={{ color: '#64748b', fontSize: '11px' }}>{item.category}</small>
                          </div>
                          <span className="wh-modal-list-stock" style={{ fontWeight: '700', color: '#ef4444' }}>
                            {item.stock} {item.unit}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="wh-modal-selected wh-modal-selected--danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="wh-modal-selected-name">{selectedItem.name}</div>
                      <div className="wh-modal-selected-stock" style={{ color: '#ef4444', fontWeight: '700' }}>
                        Mevcut Stok: {selectedItem.stock} {selectedItem.unit}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItem(null)
                        setQuantity('')
                        setWasteReason('')
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Ürünü Değiştir
                    </button>
                  </div>

                  <div className="wh-modal-field">
                    <label>Zayi Miktar ({selectedItem.unit}) - <small style={{ color: '#64748b' }}>Maksimum: {selectedItem.stock} {selectedItem.unit}</small></label>
                    <input
                      type="number"
                      className="wh-modal-input"
                      placeholder={`Örn: 1`}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="0.001"
                      max={selectedItem.stock}
                      step="any"
                      autoFocus
                    />
                  </div>

                  <div className="wh-modal-field">
                    <label>Zayiat Nedeni</label>
                    <select
                      className="wh-modal-input"
                      value={wasteReason}
                      onChange={(e) => setWasteReason(e.target.value)}
                    >
                      <option value="">Neden seçiniz...</option>
                      <option value="Ezilme / Bozulma">Ezilme / Bozulma</option>
                      <option value="Son Kullanma Tarihi Geçmiş">Son Kullanma Tarihi Geçmiş</option>
                      <option value="Kırık / Ambalaj Hasarı">Kırık / Ambalaj Hasarı</option>
                      <option value="Donma / Çözülme Sorunu">Donma / Çözülme Sorunu</option>
                      <option value="Mutfak Hazırlık Firesi">Mutfak Hazırlık Firesi</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#475569',
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setShowWasteModal(false)
                        setSelectedItem(null)
                        setQuantity('')
                        setWasteReason('')
                      }}
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      className="wh-modal-submit wh-modal-submit--danger"
                      style={{ flex: 2, margin: 0 }}
                      onClick={handleWaste}
                      disabled={!quantity || parseFloat(quantity) <= 0 || !wasteReason}
                    >
                      <FiAlertTriangle /> Zayiat Kaydet
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Yeni Ürün / Hammadde Ekleme Modal */}
      {showNewItemModal && (
        <div className="wh-modal-overlay" onClick={() => setShowNewItemModal(false)}>
          <div className="wh-modal animate-fade-in-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="wh-modal-header" style={{ background: '#ecfdf5' }}>
              <h3 style={{ color: '#065f46' }}>➕ Depoya Yeni Ürün / Hammadde Ekle</h3>
              <button className="wh-modal-close" onClick={() => setShowNewItemModal(false)}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleCreateNewItem} className="wh-modal-body" style={{ gap: '14px', padding: '20px' }}>
              <div className="wh-modal-field">
                <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Ürün Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Rebul Mandarine Kolonya 50ml, Çam Fıstığı..."
                  value={newItemForm.name}
                  onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                  className="wh-modal-input"
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="wh-modal-field">
                  <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Kategori</label>
                  <select
                    className="wh-modal-input"
                    value={newItemForm.category}
                    onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value })}
                  >
                    <option value="Kuru Gıda">Kuru Gıda</option>
                    <option value="Et & Tavuk">Et & Tavuk</option>
                    <option value="Sebze & Meyve">Sebze & Meyve</option>
                    <option value="Süt Ürünleri">Süt Ürünleri</option>
                    <option value="İçecek">İçecek</option>
                    <option value="Temizlik & Hijyen">Temizlik & Hijyen</option>
                    <option value="Genel">Genel</option>
                  </select>
                </div>

                <div className="wh-modal-field">
                  <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Birim</label>
                  <select
                    className="wh-modal-input"
                    value={newItemForm.unit}
                    onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                  >
                    <option value="adet">adet</option>
                    <option value="kg">kg</option>
                    <option value="lt">lt</option>
                    <option value="paket">paket</option>
                    <option value="koli">koli</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="wh-modal-field">
                  <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Başlangıç Stoğu</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={newItemForm.currentStock}
                    onChange={(e) => setNewItemForm({ ...newItemForm, currentStock: e.target.value })}
                    className="wh-modal-input"
                  />
                </div>

                <div className="wh-modal-field">
                  <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Kritik Min. Stok</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="5"
                    value={newItemForm.minStock}
                    onChange={(e) => setNewItemForm({ ...newItemForm, minStock: e.target.value })}
                    className="wh-modal-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="wh-modal-field">
                  <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Birim Maliyet (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newItemForm.unitCost}
                    onChange={(e) => setNewItemForm({ ...newItemForm, unitCost: e.target.value })}
                    className="wh-modal-input"
                  />
                </div>

                <div className="wh-modal-field">
                  <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Tedarikçi</label>
                  <input
                    type="text"
                    placeholder="Örn: Metro Grossmarket"
                    value={newItemForm.supplier}
                    onChange={(e) => setNewItemForm({ ...newItemForm, supplier: e.target.value })}
                    className="wh-modal-input"
                  />
                </div>
              </div>

              <div className="wh-modal-field">
                <label style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                  Barkod Numarası <small style={{ color: '#64748b', fontWeight: 'normal' }}>(Boş bırakılırsa otomatik üretilir)</small>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Örn: 8691226631707 veya 86940573..."
                    value={newItemForm.barcode}
                    onChange={(e) => setNewItemForm({ ...newItemForm, barcode: e.target.value })}
                    className="wh-modal-input"
                    style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '1px' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewItemModal(false)
                      setShowBarcodeModal(true)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 14px',
                      background: '#ecfdf5',
                      color: '#065f46',
                      border: '1px solid #a7f3d0',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title="Kamerayla Tara"
                  >
                    <FiCamera /> Kamera ile Oku
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowNewItemModal(false)}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="wh-modal-submit wh-modal-submit--primary"
                  style={{ flex: 2, margin: 0 }}
                >
                  <FiCheck /> Ürünü Depoya Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
