import toast from 'react-hot-toast'

/**
 * GastroSync Compact Green Checkmark Notification Box
 * Yalnızca yeni eklenen ürünler ve oluşturulan dosya/raporlar için 
 * kompakt, alert içermeyen, yeşil tikli zarif bildirim kutusu gösterir.
 */
export const notifySuccess = (message, title = 'İşlem Başarılı') => {
  toast.custom((t) => (
    <div
      style={{
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? 'scale(1)' : 'scale(0.95)',
        transition: 'all 0.15s ease-out',
        background: '#131b2a',
        border: '1px solid #10b981',
        borderRadius: '10px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
        minWidth: '300px',
        maxWidth: '480px',
        width: 'max-content',
      }}
    >
      {/* Yeşil Tik Rozeti */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1.5px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#10b981',
          fontSize: '15px',
          fontWeight: '900',
          flexShrink: 0,
        }}
      >
        ✓
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#10b981',
              lineHeight: 1.2,
              marginBottom: '3px',
            }}
          >
            {title}
          </div>
        )}
        <div
          style={{
            fontSize: '13px',
            color: '#f8fafc',
            fontWeight: '500',
            lineHeight: 1.4,
            wordBreak: 'break-word',
            whiteSpace: 'normal',
          }}
        >
          {message}
        </div>
      </div>
    </div>
  ), {
    duration: 4000,
    position: 'top-right'
  })
}

export const notifyError = (message, title = 'Hata') => {
  toast.custom((t) => (
    <div
      style={{
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? 'scale(1)' : 'scale(0.95)',
        transition: 'all 0.15s ease-out',
        background: '#1f1313',
        border: '1px solid #ef4444',
        borderRadius: '10px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
        minWidth: '300px',
        maxWidth: '480px',
        width: 'max-content',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1.5px solid #ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          fontSize: '15px',
          fontWeight: '900',
          flexShrink: 0,
        }}
      >
        ✕
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#ef4444',
              lineHeight: 1.2,
              marginBottom: '3px',
            }}
          >
            {title}
          </div>
        )}
        <div
          style={{
            fontSize: '13px',
            color: '#f8fafc',
            fontWeight: '500',
            lineHeight: 1.4,
            wordBreak: 'break-word',
            whiteSpace: 'normal',
          }}
        >
          {message}
        </div>
      </div>
    </div>
  ), {
    duration: 4000,
    position: 'top-right'
  })
}

