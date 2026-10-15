import React, { useState } from 'react'
import { useInventoryStore, useAuthStore } from '../store'
import { FiSearch, FiAlertCircle, FiArrowUp, FiArrowDown, FiFilter, FiDownload, FiFileText } from 'react-icons/fi'
import { notifySuccess } from '../utils/notify'
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

  return (
    <div className="page-container">
      {/* Actions Row */}
      <div className="page-header-row" style={{ justifyContent: 'flex-end', marginBottom: '-8px' }}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
