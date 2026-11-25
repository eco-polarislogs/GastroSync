import React, { useEffect, useState } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { FiDownload, FiMinus, FiPlus, FiShoppingCart, FiTrash2, FiXCircle } from 'react-icons/fi'
import { useAuthStore, useRecipeStore, useInventoryStore, useSalesStore, mapSale, hasPermission } from '../store'
import { salesApi } from '../api'
import {
  PageHeader, Card, Stat, StatGrid, Tabs, DataTable, Badge, Button, Field, Modal, Notice, Loading, ErrorState, EmptyState,
  Pagination, usePaged, serverPager, sortParam, useSorted,
} from '../components/ui'
import { money, pct, todayIso, toNumber, SALES_PAYMENT } from '../utils/format'
import { exportToExcel, exportToCSV } from '../utils/exportUtils'
import { notifySuccess, notifyError } from '../utils/notify'


/** POS satış girişi: fiyat, KDV ve maliyet sunucuda reçeteden hesaplanır */
function PosPanel() {
  const { recipes, fetchRecipes } = useRecipeStore()
  const { fetchItems } = useInventoryStore()
  const createOrder = useSalesStore((s) => s.createOrder)
  const qc = useQueryClient()
  const [cart, setCart] = useState([])
  const [tableNo, setTableNo] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD')
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetchItems().then(fetchRecipes) }, [fetchItems, fetchRecipes])

  const add = (r) => setCart((c) => {
    const ex = c.find((x) => x.recipeId === r.id)
    return ex ? c.map((x) => (x.recipeId === r.id ? { ...x, quantity: x.quantity + 1 } : x))
      : [...c, { recipeId: r.id, name: r.name, price: r.salePrice, quantity: 1 }]
  })
  const change = (id, delta) => setCart((c) => c.map((x) => (x.recipeId === id ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x)))
  const remove = (id) => setCart((c) => c.filter((x) => x.recipeId !== id))
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)

  const submit = async () => {
    setBusy(true)
    try {
      const created = await createOrder({
        tableNo: tableNo.trim() || 'Genel',
        paymentMethod,
        items: cart.map((x) => ({ recipeId: x.recipeId, quantity: x.quantity })),
      })
      const sum = (created || []).reduce((s, x) => s + toNumber(x.totalPrice), 0)
      notifySuccess(`Sipariş ${created?.[0]?.orderNo || ''} kaydedildi: ${money(sum)}`, 'POS')
      setCart([])
      setTableNo('')
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    } catch (err) {
      notifyError(err.message, 'Satış yapılamadı')
    } finally {
      setBusy(false)
    }
  }

  const visible = recipes.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="gs-split">
      <Card title="Menü" extra={<input className="gs-input" placeholder="Ürün ara…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 200 }} />}>
        {visible.length === 0 ? <EmptyState title="Menüde ürün yok" description="Reçeteler ekranından menü ürünü tanımlayın." /> : (
          <div className="gs-pos-grid">
            {visible.map((r) => (
              <button key={r.id} type="button" className="gs-pos-item" onClick={() => add(r)}>
                <strong>{r.name}</strong>
                <span>{money(r.salePrice)} · KDV %{r.vatRate}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
      <Card title={<><FiShoppingCart /> Adisyon</>}>
        {cart.length === 0 ? <EmptyState title="Adisyon boş" description="Menüden ürün seçin" /> : (
          <div className="gs-form">
            {cart.map((x) => (
              <div key={x.recipeId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="gs-cell-title">{x.name}</div>
                  <div className="gs-cell-sub">{money(x.price)} × {x.quantity} = {money(x.price * x.quantity)}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => change(x.recipeId, -1)} aria-label="Azalt"><FiMinus /></Button>
                <strong className="gs-num">{x.quantity}</strong>
                <Button size="sm" variant="secondary" onClick={() => change(x.recipeId, 1)} aria-label="Artır"><FiPlus /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(x.recipeId)} aria-label="Kaldır"><FiTrash2 /></Button>
              </div>
            ))}
            <div className="gs-form-row">
              <Field label="Masa / Paket">
                <input className="gs-input" value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="Masa 4" maxLength={30} />
              </Field>
              <Field label="Ödeme">
                <select className="gs-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {Object.entries(SALES_PAYMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="gs-muted">Toplam (KDV dahil)</span>
              <strong style={{ fontSize: '1.3rem' }}>{money(total)}</strong>
            </div>
            <Button onClick={submit} loading={busy}>Siparişi Kaydet</Button>
            <p className="gs-muted">Hammadde reçeteden otomatik düşülür; stok yetersizse sipariş reddedilir.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

export default function SalesPage() {
  const user = useAuthStore((s) => s.user)
  // Satış girişi Kasiyerin Masalar & Kasa ekranındadır; burada yalnızca izleme ve (Müdür) gerekçeli iptal vardır
  const canPos = hasPermission(user, 'POS_OPERATE')
  const canVoid = hasPermission(user, 'SALES_VOID')
  const [sort, setSort] = useState(null)
  const [tab, setTab] = useState(canPos ? 'pos' : 'list')
  const [from, setFrom] = useState(todayIso())
  const [to, setTo] = useState(todayIso())
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidBusy, setVoidBusy] = useState(false)
  const voidSale = useSalesStore((s) => s.voidSale)
  const qc = useQueryClient()

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { setPage(0) }, [from, to, query, size, sort])

  // Hareketler sunucuda sayfalanır; özet ve ürün kırılımı tüm aralık için sunucuda hesaplanır
  const salesQ = useQuery({
    queryKey: ['sales', 'search', { from, to, query, page, size, sort }],
    queryFn: () => salesApi.search({ from, to, includeVoided: true, q: query || undefined, sort: sortParam(sort), page, size }),
    placeholderData: keepPreviousData,
    select: (d) => (d ? { ...d, content: (d.content || []).map(mapSale) } : d),
    enabled: tab !== 'pos',
  })
  const summaryQ = useQuery({
    queryKey: ['sales', 'range-summary', from, to],
    queryFn: () => salesApi.rangeSummary(from, to),
    enabled: tab !== 'pos',
  })
  const rows = salesQ.data?.content || []
  const sum = summaryQ.data
  const products = (sum?.products || []).map((p) => ({
    ...p, revenue: toNumber(p.revenue), cost: toNumber(p.cost), vat: toNumber(p.vat),
  }))
  const productSort = useSorted(products, {
    recipeName: (p) => p.recipeName, quantity: (p) => toNumber(p.quantity), revenue: (p) => p.revenue, cost: (p) => p.cost,
  }, { key: 'revenue', dir: 'desc' })
  const productPage = usePaged(productSort.sorted, 20)
  const foodCost = toNumber(sum?.foodCostPercent)

  // Dışa aktarım: aralığın tüm satırları istek anında çekilir (sayfadan bağımsız)
  const exportRows = async (kind) => {
    let list
    try {
      list = (await salesApi.range(from, to, true) || []).map(mapSale)
    } catch (err) {
      notifyError(err.message, 'Dışa aktarılamadı')
      return
    }
    const data = list.map((s) => ({
      Sipariş: s.orderNo, Tarih: s.soldAt ? new Date(s.soldAt).toLocaleString('tr-TR') : s.time, Ürün: s.recipeName,
      Adet: s.quantity, 'Birim Fiyat': s.salePrice, 'Tutar (KDV dahil)': s.totalRevenue, KDV: s.vatAmount,
      SMM: s.totalCost, Masa: s.tableNo, Ödeme: SALES_PAYMENT[s.paymentMethod] || s.paymentMethod,
      Durum: s.status === 'VOIDED' ? `İptal: ${s.voidReason || ''}` : 'Tamamlandı', Kasiyer: s.recordedBy || '',
    }))
    if (!data.length) {
      notifyError('Seçili aralıkta satış yok.', 'Dışa aktarım')
      return
    }
    const name = `GastroSync_Satislar_${from}_${to}`
    if (kind === 'csv') exportToCSV(data, name)
    else exportToExcel(data, name, 'Satislar')
  }

  const confirmVoid = async () => {
    setVoidBusy(true)
    try {
      await voidSale(voidTarget.id, voidReason.trim())
      notifySuccess('Satış iptal edildi; stok ters kayıtla iade edildi.')
      setVoidTarget(null)
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    } catch (err) {
      notifyError(err.message, 'İptal reddedildi')
    } finally {
      setVoidBusy(false)
    }
  }

  const tabs = [
    ...(canPos ? [{ id: 'pos', label: 'POS Satış Girişi' }] : []),
    { id: 'list', label: 'Satış Hareketleri', count: tab !== 'pos' ? salesQ.data?.totalElements : undefined },
    { id: 'products', label: 'Ürün Bazlı Özet' },
  ]

  return (
    <div className="gs-page animate-fade-in">
      <PageHeader
        title="Satış & POS"
        subtitle="Satış fiyatı, KDV ve maliyet reçeteden sunucuda hesaplanır. Satışlar silinmez; yetkili gerekçeli iptal yapar."
        actions={tab !== 'pos' && (
          <>
            <input className="gs-input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} aria-label="Başlangıç" />
            <input className="gs-input" type="date" value={to} min={from} max={todayIso()} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} aria-label="Bitiş" />
            <Button variant="secondary" onClick={() => exportRows('xlsx')}><FiDownload /> Excel</Button>
            <Button variant="secondary" onClick={() => exportRows('csv')}><FiDownload /> CSV</Button>
          </>
        )}
      />

      {tab !== 'pos' && (summaryQ.error ? <ErrorState message={summaryQ.error.message} onRetry={summaryQ.refetch} /> : (
        <StatGrid>
          <Stat label="Ciro (KDV dahil)" value={sum ? money(sum.revenue) : '…'} hint={sum ? `${sum.orderCount} adisyon` : ''} tone="success" />
          <Stat label="Net satış (KDV hariç)" value={sum ? money(sum.net) : '…'} hint={sum ? `KDV ${money(sum.vat)}` : ''} />
          <Stat label="Satılan malın maliyeti" value={sum ? money(sum.cost) : '…'} />
          <Stat label="Food cost" value={sum ? pct(foodCost) : '…'} tone={foodCost > 35 ? 'danger' : foodCost > 28 ? 'warning' : 'success'} />
          <Stat label="Brüt kâr" value={sum ? money(sum.grossProfit) : '…'} />
          <Stat label="İptal edilen satır" value={sum ? sum.voidedCount : '…'} tone={sum?.voidedCount ? 'warning' : 'neutral'} />
        </StatGrid>
      ))}

      <Card padded={false}>
        <div style={{ padding: '0 12px' }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
        <div className="gs-card-body">
          {tab === 'pos' && <PosPanel />}
          {tab === 'list' && (
            <>
              <div className="gs-toolbar gs-listbar">
                <input className="gs-input" placeholder="Ürün, sipariş no veya masa ara…" value={search}
                  onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
              </div>
              {salesQ.isLoading ? <Loading /> : salesQ.error ? <ErrorState message={salesQ.error.message} onRetry={salesQ.refetch} /> : (
                <>
                  <DataTable
                    rows={rows}
                    rowClassName={(s) => (s.status === 'VOIDED' ? 'gs-row-muted' : '')}
                    sort={sort}
                    onSortChange={setSort}
                    empty={<EmptyState title="Bu aralıkta satış yok" />}
                    columns={[
                      { key: 'time', sortKey: 'soldAt', title: 'Saat', render: (s) => <span className="gs-num">{s.soldAt ? new Date(s.soldAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : s.time}</span> },
                      { key: 'recipeName', sortKey: 'productName', title: 'Ürün', render: (s) => <div><div className="gs-cell-title">{s.recipeName}</div><div className="gs-cell-sub">{s.orderNo} · {s.tableNo}</div></div> },
                      { key: 'quantity', sortKey: 'quantity', title: 'Adet', align: 'right' },
                      { key: 'totalRevenue', sortKey: 'totalPrice', title: 'Tutar', align: 'right', render: (s) => money(s.totalRevenue) },
                      { key: 'totalCost', title: 'SMM', align: 'right', render: (s) => money(s.totalCost) },
                      { key: 'paymentMethod', sortKey: 'paymentMethod', title: 'Ödeme', render: (s) => SALES_PAYMENT[s.paymentMethod] || s.paymentMethod },
                      { key: 'status', sortKey: 'status', title: 'Durum', render: (s) => (s.status === 'VOIDED' ? <Badge tone="danger" title={s.voidReason}>İptal · {s.voidedBy}</Badge> : <Badge tone="success">Tamamlandı</Badge>) },
                      {
                        key: 'a', title: '', align: 'right',
                        render: (s) => canVoid && s.status !== 'VOIDED' && (
                          <Button size="sm" variant="danger" onClick={() => { setVoidTarget(s); setVoidReason('') }}><FiXCircle /> İptal</Button>
                        ),
                      },
                    ]}
                  />
                  <Pagination {...serverPager(salesQ.data, setPage, setSize)} />
                </>
              )}
            </>
          )}
          {tab === 'products' && (summaryQ.isLoading ? <Loading /> : (
            <>
              <DataTable
                rowKey="recipeName"
                rows={productPage.items}
                sort={productSort.sort}
                onSortChange={productSort.setSort}
                empty={<EmptyState title="Bu aralıkta satış yok" />}
                columns={[
                  { key: 'recipeName', sortKey: 'recipeName', title: 'Ürün', render: (p) => <span className="gs-cell-title">{p.recipeName}</span> },
                  { key: 'quantity', sortKey: 'quantity', title: 'Adet', align: 'right' },
                  { key: 'revenue', sortKey: 'revenue', title: 'Ciro', align: 'right', render: (p) => money(p.revenue) },
                  { key: 'cost', sortKey: 'cost', title: 'SMM', align: 'right', render: (p) => money(p.cost) },
                  {
                    key: 'fc', title: 'Food cost', align: 'right',
                    render: (p) => {
                      const net = p.revenue - p.vat
                      const v = net > 0 ? (p.cost / net) * 100 : 0
                      return <Badge tone={v > 35 ? 'danger' : v > 28 ? 'warning' : 'success'}>{pct(v)}</Badge>
                    },
                  },
                ]}
              />
              <Pagination {...productPage.pager} />
            </>
          ))}
        </div>
      </Card>

      <Modal
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title="Satış iptali"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setVoidTarget(null)}>Vazgeç</Button>
            <Button variant="danger" loading={voidBusy} disabled={voidReason.trim().length < 5} onClick={confirmVoid}>İptal Et</Button>
          </>
        )}
      >
        {voidTarget && (
          <div className="gs-form">
            <p><strong>{voidTarget.recipeName}</strong> × {voidTarget.quantity} · {money(voidTarget.totalRevenue)} · {voidTarget.orderNo}</p>
            <Notice tone="warning">İptal kaydı silinmez; hammadde stoğa ters kayıtla iade edilir, olay denetim izine yazılır ve muhasebeye bildirilir.</Notice>
            <Field label="İptal gerekçesi" required hint="En az 5 karakter">
              <input className="gs-input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
