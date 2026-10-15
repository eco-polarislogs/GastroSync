import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore, useNotificationStore, ROLES, ROLE_LABELS, ROLE_COLORS } from '../store'
import { FiHome, FiPackage, FiBook, FiBarChart2, FiUsers, FiDollarSign, FiLogOut, FiMenu, FiX, FiChevronLeft, FiBell, FiCheck, FiCheckCircle, FiGlobe } from 'react-icons/fi'
import { TRANSLATIONS, SUPPORTED_LANGUAGES, getRoleLabel, getLocalizedNotification } from '../utils/translations'
import RestaurantTeamChat from './RestaurantTeamChat'
import '../styles/layout.css'

export default function DashboardLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, currentLanguage, setLanguage } = useAuthStore()
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)

  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr

  const NAV_ITEMS = [
    { path: '/dashboard', label: t.dashboard, icon: FiHome, roles: [ROLES.ADMIN, ROLES.MANAGER] },
    { path: '/cashier', label: t.cashierAccounting, icon: FiDollarSign, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT] },
    { path: '/advisor-ledger', label: t.advisorLedger, icon: FiBook, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.FINANCIAL_ADVISOR] },
    { path: '/inventory', label: t.inventory, icon: FiPackage, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF, ROLES.ACCOUNTANT, ROLES.FINANCIAL_ADVISOR] },
    { path: '/recipes', label: t.recipes, icon: FiBook, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF] },
    { path: '/sales', label: t.sales, icon: FiBarChart2, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.FINANCIAL_ADVISOR] },
    { path: '/warehouse', label: t.warehouse, icon: FiPackage, roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE] },
    { path: '/users', label: t.users, icon: FiUsers, roles: [ROLES.ADMIN] },
  ]

  // Rol bazlı bildirimleri mount anında ve periyodik çek
  useEffect(() => {
    if (user?.role) {
      fetchNotifications(user.role)
      const timer = setInterval(() => {
        fetchNotifications(user.role)
      }, 4000)
      return () => clearInterval(timer)
    }
  }, [user?.role])

  // Kullanıcıya yönelik filtrelenmiş bildirimler
  const userNotifications = notifications.filter(
    (n) => n.targetRole === 'ALL' || n.targetRole === user?.role?.toUpperCase() || user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER
  )

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
                <span className="sidebar-user-role">{getRoleLabel(user?.role, currentLanguage)}</span>
              </div>
            )}
          </div>
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title={t.logout}
          >
            <FiLogOut />
            {!sidebarCollapsed && <span>{t.logout}</span>}
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
            <span className="layout-breadcrumb">{t.restaurantTitle}</span>
          </div>

          <div className="layout-header-right" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* DİL DEĞİŞTİRME MENÜSÜ (Tek Tuşla Şirket Dilinde Konuşun) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  color: '#1e293b'
                }}
                title="Şirket Dilini Değiştir"
              >
                <FiGlobe size={15} color="#059669" />
                <span>{SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.flag}</span>
                <span style={{ textTransform: 'uppercase' }}>{currentLanguage}</span>
              </button>

              {showLangMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '42px',
                    right: 0,
                    width: '160px',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e2e8f0',
                    zIndex: 1000,
                    padding: '6px'
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code)
                        setShowLangMenu(false)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: currentLanguage === lang.code ? '#ecfdf5' : 'none',
                        color: currentLanguage === lang.code ? '#065f46' : '#1e293b',
                        fontWeight: currentLanguage === lang.code ? 800 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.85rem'
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{lang.flag}</span>
                      <span>{lang.label}</span>
                      {currentLanguage === lang.code && <span style={{ marginLeft: 'auto', fontWeight: 900 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="layout-header-date">
              {new Date().toLocaleDateString(currentLanguage === 'en' ? 'en-US' : currentLanguage === 'de' ? 'de-DE' : currentLanguage === 'ar' ? 'ar-SA' : 'tr-TR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>

            {/* ROL TABANLI BİLDİRİM ZİLİ (Bildirim Kutusu & Paneli) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  position: 'relative',
                  backgroundColor: showNotifications ? '#ecfdf5' : '#f8fafc',
                  border: `1.5px solid ${showNotifications ? '#10b981' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#1e293b',
                  transition: 'all 0.2s',
                  fontSize: '18px'
                }}
                title="Rol Bildirimleri"
              >
                <FiBell />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 800,
                      borderRadius: '10px',
                      minWidth: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* BİLDİRİM AÇILIR PANELİ (DROPDOWN) */}
              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    top: '48px',
                    right: 0,
                    width: '360px',
                    maxWidth: '90vw',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e2e8f0',
                    zIndex: 1000,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>🔔</span>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{t.notifications}</strong>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 700
                        }}
                      >
                        {getRoleLabel(user?.role, currentLanguage)}
                      </span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsRead(user?.role)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#059669',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <FiCheckCircle size={12} /> {t.markAllRead}
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {userNotifications.length === 0 ? (
                      <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                        📭 {t.noNotifications}
                      </div>
                    ) : (
                      userNotifications.map((notif) => {
                        const localized = getLocalizedNotification(notif, currentLanguage)
                        return (
                          <div
                            key={notif.id}
                            onClick={() => markAsRead(notif.id)}
                            style={{
                              padding: '12px 16px',
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: notif.isRead ? '#ffffff' : '#f0fdf4',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                              <strong style={{ fontSize: '0.82rem', color: notif.isRead ? '#475569' : '#065f46' }}>
                                {localized.title}
                              </strong>
                              {!notif.isRead && (
                                <span style={{ width: '8px', height: '8px', borderRadius: '4px', backgroundColor: '#10b981' }} />
                              )}
                            </div>
                            <p style={{ margin: '0 0 6px 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                              {localized.message}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#64748b' }}>
                              <span>👤 {notif.senderName || 'Sistem'}</span>
                              <span>🕒 {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString(currentLanguage === 'ar' ? 'ar-SA' : currentLanguage === 'en' ? 'en-US' : currentLanguage === 'de' ? 'de-DE' : 'tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Az önce'}</span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
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

        {/* Dahili Restoran Telsizi & Ekip Sohbet Modülü */}
        <RestaurantTeamChat />
      </div>
    </div>
  )
}
