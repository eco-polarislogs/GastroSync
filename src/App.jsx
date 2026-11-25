import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, ROLES } from './store'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import DashboardLayout from './components/DashboardLayout'
import ManagerDashboard from './pages/ManagerDashboard'
import InventoryPage from './pages/InventoryPage'
import RecipesPage from './pages/RecipesPage'
import SalesPage from './pages/SalesPage'
import WarehouseMobile from './pages/WarehouseMobile'
import UsersPage from './pages/UsersPage'
import AccountingPage from './pages/accounting/AccountingPage'
import AuditLogPage from './pages/AuditLogPage'
import PricingPage from './pages/PricingPage'
import PosPage from './pages/PosPage'
import KitchenPage from './pages/KitchenPage'
import UnauthorizedPage from './pages/UnauthorizedPage'
import { PrivacyPolicyPage, AccountDeletionPage } from './pages/LegalPages'
import { Loading } from './components/ui'
import { getDefaultRoute } from './utils/routes'

const { WAREHOUSE } = ROLES

/**
 * Ekran koruması: kullanıcının açabileceği ekranları sunucu belirler (user.screens).
 * Sunucu her uç noktada aynı kuralı ayrıca uygular.
 */
function ProtectedRoute({ screen, children, withLayout = true }) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!Array.isArray(user?.screens)) return <Loading label="Oturum doğrulanıyor…" />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  if (screen && !user.screens.includes(screen)) {
    // Yönetici rolü yeni değiştirdiyse bu bir ihlal değildir: yeni rolün ana ekranına geç
    if (Date.now() - useAuthStore.getState().roleChangedAt < 15000) {
      return <Navigate to={getDefaultRoute(user)} replace />
    }
    return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />
  }
  return withLayout ? <DashboardLayout>{children}</DashboardLayout> : children
}

function RoleRedirect() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!Array.isArray(user?.screens)) return <Loading label="Oturum doğrulanıyor…" />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  return <Navigate to={getDefaultRoute(user)} replace />
}

/** Depo personeli tam ekran terminal; diğer roller yan menülü görünüm */
function WarehouseRoute() {
  const { user } = useAuthStore()
  const fullScreen = user?.role === WAREHOUSE
  return (
    <ProtectedRoute screen="warehouse" withLayout={!fullScreen}>
      <WarehouseMobile isEmbedded={!fullScreen} />
    </ProtectedRoute>
  )
}

export default function App() {
  const currentLanguage = useAuthStore((s) => s.currentLanguage) || 'tr'
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const refreshSession = useAuthStore((s) => s.refreshSession)

  // Açılışta yerel kopyadaki rol yerine sunucudaki güncel rol, ekran ve izinleri kullan
  useEffect(() => {
    if (isAuthenticated) refreshSession()
  }, [isAuthenticated, refreshSession])

  useEffect(() => {
    document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = currentLanguage
  }, [currentLanguage])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      {/* Herkese açık yasal sayfalar (Google Play: gizlilik politikası ve hesap silme bağlantısı) */}
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/account-deletion" element={<AccountDeletionPage />} />
      <Route path="/" element={<RoleRedirect />} />

      <Route path="/dashboard" element={<ProtectedRoute screen="dashboard"><ManagerDashboard /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute screen="approvals"><AccountingPage viewMode="manager" /></ProtectedRoute>} />
      <Route path="/accounting" element={<ProtectedRoute screen="accounting"><AccountingPage viewMode="accounting" /></ProtectedRoute>} />
      <Route path="/advisor-ledger" element={<ProtectedRoute screen="advisor-ledger"><AccountingPage viewMode="advisor" /></ProtectedRoute>} />
      <Route path="/cashier" element={<Navigate to="/accounting" replace />} />
      <Route path="/pos" element={<ProtectedRoute screen="pos"><PosPage /></ProtectedRoute>} />
      <Route path="/kitchen" element={<ProtectedRoute screen="kitchen"><KitchenPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute screen="inventory"><InventoryPage /></ProtectedRoute>} />
      <Route path="/recipes" element={<ProtectedRoute screen="recipes"><RecipesPage /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute screen="sales"><SalesPage /></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute screen="pricing"><PricingPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute screen="users"><UsersPage /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute screen="audit"><AuditLogPage /></ProtectedRoute>} />
      <Route path="/warehouse" element={<WarehouseRoute />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
