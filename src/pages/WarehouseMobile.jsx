import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useInventoryStore, ROLE_COLORS } from '../store'
import { FiCamera, FiAlertTriangle, FiSearch, FiLogOut, FiPackage, FiBarChart2, FiSettings, FiCheck, FiX, FiArrowLeft } from 'react-icons/fi'
import { notifySuccess } from '../utils/notify'
import Html5BarcodeScanner from '../components/Html5BarcodeScanner'
import '../styles/warehouse.css'

export default function WarehouseMobile({ isEmbedded = false }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { items, recentActions, addStock, reportWaste } = useInventoryStore()

  const [activeTab, setActiveTab] = useState('operations')
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [showWasteModal, setShowWasteModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [wasteReason, setWasteReason] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Barkod simülasyonu
  const handleBarcodeScanned = () => {
    setShowBarcodeModal(true)
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
          notifySuccess(data.message || `${selectedItem.name} stoğa işlendi (+${parsedQty} ${selectedItem.unit})`, 'Ürün Stoğa Eklendi')
        }
      } catch (err) {
        // Fallback to local store if backend unreachable
        notifySuccess(`${selectedItem.name} stoğa eklendi (+${parsedQty} ${selectedItem.unit})`, 'Ürün Stoğa Eklendi')
      }
      addStock(selectedItem.id, parsedQty)
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
        if (data.success) {
          toast.success(data.message || `Fire kaydedildi: ${selectedItem.name} (-${parsedQty} ${selectedItem.unit})`)
        } else {
          toast.error(data.message || 'Zayiat kaydı başarısız!')
        }
      } catch (err) {
        toast.success(`(Çevrimdışı Mod) Zayiat kaydedildi: ${selectedItem.name} (-${parsedQty} ${selectedItem.unit})`)
      }
      reportWaste(selectedItem.id, parsedQty, wasteReason)
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
                title="Yönetici Paneline Dön"
              >
                <FiArrowLeft /> Panele Dön
              </button>
            )}
            <div className="wh-header-brand">GastroSync Terminal</div>
          </div>
          <div className="wh-header-right">
            {user?.role === 'warehouse' && (
              <button className="wh-logout-btn" onClick={handleLogout} title="Çıkış">
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
            title="Finansal Özete Dön"
          >
            <FiArrowLeft /> Finansal Özete Dön
          </button>
          <span className="wh-embedded-title">Depo ve Mal Kabul Terminal Modülü</span>
        </div>
      )}

      {/* Content */}
      <div className="wh-content">
        {activeTab === 'operations' && (
          <>
            {/* Primary Action Buttons */}
            <div className="wh-actions">
              <button className="wh-action-btn wh-action-btn--primary" onClick={handleBarcodeScanned}>
                <div className="wh-action-icon">📷</div>
                <span className="wh-action-label">Barkod Okut</span>
                <span className="wh-action-sub">Mal Kabul</span>
              </button>
              <button className="wh-action-btn wh-action-btn--danger" onClick={() => setShowWasteModal(true)}>
                <div className="wh-action-icon">⚠️</div>
                <span className="wh-action-label">Zayiat Bildir</span>
                <span className="wh-action-sub">Fire Kaydı</span>
              </button>
            </div>

            {/* Search */}
            <div className="wh-search-card">
              <div className="wh-search-label">Manuel Ürün Arama (Barkodsuz)</div>
              <div className="wh-search-input-wrapper">
                <FiSearch className="wh-search-icon" />
                <input
                  type="text"
                  className="wh-search-input"
                  placeholder="Ürün adı veya barkod kodu girin..."
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
                          Stok: {item.stock} {item.unit} | Barkod: {item.barcode}
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
              <div className="wh-recent-header">Son İşlemler (Bugün)</div>
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
                        {action.type === 'waste' ? `Neden: ${action.reason}` : `Barkod: ${action.barcode || '—'}`}
                      </div>
                    </div>
                  </div>
                  <div className="wh-recent-right">
                    <div className={`wh-recent-qty ${action.type === 'waste' ? 'wh-recent-qty--danger' : ''}`}>
                      {action.type === 'waste' ? '-' : '+'} {action.quantity} {action.unit}
                    </div>
                    <div className={`wh-recent-type ${action.type === 'waste' ? 'wh-recent-type--danger' : 'wh-recent-type--success'}`}>
                      {action.type === 'waste' ? 'Zayiat Düşümü' : 'Mal Kabul'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'stock' && (
          <div className="wh-stock-list">
            <div className="wh-stock-header-row">
              <h2 className="wh-stock-title">Depo Durumu</h2>
              <span className="wh-stock-count">{items.length} ürün</span>
            </div>
            {items.map((item) => (
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
          <span>Stok İşlemleri</span>
        </button>
        <button
          className={`wh-nav-item ${activeTab === 'stock' ? 'wh-nav-item--active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          <FiBarChart2 />
          <span>Depo Durumu</span>
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

            {!selectedItem ? (
              <div className="wh-modal-body">
                <div className="wh-scanner-horizontal-grid">
                  {/* Sol Sütun: Yatay Kamera Kutusu */}
                  <div>
                    <p className="wh-modal-info" style={{ textAlign: 'left', marginBottom: '8px' }}>
                      📷 Canlı kamera taraması aktif (Yatay Barkod Algılama):
                    </p>
                    <Html5BarcodeScanner 
                      onScanSuccess={(barcodeText) => {
                        const found = items.find(i => i.barcode === barcodeText)
                        if (found) {
                          setSelectedItem(found)
                          notifySuccess(`Barkod algılandı: ${found.name}`, 'Barkod Okundu')
                        } else {
                          notifySuccess(`Barkod (${barcodeText}) sistemde bulunamadı!`, 'Barkod Bulunamadı')
                        }
                      }}
                      onClose={() => setShowBarcodeModal(false)}
                    />
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
                <div className="wh-modal-list">
                  <p className="wh-modal-info">Zayiat ürünü seçiniz:</p>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className="wh-modal-list-item"
                      onClick={() => setSelectedItem(item)}
                    >
                      <span>{item.name}</span>
                      <span className="wh-modal-list-stock">{item.stock} {item.unit}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="wh-modal-selected wh-modal-selected--danger">
                    <span className="wh-modal-selected-name">{selectedItem.name}</span>
                    <span className="wh-modal-selected-stock">
                      Mevcut: {selectedItem.stock} {selectedItem.unit}
                    </span>
                  </div>

                  <div className="wh-modal-field">
                    <label>Zayi Miktar ({selectedItem.unit})</label>
                    <input
                      type="number"
                      className="wh-modal-input"
                      placeholder={`Örn: 2.5`}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="0"
                      step="0.1"
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
                      <option value="Ezilme/Bozulma">Ezilme / Bozulma</option>
                      <option value="Son Kullanma Tarihi">Son Kullanma Tarihi Geçmiş</option>
                      <option value="Kırık/Hasar">Kırık / Hasar</option>
                      <option value="Donma/Çözülme">Donma / Çözülme Sorunu</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>

                  <button
                    className="wh-modal-submit wh-modal-submit--danger"
                    onClick={handleWaste}
                    disabled={!quantity || quantity <= 0 || !wasteReason}
                  >
                    <FiAlertTriangle /> Zayiat Kaydet
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
