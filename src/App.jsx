import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, ROLES } from './store'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/DashboardLayout'
import ManagerDashboard from './pages/ManagerDashboard'
import InventoryPage from './pages/InventoryPage'
import RecipesPage from './pages/RecipesPage'
import SalesPage from './pages/SalesPage'
import WarehouseMobile from './pages/WarehouseMobile'
import UsersPage from './pages/UsersPage'

import UnauthorizedPage from './pages/UnauthorizedPage'

// Koruma katmanı: giriş yapmamış kullanıcıları login'e yönlendir, yetkisizleri 403 ekranına yönlendir
function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Tarayıcı URL'sini elle değiştiren yetkisiz kullanıcıyı 403 sayfasına yönlendir
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

// Role göre varsayılan sayfa
function getDefaultRoute(role) {
  switch (role) {
    case ROLES.ADMIN:
      return '/dashboard'
    case ROLES.MANAGER:
      return '/dashboard'
    case ROLES.CHEF:
      return '/recipes'
    case ROLES.WAREHOUSE:
      return '/warehouse'
    default:
      return '/login'
  }
}

// Giriş sonrası yönlendirme
function RoleRedirect() {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={getDefaultRoute(user?.role)} replace />
}

// Depo Ekranı Sarmalayıcısı: Yönetici ve Müdürler için yan menüyü (DashboardLayout) korur
function WarehouseRouteWrapper() {
  const { user } = useAuthStore()
  // Admin veya Müdür ise DashboardLayout içinde göster, böylece yan menü kaybolmaz
  if (user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER) {
    return (
      <DashboardLayout>
        <WarehouseMobile isEmbedded={true} />
      </DashboardLayout>
    )
  }
  // Depo personeli ise doğrudan tam ekran mobil terminal arayüzü
  return <WarehouseMobile isEmbedded={false} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Ana yönlendirme */}
      <Route path="/" element={<RoleRedirect />} />

      {/* Dashboard Layout ile sarmalanan sayfalar */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANAGER]}>
            <DashboardLayout>
              <ManagerDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF]}>
            <DashboardLayout>
              <InventoryPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/recipes"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF]}>
            <DashboardLayout>
              <RecipesPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sales"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANAGER]}>
            <DashboardLayout>
              <SalesPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <DashboardLayout>
              <UsersPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Depo Sorumlusu - Masaüstü ve Mobil Uyumlu */}
      <Route
        path="/warehouse"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE]}>
            <WarehouseRouteWrapper />
          </ProtectedRoute>
        }
      />

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
