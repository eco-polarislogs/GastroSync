import React from 'react'
import { useSalesStore, useInventoryStore, useRecipeStore } from '../store'
import { FiTrendingUp, FiTrendingDown, FiAlertTriangle, FiDollarSign, FiPackage, FiAlertCircle } from 'react-icons/fi'
import '../styles/dashboard.css'

export default function ManagerDashboard() {
  const { summary, todaySales } = useSalesStore()
  const { items } = useInventoryStore()
  const { recipes } = useRecipeStore()

  // Kritik stok uyarıları
  const lowStockItems = items.filter((item) => item.stock <= item.minStock)

  // Kârlılığı en düşük reçeteler
  const sortedRecipes = [...recipes].sort((a, b) => b.foodCostPercent - a.foodCostPercent)

  const getFoodCostClass = (percent) => {
    if (percent >= 40) return 'danger'
    if (percent >= 30) return 'warning'
    return 'success'
  }

  const getFoodCostLabel = (percent) => {
    if (percent >= 40) return 'Zarar Riski'
    if (percent >= 30) return 'Sınırda'
    return 'Kârlı'
  }

  // Satış verisini gruplama
  const salesByRecipe = todaySales.reduce((acc, sale) => {
    if (!acc[sale.recipeName]) {
      acc[sale.recipeName] = { quantity: 0, revenue: 0, cost: 0 }
    }
    acc[sale.recipeName].quantity += sale.quantity
    acc[sale.recipeName].revenue += sale.totalRevenue
    acc[sale.recipeName].cost += sale.totalCost
    return acc
  }, {})

  return (
    <div className="dashboard">
      {/* Keyvo-Style Executive Culinary Hero Banner */}
      <div className="executive-hero animate-fade-in-up">
        <div className="executive-hero-left">
          <div className="executive-hero-pill">
            <span className="executive-hero-dot"></span>
            Restoran İşletim & Maliyet Zekası
          </div>
          <h1 className="executive-hero-title">
            GastroSync Akıllı Reçete & Karlılık Motoru
          </h1>
          <p className="executive-hero-desc">
            Canlı POS satışları, anlık gramaj ve depocu mal kabul faturalarıyla tam senkronize. Otomatik food cost ve fire marjı takibiyle sıfır kayıp, maksimum kârlılık.
          </p>
          <div className="executive-hero-badges">
            <div className="hero-stat-badge">
              <span className="hero-stat-num">%68.4</span>
              <span className="hero-stat-label">Ort. Brüt Kâr Marjı</span>
            </div>
            <div className="hero-stat-badge hero-stat-badge--green">
              <span className="hero-stat-num">Tier A</span>
              <span className="hero-stat-label">Verimlilik Skoru: 97</span>
            </div>
          </div>
        </div>

        <div className="executive-hero-right">
          <div className="hero-bowl-card">
            <div className="hero-bowl-img-wrap">
              <img 
                src="/gourmet_salad_bowl.jpg" 
                alt="Gourmet Poke Bowl" 
                className="hero-bowl-img"
              />
              <span className="hero-bowl-badge">Günün Yıldız Reçetesi</span>
            </div>
            <div className="hero-bowl-meta">
              <div className="hero-bowl-title-row">
                <span className="hero-bowl-name">Somon & Kinoa Salata Kasesi</span>
                <span className="hero-bowl-tier">Tier A • %22.4 Cost</span>
              </div>
              <div className="hero-bowl-pricing">
                <div>
                  <span className="hero-bowl-lbl">Maliyet:</span>
                  <strong>62.80 ₺</strong>
                </div>
                <div>
                  <span className="hero-bowl-lbl">Satış:</span>
                  <strong>280.00 ₺</strong>
                </div>
                <div>
                  <span className="hero-bowl-lbl">Net Kâr:</span>
                  <span className="text-emerald font-bold">+217.20 ₺</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="dashboard-metrics">
        <div className="metric-card animate-fade-in-up stagger-1">
          <div className="metric-card-header">
            <span className="metric-label">Bugünkü Satış (Ciro)</span>
            <div className="metric-icon metric-icon--primary">
              <FiDollarSign />
            </div>
          </div>
          <div className="metric-value">{summary.totalRevenue.toLocaleString('tr-TR')} ₺</div>
          <div className="metric-change metric-change--up">
            <FiTrendingUp /> %12.5 dünden fazla
          </div>
        </div>

        <div className="metric-card animate-fade-in-up stagger-2">
          <div className="metric-card-header">
            <span className="metric-label">Gerçekleşen Gıda Maliyeti</span>
            <div className="metric-icon metric-icon--danger">
              <FiPackage />
            </div>
          </div>
          <div className="metric-value">{summary.totalCost.toLocaleString('tr-TR')} ₺</div>
          <div className="metric-sub">POS sisteminden otomatik düşülen stok</div>
        </div>

        <div className="metric-card animate-fade-in-up stagger-3">
          <div className="metric-card-header">
            <span className="metric-label">Ortalama Food Cost</span>
            <div className={`metric-icon metric-icon--${summary.foodCostPercent > summary.targetFoodCost ? 'warning' : 'success'}`}>
              <FiAlertTriangle />
            </div>
          </div>
          <div className={`metric-value metric-value--${summary.foodCostPercent > summary.targetFoodCost ? 'warning' : 'success'}`}>
            % {summary.foodCostPercent.toFixed(1)}
          </div>
          {summary.foodCostPercent > summary.targetFoodCost && (
            <div className="metric-change metric-change--down">
              <FiAlertTriangle /> Hedeflenen %{summary.targetFoodCost}'un üzerinde!
            </div>
          )}
        </div>

        <div className="metric-card animate-fade-in-up stagger-4">
          <div className="metric-card-header">
            <span className="metric-label">Zayiat Maliyeti</span>
            <div className="metric-icon metric-icon--danger">
              <FiTrendingDown />
            </div>
          </div>
          <div className="metric-value metric-value--danger">{summary.wasteAmount.toLocaleString('tr-TR')} ₺</div>
          <div className="metric-sub">Bugünkü fire ve zayiat toplam maliyeti</div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="dashboard-grid">
        {/* Kârlılığı En Düşük Reçeteler (Sadeleştirilmiş & Özet) */}
        <div className="dashboard-card animate-fade-in-up stagger-3">
          <div className="dashboard-card-header">
            <div>
              <h2 className="dashboard-card-title">Kârlılık & Risk Takibi</h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Yüksek maliyetli ilk 3 menü kalemi</span>
            </div>
            <span className="dashboard-card-badge dashboard-card-badge--danger">Öncelikli</span>
          </div>

          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Yemek Adı</th>
                  <th>Maliyet</th>
                  <th>Satış</th>
                  <th>Food Cost</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecipes.slice(0, 3).map((recipe) => (
                  <tr key={recipe.id} className={recipe.foodCostPercent >= 40 ? 'row--danger' : ''}>
                    <td className="td-bold">{recipe.name}</td>
                    <td>{recipe.cost.toFixed(2)} ₺</td>
                    <td>{recipe.salePrice.toFixed(2)} ₺</td>
                    <td className={`td-${getFoodCostClass(recipe.foodCostPercent)}`}>
                      % {recipe.foodCostPercent.toFixed(1)}
                    </td>
                    <td>
                      <span className={`status-badge status-badge--${getFoodCostClass(recipe.foodCostPercent)}`}>
                        {getFoodCostLabel(recipe.foodCostPercent)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kritik Stok & Sistem Durumu */}
        <div className="dashboard-card animate-fade-in-up stagger-4">
          <div className="dashboard-card-header">
            <div>
              <h2 className="dashboard-card-title">Depo & Envanter Durumu</h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Otomatik kritik eşik kontrolü</span>
            </div>
            <span className="status-badge status-badge--tier">
              <span className="tier-dot"></span> Canlı İzleme
            </span>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="dashboard-empty" style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                background: '#dcfce7', 
                color: '#10b981', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 12px auto',
                fontSize: '22px'
              }}>
                ✓
              </div>
              <h4 style={{ margin: '0 0 4px 0', color: '#0a1f11', fontWeight: '700' }}>Tüm Stok Seviyeleri Yeterli</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Kritik eşiğin altına düşen herhangi bir malzeme bulunmuyor.</p>
            </div>
          ) : (
            <div className="dashboard-alerts-list">
              {lowStockItems.slice(0, 3).map((item) => (
                <div key={item.id} className="alert-item">
                  <div className="alert-item-left">
                    <FiAlertCircle className="alert-item-icon" />
                    <div>
                      <div className="alert-item-name">{item.name}</div>
                      <div className="alert-item-detail">
                        Min: {item.minStock} {item.unit} | Birim: {item.price.toFixed(2)} ₺
                      </div>
                    </div>
                  </div>
                  <div className="alert-item-right">
                    <span className="alert-item-stock" style={{ color: '#ef4444', fontWeight: '700' }}>
                      {item.stock} {item.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
