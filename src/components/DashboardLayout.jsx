import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore, ROLES, ROLE_LABELS, ROLE_COLORS } from '../store'
import { FiHome, FiPackage, FiBook, FiBarChart2, FiUsers, FiLogOut, FiMenu, FiX, FiChevronLeft } from 'react-icons/fi'
import '../styles/layout.css'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Finansal Özet', icon: FiHome, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { path: '/inventory', label: 'Stok Yönetimi', icon: FiPackage, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF] },
  { path: '/recipes', label: 'Reçete Merkezi', icon: FiBook, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF] },
  { path: '/sales', label: 'Satış Analizi', icon: FiBarChart2, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { path: '/warehouse', label: 'Depo & Mal Kabul Terminali', icon: FiPackage, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE] },
  { path: '/users', label: 'Kullanıcı Yönetimi', icon: FiUsers, roles: [ROLES.ADMIN] },
]

export default function DashboardLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const filteredNav = NAV_ITEMS.filter((item) => item.roles.includes(user?.role))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNavClick = (path) => {
    navigate(path)
    setMobileMenuOpen(false)
  }

  return (
    <div className={`layout ${sidebarCollapsed ? 'layout--collapsed' : ''}`}>
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="layout-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar--mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand" onClick={() => navigate('/')}>
            <div className="sidebar-logo">
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="url(#sidegrad)" />
                <path d="M12 28V16l8-6 8 6v12H12z" fill="white" fillOpacity="0.9" />
                <circle cx="20" cy="22" r="3" fill="#10b981" />
                <defs>
                  <linearGradient id="sidegrad" x1="0" y1="0" x2="40" y2="40">
                    <stop stopColor="#10b981" />
                    <stop offset="1" stopColor="#064e3b" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            {!sidebarCollapsed && <span className="sidebar-brand-text">GastroSync</span>}
          </div>
          <button
            className="sidebar-collapse-btn desktop-only"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Menüyü daralt"
          >
            <FiChevronLeft className={sidebarCollapsed ? 'rotated' : ''} />
          </button>
          <button
            className="sidebar-close-btn mobile-only"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Menüyü kapat"
          >
            <FiX />
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => handleNavClick(item.path)}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="sidebar-nav-icon" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* User Info at bottom */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div
              className="sidebar-avatar"
              style={{ backgroundColor: ROLE_COLORS[user?.role] }}
            >
              {user?.avatar}
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.name}</span>
                <span className="sidebar-user-role">{ROLE_LABELS[user?.role]}</span>
              </div>
            )}
          </div>
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title="Çıkış Yap"
          >
            <FiLogOut />
            {!sidebarCollapsed && <span>Çıkış</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="layout-main">
        {/* Top Header */}
        <header className="layout-header">
          <button
            className="layout-menu-btn mobile-only"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Menüyü aç"
          >
            <FiMenu />
          </button>

          <div className="layout-header-left">
            <h1 className="layout-page-title">
              {filteredNav.find((n) => n.path === location.pathname)?.label || 'GastroSync'}
            </h1>
            <span className="layout-breadcrumb">Lezzet Rotası Restoranı</span>
          </div>

          <div className="layout-header-right">
            <div className="layout-header-date">
              {new Date().toLocaleDateString('tr-TR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            <div
              className="layout-header-avatar"
              style={{ backgroundColor: ROLE_COLORS[user?.role] }}
            >
              {user?.avatar}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="layout-content">
          {children}
        </main>
      </div>
    </div>
  )
}
