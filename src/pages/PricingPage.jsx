import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiRefreshCw, FiSearch, FiTrendingUp, FiTrendingDown, FiAlertTriangle, FiTag } from 'react-icons/fi'
import { useAuthStore, hasPermission } from '../store'
import {
  PageHeader, Card, Stat, StatGrid, Tabs, DataTable, Badge, Button, Field, Modal, Notice, Loading, ErrorState, EmptyState,
  Pagination, usePaged, useSorted,
} from '../components/ui'
import { money, pct, num, toNumber } from '../utils/format'
import { useMenuPricing, useUpdateMenuPrice, MENU_CLASS, PRICE_ACTION } from '../hooks/usePricingQuery'

const PERIODS = [
  { days: 7, label: 'Son 7 gün' },
  { days: 30, label: 'Son 30 gün' },
  { days: 90, label: 'Son 90 gün' },
]

const SEVERITY_TONE = { CRITICAL: 'danger', WARNING: 'warning', INFO: 'info' }

/** Menü sınıfına ve fiyat aksiyonuna göre kısa öneri (Kasavana-Smith menü mühendisliği) */
function adviceFor(r) {
  if (r.priceAction === 'LOSS') {
    return `Fiyat; porsiyon maliyetini ve genel gider payını karşılamıyor. En az başabaş fiyatına (${money(r.breakEvenPrice)}) çıkarın veya reçeteyi yeniden maliyetlendirin.`
  }
  const base = {
    STAR: 'Çok satıyor ve kârlı. Kalitesini ve menüdeki yerini koruyun.',
    PLOWHORSE: 'Çok satıyor ama katkı payı düşük. Fiyatı kademeli artırın veya porsiyon maliyetini düşürün.',
    PUZZLE: 'Kârlı ama az satıyor. Menüde öne çıkarın, servis ekibine önerdirin.',
    DOG: 'Az satıyor ve katkı payı düşük. Menüden çıkarmayı veya yeniden tasarlamayı değerlendirin.',
    NO_DATA: 'Bu dönemde satış yok.',
  }[r.menuClass] || ''
  if (r.priceAction === 'RAISE') return `${base} Food cost hedefin üzerinde; önerilen fiyat ${money(r.suggestedPrice)}.`
  if (r.priceAction === 'WATCH') return `${base} Malzeme maliyeti dönemde ${pct(r.costChangePercent)} arttı; fiyatı izleyin.`
  return base
}

function ChangeBadge({ value, threshold }) {
  const v = toNumber(value)
  if (!v) return <span className="gs-muted">—</span>
  const tone = v >= threshold ? 'danger' : v > 0 ? 'warning' : v <= -threshold ? 'success' : 'neutral'
  return (
    <Badge tone={tone}>
      {v > 0 ? <FiTrendingUp /> : <FiTrendingDown />} {v > 0 ? '+' : ''}{v.toFixed(1)}%
    </Badge>
  )
}

