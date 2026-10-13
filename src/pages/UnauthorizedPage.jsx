import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, ROLE_LABELS } from '../store'
import { FiShield, FiArrowLeft, FiLock } from 'react-icons/fi'

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

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
        maxWidth: '480px',
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
          403 — Yetkisiz Erişim Engellendi
        </h2>
        
        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
          Bu sayfaya veya işlem merkezine erişim izniniz bulunmamaktadır. Tarayıcı adres çubuğunu manuel değiştirerek bu ekrana erişemezsiniz.
        </p>

        {user && (
          <div style={{
            background: '#090d14',
            border: '1px solid #1e293b',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '24px',
            textAlign: 'left',
            fontSize: '13px'
          }}>
            <div style={{ color: '#64748b', marginBottom: '4px' }}>Aktif Oturum Bilgisi:</div>
            <div style={{ fontWeight: '700', color: '#f8fafc' }}>{user.name}</div>
            <div style={{ color: '#f59e0b', fontSize: '12px' }}>Yetki Rolü: {ROLE_LABELS[user.role] || user.role}</div>
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
          <FiArrowLeft /> Yetkili Ana Panelime Dön
        </button>
      </div>
    </div>
  )
}
