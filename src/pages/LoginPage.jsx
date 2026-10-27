import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, ROLE_LABELS, ROLE_COLORS, ROLES } from '../store'
import '../styles/login.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleRoleNavigation = (role) => {
    switch (role) {
      case ROLES.ADMIN:
      case ROLES.MANAGER:
        navigate('/dashboard')
        break
      case ROLES.ACCOUNTANT:
      case ROLES.FINANCIAL_ADVISOR:
        navigate('/accounting')
        break
      case ROLES.CHEF:
        navigate('/recipes')
        break
      case ROLES.WAREHOUSE:
        navigate('/warehouse')
        break
      default:
        navigate('/dashboard')
    }
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setError('')
    setLoading(true)

    // Simulate light network latency
    await new Promise((r) => setTimeout(r, 400))

    const result = await login(username, password)
    setLoading(false)

    if (result.success) {
      handleRoleNavigation(result.user.role)
    } else {
      setError(result.message)
    }
  }

  const handleQuickLogin = async (acc) => {
    setUsername(acc.username)
    setPassword(acc.realPass)
    setError('')
    setLoading(true)

    const result = await login(acc.username, acc.realPass)
    setLoading(false)

    if (result.success) {
      handleRoleNavigation(result.user.role)
    } else {
      setError(result.message)
    }
  }

  const demoAccounts = [
    { username: 'admin', label: 'admin', role: ROLES.ADMIN, realPass: '123456' },
    { username: 'manager', label: 'müdür', role: ROLES.MANAGER, realPass: '123456' },
    { username: 'chef', label: 'şef', role: ROLES.CHEF, realPass: '123456' },
    { username: 'warehouse', label: 'depocu', role: ROLES.WAREHOUSE, realPass: '123456' },
    { username: 'muhasebe', label: 'muhasebe', role: ROLES.ACCOUNTANT, realPass: 'muhasebe123' },
    { username: 'advisor', label: 'mali müşavir', role: ROLES.FINANCIAL_ADVISOR, realPass: '123456' },
  ]

  const featureBadges = [
    {
      title: 'Dijital Menü & Reçete',
      desc: 'Tüm gramaj ve fire döngüsü',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      ),
      bg: '#e0e7ff',
      color: '#4338ca',
    },
    {
      title: 'Anlık Food Cost',
      desc: 'Doğrulanmış maliyet analitiği',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="m9 12 2 2 4-4"></path>
        </svg>
      ),
      bg: '#dcfce7',
      color: '#15803d',
    },
    {
      title: 'Karekod & Stok Takibi',
      desc: 'Kritik seviye ve barkod okuma',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
      bg: '#f3e8ff',
      color: '#7e22ce',
    },
  ]

  return (
    <div className="tein-login-page">
      {/* Animated Floating Emerald & Mint Balloons / Orbs */}
      <div className="tein-login-bg">
        <div className="tein-orb tein-orb-1"></div>
        <div className="tein-orb tein-orb-2"></div>
        <div className="tein-orb tein-orb-3"></div>
        <div className="tein-orb tein-orb-4"></div>
      </div>

      <div className="tein-login-wrapper animate-fade-in-up">
        {/* LEFT COLUMN: HERO & BRAND STORY */}
        <div className="tein-left-col">
          <div className="tein-tagline-badge">
            <span>GASTROSYNC / RESTORAN YÖNETİMİ</span>
          </div>

          <h1 className="tein-hero-title">
            Her tabağın bir <br />
            <span className="tein-hero-highlight">hikâyesi var.</span>
          </h1>

          <p className="tein-hero-desc">
            Menü reçetelerini, porsiyon maliyetlerini ve stok hareketlerini tek bir çalışma alanından takip edin.
          </p>

          <div className="tein-badges-list">
            {featureBadges.map((badge, idx) => (
              <div key={idx} className="tein-badge-card">
                <div className="tein-badge-icon" style={{ backgroundColor: badge.bg, color: badge.color }}>
                  {badge.icon}
                </div>
                <div className="tein-badge-text">
                  <span className="tein-badge-title">{badge.title}</span>
                  <span className="tein-badge-desc">{badge.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="tein-left-footer">
            <span>Mutfaktan kasaya, lezzet ve maliyet her adımda yanınızda.</span>
          </div>
        </div>

        {/* RIGHT COLUMN: LOGIN CARD */}
        <div className="tein-right-col">
          <div className="tein-login-card">
            <div className="tein-card-header" style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                <img
                  src="/logo.jpg"
                  alt="GastroSync Restaurant Management"
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35), 0 2px 6px rgba(0,0,0,0.2)',
                    border: '2px solid rgba(212, 175, 55, 0.8)'
                  }}
                />
              </div>
              <span className="tein-workspace-tag">ÇALIŞMA ALANINIZ</span>
              <h2 className="tein-card-title">Tekrar hoş geldiniz</h2>
              <p className="tein-card-subtitle">Devam etmek için hesabınıza giriş yapın.</p>
            </div>

            {error && (
              <div className="tein-error-alert animate-fade-in">
                <span className="tein-error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form className="tein-form" onSubmit={handleSubmit}>
              <div className="tein-field">
                <label className="tein-label" htmlFor="username">
                  E-posta veya kullanıcı adı <span className="tein-required">*</span>
                </label>
                <div className="tein-input-wrapper">
                  <input
                    id="username"
                    type="text"
                    className="tein-input"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="tein-field">
                <label className="tein-label" htmlFor="password">
                  Parola <span className="tein-required">*</span>
                </label>
                <div className="tein-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="tein-input"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="tein-toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Parolayı göster/gizle"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button type="submit" className="tein-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="tein-spinner"></span>
                ) : (
                  <>
                    <span>Giriş yap</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Accounts Selection */}
            <div className="tein-demo-section">
              <span className="tein-demo-hint">Hızlı Demo Erişimi (Tek Tıkla Giriş):</span>
              <div className="tein-demo-chips">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    className="tein-demo-chip"
                    disabled={loading}
                    onClick={() => handleQuickLogin(acc)}
                    title={`${acc.label} olarak hızlı giriş yap`}
                  >
                    <span className="tein-chip-dot" style={{ backgroundColor: ROLE_COLORS[acc.role] }}></span>
                    <span className="tein-chip-name">{acc.label || acc.username}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="tein-card-footer">
              <p>Hesap erişimi için restoran yöneticinizle iletişime geçin.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
