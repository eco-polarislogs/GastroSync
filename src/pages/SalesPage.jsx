import React from 'react'
import { useSalesStore } from '../store'
import { FiTrendingUp, FiClock, FiDollarSign, FiDownload, FiFileText } from 'react-icons/fi'
import { notifySuccess } from '../utils/notify'
import { exportToExcel, exportToCSV } from '../utils/exportUtils'
import '../styles/pages.css'

export default function SalesPage() {
  const { todaySales, summary } = useSalesStore()
  const [activeTab, setActiveTab] = React.useState('product') // 'product' veya 'timeline'

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
    .sort(([, a], [, b]) => b.revenue - a.revenue)

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
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Satış Analizi</h2>
          <p className="page-subtitle">
            POS entegrasyonu ile otomatik oluşturulan günlük satış verileri
          </p>
        </div>
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

      {/* Segmented View Switcher (Keyvo Style Pill Tabs) */}
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
                {todaySales.map((sale) => (
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