/** Fiyat simülasyonu ve gerekçeli fiyat güncellemesi */
function PriceModal({ recipe, target, onClose }) {
  const [price, setPrice] = useState('')
  const [reason, setReason] = useState('')
  const updateM = useUpdateMenuPrice()
  useEffect(() => {
    if (recipe) {
      const approval = recipe.priceApproved === false
      setPrice(String(approval ? toNumber(recipe.salePrice) : toNumber(recipe.suggestedPrice) || toNumber(recipe.salePrice)))
      setReason(approval ? 'Yeni reçete menüye alındı' : recipe.priceAction === 'LOSS' ? 'Başabaş fiyatın altında' : 'Maliyet artışı / hedef food cost')
    }
  }, [recipe])
  if (!recipe) return null
  const gross = toNumber(price)
  const vat = toNumber(recipe.vatRate)
  const net = gross > 0 ? gross / (1 + vat / 100) : 0
  const cost = Math.max(toNumber(recipe.portionCost), toNumber(recipe.replacementCost))
  const fc = net > 0 ? (cost / net) * 100 : 0
  const cm = net - toNumber(recipe.portionCost)
  const diff = gross - toNumber(recipe.salePrice)
  const approval = recipe.priceApproved === false
  // Onay bekleyen yeni reçetede şefin önerdiği fiyat aynen onaylanabilir
  const valid = gross > 0 && (approval || Math.abs(diff) >= 0.01)
  return (
    <Modal
      open
      onClose={onClose}
      title={`${approval ? 'Fiyat Onayı' : 'Fiyat Simülasyonu'} · ${recipe.name}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button disabled={!valid} loading={updateM.isPending}
            onClick={() => updateM.mutate({ id: recipe.id, salePrice: gross, reason: reason.trim() }, { onSuccess: onClose })}>
            {approval ? `${money(gross)} ile onayla ve satışa aç` : `Fiyatı ${money(gross)} yap`}
          </Button>
        </>
      )}
    >
      <div className="gs-form">
        <dl className="gs-kv">
          <dt>Mevcut fiyat</dt><dd>{money(recipe.salePrice)} (KDV %{vat})</dd>
          <dt>Porsiyon maliyeti</dt><dd>{money(recipe.portionCost)} ortalama · {money(recipe.replacementCost)} son alış fiyatıyla</dd>
          <dt>Önerilen fiyat</dt><dd>{money(recipe.suggestedPrice)} (hedef food cost {pct(target)})</dd>
          {recipe.breakEvenPrice != null && <><dt>Başabaş fiyat</dt><dd>{money(recipe.breakEvenPrice)} (maliyet + genel gider payı)</dd></>}
        </dl>
        <div className="gs-form-row">
          <Field label="Yeni satış fiyatı (KDV dahil ₺)" required>
            <input className="gs-input" type="number" min="1" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Gerekçe">
            <input className="gs-input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </Field>
        </div>
        <StatGrid>
          <Stat label="Yeni food cost" value={pct(fc)} tone={fc > toNumber(target) + 2 ? 'warning' : 'success'} />
          <Stat label="Yeni katkı payı / porsiyon" value={money(cm)} tone={cm > 0 ? 'success' : 'danger'} />
          <Stat label="Fiyat farkı" value={`${diff >= 0 ? '+' : ''}${money(diff)}`} hint={toNumber(recipe.salePrice) ? `${((diff / toNumber(recipe.salePrice)) * 100).toFixed(1)}%` : ''} />
        </StatGrid>
        <Notice tone="info">Kasalardaki satış fiyatı sunucudan geldiği için değişiklik anında geçerli olur; mutfak ve muhasebe bilgilendirilir, denetim izine yazılır.</Notice>
      </div>
    </Modal>
  )
}

/**
 * Menü & Maliyet: gelir-gider oranına göre menü fiyatları, malzeme fiyat dalgalanmaları ve uyarılar.
 * Hesaplar sunucuda yapılır; şef gelir-gider (genel gider payı) bilgisini görmez.
 */
export default function PricingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [days, setDays] = useState(30)
  const [tab, setTab] = useState('menu')
  const [classFilter, setClassFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [priceTarget, setPriceTarget] = useState(null)
  const { data, isLoading, error, refetch, isFetching } = useMenuPricing(days)
  const canPrice = hasPermission(user, 'MENU_PRICE_SET')

  const s = data?.summary || {}
  const threshold = toNumber(s.alertThresholdPercent) || 8
  const q = search.trim().toLowerCase()

  const recipes = useMemo(() => (data?.recipes || [])
    .filter((r) => classFilter === 'ALL'
      || (classFilter === 'PENDING' ? r.priceApproved === false
        : classFilter === 'ACTION' ? ['LOSS', 'RAISE'].includes(r.priceAction) : r.menuClass === classFilter))
    .filter((r) => !q || `${r.name} ${r.category || ''}`.toLowerCase().includes(q)), [data, classFilter, q])
  const ingredients = useMemo(() => (data?.ingredients || [])
    .filter((i) => !onlyChanged || Math.abs(toNumber(i.periodChangePercent)) >= threshold || Math.abs(toNumber(i.changePercent)) >= threshold)
    .filter((i) => !q || `${i.name} ${i.supplier || ''} ${i.category || ''}`.toLowerCase().includes(q)), [data, onlyChanged, q, threshold])
  const recipeSort = useSorted(recipes, {
    name: (r) => r.name,
    sales: (r) => toNumber(r.quantitySold),
    cost: (r) => toNumber(r.portionCost),
    fc: (r) => toNumber(r.replacementFoodCostPercent),
    price: (r) => toNumber(r.salePrice),
  })
  const recipePage = usePaged(recipeSort.sorted, 12)
  const ingredientSort = useSorted(ingredients, {
    name: (i) => i.name,
    change: (i) => toNumber(i.changePercent),
    period: (i) => toNumber(i.periodChangePercent),
    cover: (i) => toNumber(i.daysOfCover),
  })
  const ingredientPage = usePaged(ingredientSort.sorted, 15)

  const counts = s.classCounts || {}
  const classChips = [
    { id: 'ALL', label: 'Tümü', count: data?.recipes?.length },
    { id: 'PENDING', label: 'Fiyat onayı bekleyen', count: (data?.recipes || []).filter((r) => r.priceApproved === false).length },
    { id: 'ACTION', label: 'Fiyat aksiyonu', count: toNumber(s.raiseCount) + toNumber(s.lossCount) },
    ...Object.entries(MENU_CLASS).map(([id, c]) => ({ id, label: c.label, count: counts[id] })),
  ]

  return (
    <div className="gs-page animate-fade-in">
      <PageHeader
        actions={(
          <>
            <select className="gs-select" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 150 }} aria-label="Analiz dönemi">
              {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
            </select>
            <Button variant="secondary" onClick={() => refetch()} loading={isFetching}><FiRefreshCw /> Yenile</Button>
          </>
        )}
      />

      {error ? <ErrorState message={error.message} onRetry={refetch} /> : isLoading ? <Loading /> : (
        <>
          <StatGrid>
            <Stat label="Hedef food cost" value={pct(s.targetFoodCostPercent)} hint={`Satışlardaki gerçekleşen: ${pct(s.salesFoodCostPercent)}`}
              tone={toNumber(s.salesFoodCostPercent) > toNumber(s.targetFoodCostPercent) ? 'warning' : 'success'} />
            <Stat label="Ortalama katkı payı / porsiyon" value={s.averageContributionMargin != null ? money(s.averageContributionMargin) : '—'}
              hint={`${num(s.portionsSold)} porsiyon satıldı`} />
            {data.financeView && (
              <Stat label="Genel gider payı / porsiyon" value={s.overheadPerPortion != null ? money(s.overheadPerPortion) : '—'}
                hint={`Faaliyet gideri ${money(s.operatingExpenses)} (KDV hariç)`} tone="info" />
            )}
            <Stat label="Fiyat aksiyonu gereken" value={toNumber(s.raiseCount) + toNumber(s.lossCount)}
              hint={`${toNumber(s.lossCount)} zarar · ${toNumber(s.raiseCount)} hedef üstü`} tone={toNumber(s.lossCount) ? 'danger' : toNumber(s.raiseCount) ? 'warning' : 'success'} />
            <Stat label="Fiyatı artan malzeme" value={toNumber(s.increasingIngredients)} hint={`Eşik %${threshold}`}
              tone={toNumber(s.increasingIngredients) ? 'warning' : 'success'} />
          </StatGrid>

          {!data.financeView && (
            <Notice tone="info">Reçete maliyetleri ve malzeme fiyatları gösterilir; gelir-gider ve genel gider payı yalnızca yönetim ve muhasebe tarafından görülür.</Notice>
          )}

          <Card title="Uyarılar" extra={<span className="gs-muted">{data.from} – {data.to}</span>}>
            {!data.alerts?.length ? <EmptyState title="Dikkat gerektiren maliyet veya fiyat hareketi yok" /> : (
              <ul className="gs-alert-list">
                {data.alerts.map((a, i) => (
                  <li key={`${a.title}-${i}`} className={`gs-alert-item gs-alert-item--${(a.severity || 'INFO').toLowerCase()}`}>
                    <FiAlertTriangle />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="gs-cell-title">{a.title}</div>
                      <div className="gs-cell-sub">{a.message}</div>
                    </div>
                    <Badge tone={SEVERITY_TONE[a.severity] || 'info'}>{a.severity === 'CRITICAL' ? 'Kritik' : a.severity === 'WARNING' ? 'Uyarı' : 'Bilgi'}</Badge>
                    {a.route === '/inventory' && <Button size="sm" variant="ghost" onClick={() => navigate('/inventory')}>Stok</Button>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padded={false}>
            <div style={{ padding: '0 12px' }}>
              <Tabs
                tabs={[
                  { id: 'menu', label: 'Menü Mühendisliği & Fiyat Önerisi', count: data.recipes?.length },
                  { id: 'ingredients', label: 'Malzeme Fiyat Dalgalanması', count: toNumber(s.increasingIngredients) },
                ]}
                active={tab}
                onChange={setTab}
              />
            </div>
            <div className="gs-card-body">
              <div className="gs-toolbar gs-listbar">
                <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
                  <FiSearch style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
                  <input className="gs-input" style={{ paddingLeft: 32 }} placeholder={tab === 'menu' ? 'Reçete veya kategori ara…' : 'Malzeme, tedarikçi ara…'}
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {tab === 'menu' ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {classChips.map((c) => (
                      <button key={c.id} type="button" className={`gs-chip ${classFilter === c.id ? 'gs-chip--active' : ''}`} onClick={() => setClassFilter(c.id)}>
                        {c.label}{c.count ? ` (${c.count})` : ''}
                      </button>
                    ))}
                  </div>
                ) : (
                  <label className="gs-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
                    Yalnızca eşik üstü değişenler
                  </label>
                )}
              </div>

              {tab === 'menu' ? (
                <>
                  <DataTable
                    rows={recipePage.items}
                    sort={recipeSort.sort}
                    onSortChange={recipeSort.setSort}
                    empty={<EmptyState title="Bu filtrede reçete yok" />}
                    columns={[
                      {
                        key: 'name', sortKey: 'name', title: 'Reçete',
                        render: (r) => (
                          <div style={{ maxWidth: 320 }}>
                            <div className="gs-cell-title">{r.name}{!r.costComplete ? ' *' : ''}</div>
                            {r.priceApproved === false && <Badge tone="warning">Fiyat onayı bekliyor · satışa kapalı</Badge>}
                            <div className="gs-cell-sub">{adviceFor(r)}</div>
                          </div>
                        ),
                      },
                      {
                        key: 'menuClass', title: 'Sınıf',
                        render: (r) => <Badge tone={MENU_CLASS[r.menuClass]?.tone} title={MENU_CLASS[r.menuClass]?.hint}>{MENU_CLASS[r.menuClass]?.label || r.menuClass}</Badge>,
                      },
                      {
                        key: 'sales', sortKey: 'sales', title: 'Satış', align: 'right',
                        render: (r) => <div className="gs-num">{num(r.quantitySold)} adet<div className="gs-cell-sub">pay {pct(r.popularityPercent)}</div></div>,
                      },
                      {
                        key: 'cost', sortKey: 'cost', title: 'Porsiyon maliyeti', align: 'right',
                        render: (r) => (
                          <div className="gs-num">
                            {money(r.portionCost)}
                            <div className="gs-cell-sub">son alış {money(r.replacementCost)} <ChangeBadge value={r.costChangePercent} threshold={threshold} /></div>
                          </div>
                        ),
                      },
                      {
                        key: 'fc', sortKey: 'fc', title: 'Food cost', align: 'right',
                        render: (r) => (
                          <div className="gs-num">
                            <Badge tone={toNumber(r.replacementFoodCostPercent) > toNumber(s.targetFoodCostPercent) + 2 ? 'warning' : 'success'}>{pct(r.replacementFoodCostPercent)}</Badge>
                            <div className="gs-cell-sub">katkı {money(r.contributionMargin)}</div>
                          </div>
                        ),
                      },
                      {
                        key: 'price', sortKey: 'price', title: 'Fiyat → Öneri', align: 'right',
                        render: (r) => (
                          <div className="gs-num">
                            <strong>{money(r.salePrice)}</strong>
                            <div className="gs-cell-sub">öneri {r.suggestedPrice != null ? money(r.suggestedPrice) : '—'}{r.breakEvenPrice != null ? ` · başabaş ${money(r.breakEvenPrice)}` : ''}</div>
                          </div>
                        ),
                      },
                      {
                        key: 'action', title: '', align: 'right',
                        render: (r) => (
                          <div className="gs-actions" style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Badge tone={PRICE_ACTION[r.priceAction]?.tone}>{PRICE_ACTION[r.priceAction]?.label || r.priceAction}</Badge>
                            {canPrice && (
                              <Button size="sm" variant={r.priceApproved === false || ['LOSS', 'RAISE'].includes(r.priceAction) ? 'primary' : 'ghost'} onClick={() => setPriceTarget(r)}>
                                <FiTag /> {r.priceApproved === false ? 'Fiyatı Onayla' : 'Fiyat'}
                              </Button>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                  <Pagination {...recipePage.pager} />
                  <p className="gs-muted" style={{ marginTop: 8 }}>
                    Sınıflama: satış payı ortalamanın %70'i üzerindeyse popüler, katkı payı (KDV hariç fiyat − porsiyon maliyeti) satış ağırlıklı ortalamanın üzerindeyse kârlı sayılır.
                    Önerilen fiyat, ortalama maliyet ile son alış fiyatından yüksek olanı üzerinden hedef food cost oranına göre hesaplanır ve 5 ₺'ye yuvarlanır. * Eşleşmeyen malzeme var.
                  </p>
                </>
              ) : (
                <>
                  <DataTable
                    rows={ingredientPage.items}
                    sort={ingredientSort.sort}
                    onSortChange={ingredientSort.setSort}
                    empty={<EmptyState title="Bu filtrede malzeme yok" />}
                    columns={[
                      { key: 'name', sortKey: 'name', title: 'Malzeme', render: (i) => <div><div className="gs-cell-title">{i.name}</div><div className="gs-cell-sub">{i.supplier || '-'} · {i.usedInRecipes} reçete</div></div> },
                      { key: 'avg', title: 'Ortalama maliyet', align: 'right', render: (i) => `${money(i.averageCost)}/${i.unit}` },
                      {
                        key: 'last', sortKey: 'change', title: 'Son alış', align: 'right',
                        render: (i) => (
                          <div className="gs-num">
                            {i.lastPurchaseCost != null ? money(i.lastPurchaseCost) : '—'}
                            <div className="gs-cell-sub">önceki {i.previousPurchaseCost != null ? money(i.previousPurchaseCost) : '—'} <ChangeBadge value={i.changePercent} threshold={threshold} /></div>
                          </div>
                        ),
                      },
                      {
                        key: 'period', sortKey: 'period', title: 'Dönem değişimi', align: 'right',
                        render: (i) => (
                          <div className="gs-num">
                            <ChangeBadge value={i.periodChangePercent} threshold={threshold} />
                            <div className="gs-cell-sub">{i.minCost != null ? `${money(i.minCost)} – ${money(i.maxCost)}` : 'alış yok'}</div>
                          </div>
                        ),
                      },
                      {
                        key: 'cover', title: 'Stok yeterliliği', align: 'right',
                        render: (i) => (
                          <div className="gs-num">
                            {i.daysOfCover != null
                              ? <Badge tone={toNumber(i.daysOfCover) < 3 ? 'danger' : toNumber(i.daysOfCover) < 7 ? 'warning' : 'success'}>{num(i.daysOfCover)} gün</Badge>
                              : <span className="gs-muted">tüketim yok</span>}
                            <div className="gs-cell-sub">{num(i.currentStock)} {i.unit} · günlük {num(i.avgDailyUsage)}{i.critical ? ' · kritik' : ''}</div>
                          </div>
                        ),
                      },
                    ]}
                  />
                  <Pagination {...ingredientPage.pager} />
                </>
              )}
            </div>
          </Card>
        </>
      )}

      <PriceModal recipe={priceTarget} target={s.targetFoodCostPercent} onClose={() => setPriceTarget(null)} />
    </div>
  )
}
