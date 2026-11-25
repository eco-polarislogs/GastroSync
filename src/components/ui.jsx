import React, { useEffect } from 'react'
import { FiX, FiAlertTriangle, FiRefreshCw, FiInbox, FiChevronUp, FiChevronDown } from 'react-icons/fi'

/** Sade, tekrar kullanılabilir arayüz parçaları (stiller: styles/app.css) */

/**
 * Sayfa işlem satırı. Sayfa adı üst çubukta tek başlık olarak gösterilir;
 * burada yalnızca filtre / dışa aktarım / ekleme düğmeleri yer alır.
 */
export function PageHeader({ actions }) {
  if (!actions) return null
  return (
    <div className="gs-page-header">
      <div className="gs-page-actions">{actions}</div>
    </div>
  )
}

export function Card({ title, extra, children, className = '', padded = true }) {
  return (
    <section className={`gs-card ${className}`}>
      {(title || extra) && (
        <header className="gs-card-header">
          {title && <h3 className="gs-card-title">{title}</h3>}
          {extra && <div className="gs-card-extra">{extra}</div>}
        </header>
      )}
      <div className={padded ? 'gs-card-body' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone = 'neutral', icon }) {
  return (
    <div className={`gs-stat gs-stat--${tone}`}>
      <div className="gs-stat-top">
        <span className="gs-stat-label">{label}</span>
        {icon && <span className="gs-stat-icon">{icon}</span>}
      </div>
      <div className="gs-stat-value">{value}</div>
      {hint && <div className="gs-stat-hint">{hint}</div>}
    </div>
  )
}

export function StatGrid({ children }) {
  return <div className="gs-stat-grid">{children}</div>
}

export function Badge({ tone = 'neutral', children, title }) {
  return <span className={`gs-badge gs-badge--${tone}`} title={title}>{children}</span>
}

export function Button({ variant = 'primary', size, children, loading, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`gs-btn gs-btn--${variant} ${size ? `gs-btn--${size}` : ''} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <FiRefreshCw className="gs-spin" />}
      {children}
    </button>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="gs-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`gs-tab ${active === t.id ? 'gs-tab--active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count != null && t.count > 0 && <span className="gs-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, title, onClose, children, footer, width = 560 }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="gs-modal-overlay" onMouseDown={onClose}>
      <div className="gs-modal" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="gs-modal-header">
          <h3>{title}</h3>
          <button type="button" className="gs-icon-btn" onClick={onClose} aria-label="Kapat"><FiX /></button>
        </header>
        <div className="gs-modal-body">{children}</div>
        {footer && <footer className="gs-modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, required }) {
  return (
    <label className="gs-field">
      <span className="gs-field-label">{label}{required && <span className="gs-required"> *</span>}</span>
      {children}
      {hint && <span className="gs-field-hint">{hint}</span>}
    </label>
  )
}

export function EmptyState({ title = 'Kayıt yok', description }) {
  return (
    <div className="gs-empty">
      <FiInbox size={28} />
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="gs-error">
      <FiAlertTriangle size={20} />
      <div>
        <strong>Veri alınamadı</strong>
        <span>{message}</span>
      </div>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}><FiRefreshCw /> Tekrar dene</Button>}
    </div>
  )
}

export function Loading({ label = 'Yükleniyor…' }) {
  return <div className="gs-loading"><FiRefreshCw className="gs-spin" /> {label}</div>
}

export function Notice({ tone = 'info', children }) {
  return <div className={`gs-notice gs-notice--${tone}`}>{children}</div>
}

/**
 * Tablo. Sütunda `sortKey` varsa başlık tıklanabilir olur; `sort` ({ key, dir }) ve `onSortChange`
 * ile sunucu veya istemci (useSorted) sıralamasına bağlanır.
 */
export function DataTable({ columns, rows, rowKey = 'id', empty, onRowClick, rowClassName, sort, onSortChange }) {
  if (!rows || rows.length === 0) return empty || <EmptyState />
  const toggle = (key) => {
    if (!onSortChange) return
    const dir = sort?.key === key && sort.dir === 'asc' ? 'desc' : sort?.key === key && sort.dir === 'desc' ? null : 'asc'
    onSortChange(dir ? { key, dir } : null)
  }
  return (
    <div className="gs-table-wrap">
      <table className="gs-table">
        <thead>
          <tr>
            {columns.map((c) => {
              const sortable = !!c.sortKey && !!onSortChange
              const active = sortable && sort?.key === c.sortKey
              return (
                <th
                  key={c.key}
                  style={{ textAlign: c.align || 'left', width: c.width }}
                  className={sortable ? 'gs-th-sortable' : undefined}
                  onClick={sortable ? () => toggle(c.sortKey) : undefined}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  title={sortable ? 'Sıralamak için tıklayın' : undefined}
                >
                  {c.title}
                  {sortable && (
                    <span className={`gs-sort-icon ${active ? 'gs-sort-icon--active' : ''}`}>
                      {active && sort.dir === 'desc' ? <FiChevronDown /> : <FiChevronUp />}
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={typeof rowKey === 'function' ? rowKey(r) : r[rowKey]}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`${onRowClick ? 'gs-row-clickable' : ''} ${rowClassName ? rowClassName(r) : ''}`}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || 'left' }}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Sayfalama çubuğu. page 0'dan başlar.
 * Sunucu sayfalaması için totalElements + onPageChange, istemci için usePaged() ile kullanılır.
 */
export function Pagination({ page, totalPages, totalElements, size, onPageChange, onSizeChange, sizes = [10, 20, 50] }) {
  if (!totalElements) return null
  const from = page * size + 1
  const to = Math.min(totalElements, (page + 1) * size)
  const pages = []
  const start = Math.max(0, Math.min(page - 2, totalPages - 5))
  for (let i = start; i < Math.min(totalPages, start + 5); i += 1) pages.push(i)
  return (
    <div className="gs-pagination">
      <span className="gs-muted">{from}–{to} / {totalElements} kayıt</span>
      <div className="gs-pagination-pages">
        <button type="button" className="gs-page-btn" disabled={page <= 0} onClick={() => onPageChange(0)} aria-label="İlk sayfa">«</button>
        <button type="button" className="gs-page-btn" disabled={page <= 0} onClick={() => onPageChange(page - 1)} aria-label="Önceki sayfa">‹</button>
        {pages.map((p) => (
          <button key={p} type="button" className={`gs-page-btn ${p === page ? 'gs-page-btn--active' : ''}`} onClick={() => onPageChange(p)}>{p + 1}</button>
        ))}
        <button type="button" className="gs-page-btn" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} aria-label="Sonraki sayfa">›</button>
        <button type="button" className="gs-page-btn" disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)} aria-label="Son sayfa">»</button>
      </div>
      {onSizeChange && (
        <select className="gs-select gs-page-size" value={size} onChange={(e) => onSizeChange(Number(e.target.value))} aria-label="Sayfa boyutu">
          {sizes.map((s) => <option key={s} value={s}>{s} / sayfa</option>)}
        </select>
      )}
    </div>
  )
}

/** İstemci tarafı sayfalama: liste veya filtre değişince ilk sayfaya döner */
export function usePaged(list, initialSize = 20) {
  const [page, setPage] = React.useState(0)
  const [size, setSize] = React.useState(initialSize)
  const total = list ? list.length : 0
  const totalPages = Math.max(1, Math.ceil(total / size))
  React.useEffect(() => { setPage(0) }, [total, size])
  const safePage = Math.min(page, totalPages - 1)
  const items = (list || []).slice(safePage * size, safePage * size + size)
  return {
    items,
    pager: { page: safePage, totalPages, totalElements: total, size, onPageChange: setPage, onSizeChange: setSize },
  }
}

/**
 * İstemci tarafı sıralama. accessors: { sortKey: (row) => değer }. Türkçe harf sırasına uyar.
 * Kullanım: const { sorted, sort, setSort } = useSorted(list, { name: (r) => r.name }, { key: 'name', dir: 'asc' })
 */
const trCollator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true })
export function useSorted(list, accessors, initial = null) {
  const [sort, setSort] = React.useState(initial)
  const sorted = React.useMemo(() => {
    const arr = Array.isArray(list) ? [...list] : []
    if (!sort || !accessors[sort.key]) return arr
    const get = accessors[sort.key]
    const factor = sort.dir === 'desc' ? -1 : 1
    return arr.sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
      return trCollator.compare(String(va), String(vb)) * factor
    })
  }, [list, sort, accessors])
  return { sorted, sort, setSort }
}

/** Sunucu sıralama parametresi: { key, dir } → "key,dir" */
export const sortParam = (sort) => (sort ? `${sort.key},${sort.dir}` : undefined)

/** Sunucu tarafı sayfa yanıtını (PageResponse) Pagination çubuğuna bağlar */
export function serverPager(data, onPageChange, onSizeChange) {
  return {
    page: data?.page || 0,
    totalPages: Math.max(1, data?.totalPages || 1),
    totalElements: data?.totalElements || 0,
    size: data?.size || 20,
    onPageChange,
    onSizeChange,
  }
}
