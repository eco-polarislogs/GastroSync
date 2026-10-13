import React, { useState } from 'react'
import { useInventoryStore } from '../store'
import { FiSearch, FiAlertCircle, FiArrowUp, FiArrowDown, FiFilter, FiDownload, FiFileText } from 'react-icons/fi'
import { notifySuccess } from '../utils/notify'
import { exportToExcel, exportToCSV } from '../utils/exportUtils'
import '../styles/pages.css'

export default function InventoryPage() {
  const { items } = useInventoryStore()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const handleExportExcel = () => {
    const exportData = filtered.map(i => ({
      'ID': i.id,
      'Ürün Adı': i.name,
      'Kategori': i.category,
      'Barkod': i.barcode,
      'Mevcut Stok': `${i.stock} ${i.unit}`,
      'Min. Stok': `${i.minStock} ${i.unit}`,
      'Birim Fiyat (TL)': i.price,
      'Toplam Değer (TL)': (i.stock * i.price),
      'Tedarikçi': i.supplier || '',
      'Durum': i.stock <= i.minStock ? 'Kritik' : 'Yeterli'
    }))
    const success = exportToExcel(exportData, 'GastroSync_Stok_Raporu', 'Stok Listesi')
    if (success) {
      notifySuccess('Stok listesi Excel (.xlsx) olarak oluşturuldu', 'Rapor Oluşturuldu')
    }
  }

  const handleExportCSV = () => {
    const exportData = filtered.map(i => ({
      'ID': i.id,
      'Ürün Adı': i.name,
      'Kategori': i.category,
      'Barkod': i.barcode,
      'Mevcut Stok': `${i.stock} ${i.unit}`,
      'Min. Stok': `${i.minStock} ${i.unit}`,
      'Birim Fiyat (TL)': i.price,
      'Toplam Değer (TL)': (i.stock * i.price),
      'Tedarikçi': i.supplier || '',
      'Durum': i.stock <= i.minStock ? 'Kritik' : 'Yeterli'
    }))
    const success = exportToCSV(exportData, 'GastroSync_Stok_Raporu')
    if (success) {
      notifySuccess('Stok listesi CSV (.csv) olarak oluşturuldu', 'Rapor Oluşturuldu')
    }
  }

  const categories = ['all', ...new Set(items.map((i) => i.category))]

  const filtered = items
    .filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.barcode.includes(search)
      const matchCat = categoryFilter === 'all' || item.category === categoryFilter
      return matchSearch && matchCat
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

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Stok Yönetimi</h2>
          <p className="page-subtitle">Tüm envanter kalemlerini görüntüleyin ve yönetin</p>
        </div>
        <div className="export-btn-group">
          <button 
            className="export-tile-btn export-tile-btn--excel" 
            onClick={handleExportExcel}
            title="Envanter listesini Excel tablosu olarak indir"
          >
            <FiDownload className="export-tile-icon" /> Excel (.xlsx) İndir
          </button>
          <button 
            className="export-tile-btn export-tile-btn--csv" 
            onClick={handleExportCSV}
            title="Envanter listesini CSV formatında indir"
          >
            <FiFileText className="export-tile-icon" /> CSV İndir
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
            placeholder="Ürün adı veya barkod ile arayın..."
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
                {cat === 'all' ? 'Tüm Kategoriler' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-value">{items.length}</span>
          <span className="mini-stat-label">Toplam Ürün</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value mini-stat-value--warning">
            {items.filter((i) => i.stock <= i.minStock).length}
          </span>
          <span className="mini-stat-label">Kritik Stok</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">
            {items.reduce((sum, i) => sum + i.stock * i.price, 0).toLocaleString('tr-TR')} ₺
          </span>
          <span className="mini-stat-label">Toplam Stok Değeri</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-wrapper">
          <table className="data-table-main">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')} className="th-sortable">
                  Ürün Adı <SortIcon field="name" />
                </th>
                <th>Kategori</th>
                <th>Barkod</th>
                <th onClick={() => toggleSort('stock')} className="th-sortable">
                  Stok <SortIcon field="stock" />
                </th>
                <th>Min. Stok</th>
                <th onClick={() => toggleSort('price')} className="th-sortable">
                  Birim Fiyat <SortIcon field="price" />
                </th>
                <th>Toplam Değer</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className={item.stock <= item.minStock ? 'row-warning' : ''}>
                  <td className="td-bold">{item.name}</td>
                  <td>
                    <span className="category-badge">{item.category}</span>
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
                        <FiAlertCircle size={12} /> Kritik
                      </span>
                    ) : (
                      <span className="status-badge status-badge--tier">
                        <span className="tier-dot"></span> Tier A • Yeterli
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
