import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiAlertTriangle, FiArrowRight } from 'react-icons/fi'
import { useSalesStore, useInventoryStore, useRecipeStore, useAuthStore, hasPermission } from '../store'
import { useReportSummary } from '../hooks/useExpenseQuery'
import { useMenuPricing } from '../hooks/usePricingQuery'
import { TRANSLATIONS } from '../utils/translations'
import { Card, Stat, StatGrid, DataTable, Badge, Button, ErrorState, EmptyState } from '../components/ui'
import { money, pct, num, toNumber, SALES_PAYMENT } from '../utils/format'

const foodCostTone = (p) => (p >= 35 ? 'danger' : p >= 28 ? 'warning' : 'success')

/** Yönetici paneli: bugünün ve içinde bulunulan ayın gerçek KPI'ları */
export default function ManagerDashboard() {
  const navigate = useNavigate()
  const currentLanguage = useAuthStore((s) => s.currentLanguage) || 'tr'
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr
  const { summary: today, fetchSales, error: salesError } = useSalesStore()
  const { items, fetchItems } = useInventoryStore()
  const { recipes, fetchRecipes } = useRecipeStore()
  const month = useReportSummary(null)
  const pricing = useMenuPricing(30)

  useEffect(() => {
    fetchSales()
    fetchItems().then(fetchRecipes)
  }, [fetchSales, fetchItems, fetchRecipes])

  const critical = items.filter((i) => i.stock <= i.minStock).sort((a, b) => a.stock / (a.minStock || 1) - b.stock / (b.minStock || 1))
  const costlyRecipes = [...recipes].sort((a, b) => b.foodCostPercent - a.foodCostPercent).slice(0, 8)
  const m = month.data
  const pr = pricing.data

  // Öne çıkan reçete: menü mühendisliğinde "Yıldız" olanlardan en çok kazandıran; yoksa en kârlı satılan; yoksa en yüksek katkı payı
  const featured = useMemo(() => {
    const list = pr?.recipes || []
    const byMargin = (a, b) => toNumber(b.totalMargin) - toNumber(a.totalMargin)
    const stars = list.filter((r) => r.menuClass === 'STAR').sort(byMargin)
    if (stars.length) return { r: stars[0], badge: t.starRecipeBadge || 'Yıldız Reçete' }
    const sold = list.filter((r) => toNumber(r.quantitySold) > 0).sort(byMargin)
    if (sold.length) return { r: sold[0], badge: 'En Çok Kazandıran' }
    const best = list.filter((r) => toNumber(r.salePrice) > 0).sort((a, b) => toNumber(b.contributionMargin) - toNumber(a.contributionMargin))
    return best.length ? { r: best[0], badge: 'En Yüksek Katkı Payı' } : null
  }, [pr, t])
  const priceActions = toNumber(pr?.summary?.raiseCount) + toNumber(pr?.summary?.lossCount)
  const grossMargin = m && toNumber(m.netRevenue) > 0 ? 100 - toNumber(m.foodCostPercent) : null

  return (
    <div className="gs-page animate-fade-in">
      <section className="gs-hero" aria-label="Genel bakış">
        <div className="gs-hero-left">
          <span className="gs-hero-pill"><span className="gs-hero-dot" />{t.heroBadge || 'Restoran işletim & maliyet zekâsı'}</span>
          <h2 className="gs-hero-title">{t.heroTitle || 'Akıllı Reçete & Kârlılık Motoru'}</h2>
          <p className="gs-hero-desc">{t.heroDesc}</p>
          <div className="gs-hero-badges">
            <div className="gs-hero-badge"><strong>{grossMargin != null ? pct(grossMargin) : '—'}</strong><span>Bu ay brüt marj</span></div>
            <div className="gs-hero-badge"><strong>{m ? pct(m.foodCostPercent) : '—'}</strong><span>Food cost · hedef {m ? pct(m.targetFoodCostPercent) : '—'}</span></div>
            <div className="gs-hero-badge" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => navigate('/pricing')}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate('/pricing') }}>
              <strong>{pr ? priceActions : '—'}</strong><span>Fiyat aksiyonu</span>
            </div>
          </div>
        </div>
        <div className="gs-hero-card">
          <div className="gs-hero-img-wrap">
            <img src="/gourmet_salad_bowl.jpg" alt="Öne çıkan reçete" className="gs-hero-img" />
            <span className="gs-hero-img-badge">{featured?.badge || 'Menü'}</span>
          </div>
          {featured ? (
            <>
              <div className="gs-hero-card-title">
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{featured.r.name}</span>
                <span className="gs-hero-tier">Food cost {pct(featured.r.foodCostPercent)}</span>
              </div>
              <div className="gs-hero-pricing">
                <div><span>{t.costLabel || 'Maliyet'}</span><strong>{money(featured.r.portionCost)}</strong></div>
                <div><span>{t.saleLabel || 'Satış'}</span><strong>{money(featured.r.salePrice)}</strong></div>
                <div><span>Katkı payı</span><strong className="gs-hero-profit">+{money(featured.r.contributionMargin)}</strong></div>
              </div>
            </>
          ) : (
            <div className="gs-hero-card-title"><span>{pricing.isLoading ? 'Yükleniyor…' : 'Reçete ekleyince burada öne çıkan yemek görünür'}</span></div>
          )}
        </div>
      </section>

      {salesError && <ErrorState message={salesError} onRetry={fetchSales} />}
      <StatGrid>
        <Stat label="Bugünkü ciro (KDV dahil)" value={money(today.totalRevenue)} hint={`${today.orderCount || 0} adisyon · ${today.totalSalesCount || 0} satır`} tone="success" />
        <Stat label="Bugünkü food cost" value={pct(today.foodCostPercent)} hint={`SMM ${money(today.totalCost)}`} tone={foodCostTone(toNumber(today.foodCostPercent))} />
        <Stat label="Bugünkü brüt kâr" value={money(today.netProfit)} hint="Net satış − SMM" />
        <Stat label="Kritik stok" value={critical.length} hint="Minimum seviyede veya altında" tone={critical.length ? 'danger' : 'success'} />
      </StatGrid>

      {month.error ? <ErrorState message={month.error.message} onRetry={month.refetch} /> : (
        <Card title={`Bu Ay (${m?.period || '…'})`} extra={<Button size="sm" variant="ghost" onClick={() => navigate(hasPermission(useAuthStore.getState().user, 'EXPENSE_APPROVE') ? '/approvals' : '/accounting')}>Muhasebe <FiArrowRight /></Button>}>
          <StatGrid>
            <Stat label="Net satış" value={m ? money(m.netRevenue) : '…'} tone="success" />
            <Stat label="Food cost" value={m ? pct(m.foodCostPercent) : '…'} hint={m ? `Hedef ${pct(m.targetFoodCostPercent)}` : ''} tone={m ? foodCostTone(toNumber(m.foodCostPercent)) : 'neutral'} />
            <Stat label="Faaliyet giderleri" value={m ? money(m.operatingExpenses) : '…'} />
            <Stat label="Faaliyet kârı" value={m ? money(m.operatingProfit) : '…'} hint={m ? `Marj ${pct(m.profitMarginPercent)}` : ''} tone={m && toNumber(m.operatingProfit) < 0 ? 'danger' : 'success'} />
            <Stat label="Ödenmemiş borç" value={m ? money(m.unpaidPayables) : '…'} tone={m && toNumber(m.unpaidPayables) > 0 ? 'warning' : 'neutral'} />
            <Stat label="Onay bekleyen gider" value={m ? `${m.pendingApprovalCount} kayıt` : '…'} hint={m ? money(m.pendingApprovalAmount) : ''} tone={m?.pendingApprovalCount ? 'warning' : 'neutral'} />
            <Stat label="Envanter değeri" value={m ? money(m.inventoryValue) : '…'} hint="Ağırlıklı ortalama maliyet" />
            <Stat label="Fire / zayiat" value={m ? money(m.wasteCost) : '…'} tone={m && toNumber(m.wasteCost) > 0 ? 'warning' : 'neutral'} />
          </StatGrid>
        </Card>
      )}

      <div className="gs-grid-2">
        <Card title="Kritik Stoklar" extra={<Button size="sm" variant="ghost" onClick={() => navigate('/inventory')}>Stok <FiArrowRight /></Button>}>
          {critical.length === 0 ? <EmptyState title="Kritik seviyede ürün yok" /> : (
            <DataTable
              rows={critical.slice(0, 10)}
              columns={[
                { key: 'name', title: 'Ürün', render: (i) => <span className="gs-cell-title"><FiAlertTriangle color="#dc2626" /> {i.name}</span> },
                { key: 'stock', title: 'Stok', align: 'right', render: (i) => `${num(i.stock)} ${i.unit}` },
                { key: 'minStock', title: 'Minimum', align: 'right', render: (i) => `${num(i.minStock)} ${i.unit}` },
              ]}
            />
          )}
        </Card>

        <Card title="Bu Ayın En Çok Satanları">
          {!m?.topProducts?.length ? <EmptyState title="Bu ay satış yok" /> : (
            <DataTable
              rowKey="productName"
              rows={m.topProducts}
              columns={[
                { key: 'productName', title: 'Ürün' },
                { key: 'quantity', title: 'Adet', align: 'right' },
                { key: 'revenue', title: 'Ciro', align: 'right', render: (p) => money(p.revenue) },
                { key: 'cost', title: 'SMM', align: 'right', render: (p) => money(p.cost) },
              ]}
            />
          )}
          {m?.revenueByPaymentMethod && Object.keys(m.revenueByPaymentMethod).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {Object.entries(m.revenueByPaymentMethod).map(([k, v]) => <Badge key={k} tone="neutral">{SALES_PAYMENT[k] || k}: {money(v)}</Badge>)}
            </div>
          )}
        </Card>
      </div>

      {pr?.alerts?.length > 0 && (
        <Card title="Maliyet & Fiyat Uyarıları" extra={<Button size="sm" variant="ghost" onClick={() => navigate('/pricing')}>Menü & Maliyet <FiArrowRight /></Button>}>
          <ul className="gs-alert-list">
            {pr.alerts.slice(0, 5).map((a, i) => (
              <li key={`${a.title}-${i}`} className={`gs-alert-item gs-alert-item--${(a.severity || 'INFO').toLowerCase()}`}>
                <FiAlertTriangle />
                <div style={{ minWidth: 0 }}>
                  <div className="gs-cell-title">{a.title}</div>
                  <div className="gs-cell-sub">{a.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Reçete Kârlılığı (food cost — KDV hariç fiyat üzerinden)" extra={<Button size="sm" variant="ghost" onClick={() => navigate('/recipes')}>Reçeteler <FiArrowRight /></Button>}>
        <DataTable
          rows={costlyRecipes}
          columns={[
            { key: 'name', title: 'Reçete', render: (r) => <span className="gs-cell-title">{r.name}</span> },
            { key: 'salePrice', title: 'Satış fiyatı', align: 'right', render: (r) => money(r.salePrice) },
            { key: 'cost', title: 'Porsiyon maliyeti', align: 'right', render: (r) => money(r.cost) },
            {
              key: 'foodCostPercent', title: 'Food cost', align: 'right',
              render: (r) => <Badge tone={foodCostTone(r.foodCostPercent)}>{pct(r.foodCostPercent)}{!r.costComplete ? ' *' : ''}</Badge>,
            },
          ]}
        />
        {costlyRecipes.some((r) => !r.costComplete) && <p className="gs-muted">* Bazı malzemeler stok kartıyla eşleşmiyor; maliyet eksik hesaplanmış olabilir.</p>}
      </Card>
    </div>
  )
}
