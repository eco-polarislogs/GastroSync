import React, { useEffect } from 'react'
import { useSalesStore, useInventoryStore, useRecipeStore, useExpenseStore, useAuthStore } from '../store'
import { FiTrendingUp, FiTrendingDown, FiAlertTriangle, FiDollarSign, FiPackage, FiAlertCircle, FiLayers } from 'react-icons/fi'
import { TRANSLATIONS } from '../utils/translations'
import '../styles/dashboard.css'

export default function ManagerDashboard() {
  const currentLanguage = useAuthStore((s) => s.currentLanguage) || 'tr'
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr

  const { summary, todaySales, fetchSales } = useSalesStore()
  const { items, fetchItems } = useInventoryStore()
  const { recipes, fetchRecipes } = useRecipeStore()
  const { summary: expenseSummary, fetchExpenses } = useExpenseStore()

  useEffect(() => {
    if (fetchSales) fetchSales()
    if (fetchItems) fetchItems()
    if (fetchRecipes) fetchRecipes()
    if (fetchExpenses) fetchExpenses()
  }, [fetchSales, fetchItems, fetchRecipes, fetchExpenses])

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
    if (percent >= 40) return t.statusRisk
    if (percent >= 30) return t.statusBorderline
    return t.statusProfitable
  }

  return (
    <div className="dashboard">
      {/* Keyvo-Style Executive Culinary Hero Banner */}
      <div className="executive-hero animate-fade-in-up">
        <div className="executive-hero-left">
          <div className="executive-hero-pill">
            <span className="executive-hero-dot"></span>
            {t.heroBadge}
          </div>
          <h1 className="executive-hero-title">
            {t.heroTitle}
          </h1>
          <p className="executive-hero-desc">
            {t.heroDesc}
          </p>
          <div className="executive-hero-badges">
            <div className="hero-stat-badge">
              <span className="hero-stat-num">%68.4</span>
              <span className="hero-stat-label">{t.heroAvgGrossMargin}</span>
            </div>
            <div className="hero-stat-badge hero-stat-badge--green">
              <span className="hero-stat-num">Tier A</span>
              <span className="hero-stat-label">{t.heroEfficiencyScore}</span>
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
              <span className="hero-bowl-badge">{t.starRecipeBadge}</span>
            </div>
            <div className="hero-bowl-meta">
              <div className="hero-bowl-title-row">
                <span className="hero-bowl-name">{t.recipeSalmonBowl}</span>
                <span className="hero-bowl-tier">{t.tierACost}</span>
              </div>
              <div className="hero-bowl-pricing">
                <div>
                  <span className="hero-bowl-lbl">{t.costLabel}:</span>
                  <strong>62.80 ₺</strong>
                </div>
                <div>
                  <span className="hero-bowl-lbl">{t.saleLabel}:</span>
                  <strong>280.00 ₺</strong>
                </div>
                <div>
                  <span className="hero-bowl-lbl">{t.netProfitLabel}:</span>
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
            <span className="metric-label">{t.todaySalesRevenue}</span>
            <div className="metric-icon metric-icon--primary">
              <FiDollarSign />
            </div>
          </div>
          <div className="metric-value">{summary.totalRevenue.toLocaleString('tr-TR')} ₺</div>
          <div className="metric-change metric-change--up">
            <FiTrendingUp /> {t.moreThanYesterday}
          </div>
        </div>

        <div className="metric-card animate-fade-in-up stagger-2">
          <div className="metric-card-header">
            <span className="metric-label">{t.actualFoodCost}</span>
            <div className="metric-icon metric-icon--danger">
              <FiPackage />
            </div>
          </div>
          <div className="metric-value">{summary.totalCost.toLocaleString('tr-TR')} ₺</div>
          <div className="metric-sub">{t.autoDeductedStock}</div>
        </div>

        <div className="metric-card animate-fade-in-up stagger-3">
          <div className="metric-card-header">
            <span className="metric-label">{t.averageFoodCost}</span>
            <div className={`metric-icon metric-icon--${summary.foodCostPercent > summary.targetFoodCost ? 'warning' : 'success'}`}>
              <FiAlertTriangle />
            </div>
          </div>
          <div className={`metric-value metric-value--${summary.foodCostPercent > summary.targetFoodCost ? 'warning' : 'success'}`}>
            % {summary.foodCostPercent.toFixed(1)}
          </div>
          {summary.foodCostPercent > summary.targetFoodCost && (
            <div className="metric-change metric-change--down">
              <FiAlertTriangle /> {t.aboveTargetFoodCost.replace('{target}', summary.targetFoodCost)}
            </div>
          )}
        </div>

        <div className="metric-card animate-fade-in-up stagger-4">
          <div className="metric-card-header">
            <span className="metric-label">{t.generalOperatingExpenses}</span>
            <div className="metric-icon" style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>
              <FiLayers />
            </div>
          </div>
          <div className="metric-value">{((expenseSummary?.totalFixed || 138500) + (expenseSummary?.totalVariable || 82100)).toLocaleString('tr-TR')} ₺</div>
          <div className="metric-sub">{t.fixedPlusVariableCosts}</div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="dashboard-grid">
        {/* Kârlılığı En Düşük Reçeteler (Sadeleştirilmiş & Özet) */}
        <div className="dashboard-card animate-fade-in-up stagger-3">
          <div className="dashboard-card-header">
            <div>
              <h2 className="dashboard-card-title">{t.profitRiskTracking}</h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{t.top3CostItems}</span>
            </div>
            <span className="dashboard-card-badge dashboard-card-badge--danger">{t.priorityBadge}</span>
          </div>

          <div className="dashboard-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>{t.dishNameTh}</th>
                  <th>{t.costTh}</th>
                  <th>{t.saleTh}</th>
                  <th>{t.foodCostTh}</th>
                  <th>{t.statusTh}</th>
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
              <h2 className="dashboard-card-title">{t.warehouseInventoryStatus}</h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{t.autoThresholdControl}</span>
            </div>
            <span className="status-badge status-badge--tier">
              <span className="tier-dot"></span> {t.liveMonitoring}
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
              <h4 style={{ margin: '0 0 4px 0', color: '#0a1f11', fontWeight: '700' }}>{t.allStockLevelsSufficient}</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{t.noCriticalStock}</p>
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
                        {t.minTh}: {item.minStock} {item.unit} | {t.unitPriceTh}: {item.price.toFixed(2)} ₺
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
