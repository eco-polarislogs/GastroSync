import React, { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore, useNotificationStore } from '../store'
import { FiArrowLeft, FiLock, FiAlertOctagon } from 'react-icons/fi'
import { TRANSLATIONS, getRoleLabel } from '../utils/translations'

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, currentLanguage } = useAuthStore()
  const { sendNotification } = useNotificationStore()
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr
  const hasNotifiedRef = useRef(false)

  const attemptedPath = location.state?.from || window.location.pathname || 'Bilinmeyen Sayfa'
  const attemptTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Yetkisiz erişim teşebbüsünü Yöneticiye (MANAGER) ve Süper Admine (ADMIN) bildirim olarak ilet
  useEffect(() => {
    if (!hasNotifiedRef.current && user) {
      hasNotifiedRef.current = true

      const roleDisplay = getRoleLabel(user.role, currentLanguage) || user.role

      // Müdüre bildirim gönder
      sendNotification({
        title: t.unauthorizedAttemptAlertTitle || '🚨 Yetkisiz Sayfa Erişim Girişimi!',
        message: `${user.name} (${roleDisplay}) adlı kullanıcı yetkisi olmayan '${attemptedPath}' sayfasına erişmeye çalıştı. İşlem zamanı: ${attemptTime}. Erişim otomatik engellendi.`,
        targetRole: 'MANAGER',
        senderName: `${user.name} (${roleDisplay})`,
        type: 'SECURITY_ALERT',
        relatedEntityId: null
      })

      // Admine bildirim gönder
      sendNotification({
        title: t.unauthorizedAttemptAlertTitle || '🚨 Yetkisiz Sayfa Erişim Girişimi!',
        message: `${user.name} (${roleDisplay}) adlı kullanıcı yetkisi olmayan '${attemptedPath}' sayfasına erişmeye çalıştı. İşlem zamanı: ${attemptTime}. Erişim otomatik engellendi.`,
        targetRole: 'ADMIN',
        senderName: `${user.name} (${roleDisplay})`,
        type: 'SECURITY_ALERT',
        relatedEntityId: null
      })
    }
  }, [user, attemptedPath, attemptTime, currentLanguage, sendNotification, t])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0b0f17',
      color: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        background: '#131b2a',
        border: '1px solid #222f46',
        borderRadius: '16px',
        padding: '36px 28px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          background: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#f43f5e',
          fontSize: '32px'
        }}>
          <FiLock />
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>
          {t.unauthorizedTitle}
        </h2>

        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
          {t.unauthorizedDesc}
        </p>

        {user && (
          <div style={{
            background: '#090d14',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'left',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>
              <span style={{ color: '#64748b' }}>{t.activeSessionInfo}:</span>
              <strong style={{ color: '#f8fafc' }}>{user.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>{t.userRoleLabel}:</span>
              <span style={{ color: '#f59e0b', fontWeight: '700' }}>{getRoleLabel(user.role, currentLanguage)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>{t.attemptedPageLabel}:</span>
              <code style={{ color: '#f43f5e', backgroundColor: 'rgba(244, 63, 94, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                {attemptedPath}
              </code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>{t.attemptTimestampLabel}:</span>
              <span style={{ color: '#38bdf8' }}>{attemptTime}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%',
            padding: '12px 20px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#0b0f17',
            fontWeight: '800',
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
          }}
        >
          <FiArrowLeft /> {t.backToAuthorizedPanel}
        </button>
      </div>
    </div>
  )
}
