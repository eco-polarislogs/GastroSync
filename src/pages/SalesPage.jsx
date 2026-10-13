import React, { useState } from 'react'
import { useSalesStore } from '../store'
import { FiTrendingUp, FiClock, FiDollarSign, FiDownload, FiFileText, FiSearch, FiFilter } from 'react-icons/fi'
import { notifySuccess } from '../utils/notify'
import { exportToExcel, exportToCSV } from '../utils/exportUtils'
import '../styles/pages.css'

export default function SalesPage() {
  const { todaySales, summary } = useSalesStore()
  const [activeTab, setActiveTab] = useState('product') // 'product' veya 'timeline'
  const [searchQuery, setSearchQuery] = useState('')
  const [profitFilter, setProfitFilter] = useState('all') // 'all', 'high_profit', 'high_cost'

  // Satışı gruplama (recipe bazında)
  const salesByRecipe = todaySales.reduce((acc, sale) => {
    if (!acc[sale.recipeName]) {
      acc[sale.recipeName] = { quantity: 0, revenue: 0, cost: 0 }
    }
    acc[sale.recipeName].quantity += sale.quantity
    acc[sale.recipeName].revenue += sale.totalRevenue
    acc[sale.recipeName].cost += sale.totalCost
    return acc
  }, {})

  const sortedSalesByRevenue = Object.entries(salesByRecipe)
    .filter(([name, data]) => {
      const matchSearch = name.toLowerCase().includes(searchQuery.toLowerCase())
      const foodCost = (data.cost / data.revenue) * 100
      let matchFilter = true
      if (profitFilter === 'high_profit') matchFilter = foodCost < 30
      if (profitFilter === 'high_cost') matchFilter = foodCost >= 40
      return matchSearch && matchFilter
    })
    .sort(([, a], [, b]) => b.revenue - a.revenue)

  const filteredTimelineSales = todaySales.filter((sale) => {
    const matchSearch = sale.recipeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.time.includes(searchQuery)
    const foodCost = (sale.totalCost / sale.totalRevenue) * 100
    let matchFilter = true
    if (profitFilter === 'high_profit') matchFilter = foodCost < 30
    if (profitFilter === 'high_cost') matchFilter = foodCost >= 40
    return matchSearch && matchFilter
  })

  const handleExportSalesExcel = () => {
    const exportData = todaySales.map(s => ({
      'Saat': s.time,
      'Ürün': s.recipeName,
      'Adet': s.quantity,
      'Birim Satış (TL)': s.salePrice,
      'Toplam Gelir (TL)': s.totalRevenue,
      'Birim Maliyet (TL)': s.portionCost,
      'Toplam Maliyet (TL)': s.totalCost,
      'Brüt Kâr (TL)': s.totalRevenue - s.totalCost,
      'Food Cost %': ((s.totalCost / s.totalRevenue) * 100).toFixed(1) + '%'
    }))
    const success = exportToExcel(exportData, 'GastroSync_Satis_Raporu', 'Günlük Satışlar')
    if (success) notifySuccess('Satış raporu Excel (.xlsx) olarak oluşturuldu', 'Rapor Oluşturuldu')
  }

  const handleExportSalesCSV = () => {
    const exportData = todaySales.map(s => ({
      'Saat': s.time,
      'Ürün': s.recipeName,
      'Adet': s.quantity,
      'Birim Satış (TL)': s.salePrice,
      'Toplam Gelir (TL)': s.totalRevenue,
      'Birim Maliyet (TL)': s.portionCost,
      'Toplam Maliyet (TL)': s.totalCost,
      'Brüt Kâr (TL)': s.totalRevenue - s.totalCost,
      'Food Cost %': ((s.totalCost / s.totalRevenue) * 100).toFixed(1) + '%'
    }))
    const success = exportToCSV(exportData, 'GastroSync_Satis_Raporu')
    if (success) notifySuccess('Satış raporu CSV (.csv) olarak oluşturuldu', 'Rapor Oluşturuldu')
  }

  return (
    <div className="page-container">
      {/* Action Row */}
      <div className="page-header-row" style={{ justifyContent: 'flex-end', marginBottom: '-8px' }}>
        <div className="export-btn-group">
          <button
            className="export-tile-btn export-tile-btn--excel"
            onClick={handleExportSalesExcel}
            title="Günlük satış özetini Excel olarak indir"
          >
            <FiDownload className="export-tile-icon" /> Excel (.xlsx) İndir
          </button>
          <button
            className="export-tile-btn export-tile-btn--csv"
            onClick={handleExportSalesCSV}
            title="Günlük satış özetini CSV olarak indir"
          >
            <FiFileText className="export-tile-icon" /> CSV İndir
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-icon"><FiDollarSign /></span>
          <span className="mini-stat-value">{summary.totalRevenue.toLocaleString('tr-TR')} ₺</span>
          <span className="mini-stat-label">Toplam Ciro</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-icon"><FiTrendingUp /></span>
          <span className="mini-stat-value mini-stat-value--success">
            {summary.netProfit.toLocaleString('tr-TR')} ₺
          </span>
          <span className="mini-stat-label">Net Kâr</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-icon"><FiClock /></span>
          <span className="mini-stat-value">{todaySales.length}</span>
          <span className="mini-stat-label">Satış Kalemi</span>
        </div>
      </div>

      {/* Segmented View Switcher & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', background: '#eef6f0', padding: '6px', borderRadius: '12px', width: 'fit-content' }}>
          <button
            onClick={() => setActiveTab('product')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'product' ? '#ffffff' : 'transparent',
              color: activeTab === 'product' ? '#0a1f11' : '#64748b',
              boxShadow: activeTab === 'product' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            📊 Ürün Bazlı Satış Özeti
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'timeline' ? '#ffffff' : 'transparent',
              color: activeTab === 'timeline' ? '#0a1f11' : '#64748b',
              boxShadow: activeTab === 'timeline' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            ⏱️ Detaylı Zaman Kayıtları ({todaySales.length})
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
            placeholder={activeTab === 'product' ? 'Yemek adına göre arayın...' : 'Yemek adı veya saate göre arayın...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <FiFilter className="filter-icon" />
          <select
            className="filter-select"
            value={profitFilter}
            onChange={(e) => setProfitFilter(e.target.value)}
          >
            <option value="all">Tüm Satışlar</option>
            <option value="high_profit">Yüksek Kârlı (Food Cost &lt; %30)</option>
            <option value="high_cost">Yüksek Maliyet / Zarar Riski (Food Cost ≥ %40)</option>
          </select>
        </div>
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginLeft: 'auto' }}>
          <strong>{activeTab === 'product' ? sortedSalesByRevenue.length : filteredTimelineSales.length}</strong> kayıt listelendi
        </span>
      </div>

      {/* Sales by Product Tab */}
      {activeTab === 'product' && (
        <div className="table-card animate-fade-in">
          <div className="table-card-header">
            <h3>Ürün Bazlı Kârlılık ve Gelir Dağılımı</h3>
          </div>
          <div className="table-wrapper">
            <table className="data-table-main">
              <thead>
                <tr>
                  <th>Yemek</th>
                  <th>Toplam Porsiyon</th>
                  <th>Toplam Gelir</th>
                  <th>Toplam Maliyet</th>
                  <th>Kâr</th>
                  <th>Food Cost</th>
                </tr>
              </thead>
              <tbody>
                {sortedSalesByRevenue.map(([name, data]) => {
                  const profit = data.revenue - data.cost
                  const foodCost = (data.cost / data.revenue) * 100
                  return (
                    <tr key={name}>
                      <td className="td-bold">{name}</td>
                      <td>{data.quantity}</td>
                      <td>{data.revenue.toLocaleString('tr-TR')} ₺</td>
                      <td>{data.cost.toLocaleString('tr-TR')} ₺</td>
                      <td className="td-bold" style={{ color: profit > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {profit.toLocaleString('tr-TR')} ₺
                      </td>
                      <td>
                        <span className={`status-badge status-badge--${foodCost >= 40 ? 'danger' : foodCost >= 30 ? 'warning' : 'success'}`}>
                          %{foodCost.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Sales Log Tab */}
      {activeTab === 'timeline' && (
        <div className="table-card animate-fade-in">
          <div className="table-card-header">
            <h3>Detaylı Satış Kaydı (Zaman Dilimlerine Göre)</h3>
          </div>
          <div className="table-wrapper">
            <table className="data-table-main">
              <thead>
                <tr>
                  <th>Zaman Dilimi</th>
                  <th>Yemek</th>
                  <th>Porsiyon</th>
                  <th>Gelir</th>
                  <th>Maliyet</th>
                  <th>Kâr</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimelineSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <span className="time-badge">{sale.time}</span>
                    </td>
                    <td className="td-bold">{sale.recipeName}</td>
                    <td>{sale.quantity}</td>
                    <td>{sale.totalRevenue.toLocaleString('tr-TR')} ₺</td>
                    <td>{sale.totalCost.toLocaleString('tr-TR')} ₺</td>
                    <td className="td-bold" style={{ color: 'var(--color-success)' }}>
                      {(sale.totalRevenue - sale.totalCost).toLocaleString('tr-TR')} ₺
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
