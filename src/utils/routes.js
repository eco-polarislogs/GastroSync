/**
 * Ekran (menü) tanımları. Hangi rolün hangi ekranı göreceğine SUNUCU karar verir:
 * /api/auth/me yanıtındaki `screens` listesi (backend: security/Permissions.java).
 * İstemci kendi rol tablosunu tutmaz; burada yalnızca ekran kimliği ↔ adres eşlemesi vardır.
 */
export const SCREENS = {
  dashboard: { path: '/dashboard', label: 'Genel Bakış' },
  approvals: { path: '/approvals', label: 'Onaylar' },
  accounting: { path: '/accounting', label: 'Muhasebe' },
  'advisor-ledger': { path: '/advisor-ledger', label: 'Müşavir Defteri' },
  pos: { path: '/pos', label: 'Masalar & Kasa' },
  kitchen: { path: '/kitchen', label: 'Mutfak Ekranı' },
  sales: { path: '/sales', label: 'Satışlar' },
  inventory: { path: '/inventory', label: 'Stok' },
  recipes: { path: '/recipes', label: 'Reçeteler' },
  pricing: { path: '/pricing', label: 'Menü & Maliyet' },
  warehouse: { path: '/warehouse', label: 'Depo Terminali' },
  users: { path: '/users', label: 'Personel' },
  audit: { path: '/audit', label: 'Denetim İzi' },
}

const PATH_TO_SCREEN = Object.fromEntries(Object.entries(SCREENS).map(([id, s]) => [s.path, id]))

/** Eski bildirim bağlantıları (önceki sürümler) */
const LEGACY_PATHS = { '/cashier': '/accounting', '/accounting': '/accounting' }

export const screenOfPath = (path) => PATH_TO_SCREEN[LEGACY_PATHS[path] || path] || null

/** Kullanıcı bu adresi açabilir mi (sunucunun verdiği ekran listesine göre) */
export function canOpenPath(user, path) {
  const screen = screenOfPath(path)
  return !!screen && Array.isArray(user?.screens) && user.screens.includes(screen)
}

/**
 * Bildirim bağlantısını kullanıcının yetkili ekranına çevirir. Örn. kasa sayımı bildirimi
 * muhasebede "/accounting", müdürde "/approvals" olarak açılır.
 */
const EQUIVALENT = [
  ['/accounting', '/approvals', '/advisor-ledger', '/dashboard'],
  ['/pos', '/approvals', '/accounting'],
  ['/pricing', '/recipes'],
  ['/recipes', '/pricing', '/kitchen'],
  ['/warehouse', '/inventory'],
  ['/inventory', '/warehouse'],
]

export function resolveLink(user, path) {
  if (!path) return null
  const normalized = LEGACY_PATHS[path] || path
  if (canOpenPath(user, normalized)) return normalized
  const group = EQUIVALENT.find((g) => g[0] === normalized)
  return group ? group.slice(1).find((p) => canOpenPath(user, p)) || null : null
}

/** Rolün varsayılan açılış ekranı: sunucu listesindeki ilk ekran */
export function getDefaultRoute(user) {
  const first = Array.isArray(user?.screens) ? user.screens.find((s) => SCREENS[s]) : null
  return first ? SCREENS[first].path : '/login'
}
