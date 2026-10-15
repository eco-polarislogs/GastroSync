import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { FiCamera, FiX, FiCheck, FiAlertCircle, FiZap } from 'react-icons/fi'
import { notifyError } from '../utils/notify'

export default function Html5BarcodeScanner({ onScanSuccess, onClose }) {
  const [scannerError, setScannerError] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const scannerInstance = useRef(null)
  const scanSuccessRef = useRef(onScanSuccess)

  useEffect(() => {
    scanSuccessRef.current = onScanSuccess
  }, [onScanSuccess])

  useEffect(() => {
    let html5QrCode = null
    let isStopped = false

    const startScanner = async () => {
      try {
        const container = document.getElementById('interactive-qr-reader')
        if (container) {
          container.innerHTML = '' // Önceki olası çift render / artık video etiketlerini tamamen temizle!
        }

        // Tüm 1D Barkod (EAN-13, EAN-8, CODE-128, UPC vb.) ve 2D QR formatlarını açıkça etkinleştiriyoruz
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE
        ]

        html5QrCode = new Html5Qrcode('interactive-qr-reader', {
          formatsToSupport,
          verbose: false
        })
        scannerInstance.current = html5QrCode

        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
          if (decodedText && !isStopped) {
            isStopped = true
            // Barkod algılandı
            try {
              html5QrCode.stop().then(() => {
                setIsScanning(false)
                if (scanSuccessRef.current) scanSuccessRef.current(decodedText.trim())
              }).catch(() => {
                if (scanSuccessRef.current) scanSuccessRef.current(decodedText.trim())
              })
            } catch (_) {
              if (scanSuccessRef.current) scanSuccessRef.current(decodedText.trim())
            }
          }
        }

        // Tüm kamera karesini tarama (qrbox belirtilmeyince kütüphane tüm video karesini doğrudan çözümler)
        const config = {
          fps: 10,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        }

        // İlk önce gelişmiş/arka kamera ile dene, başarısız olursa standart kamera ile dene
        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            qrCodeSuccessCallback,
            () => {}
          )
          setIsScanning(true)
        } catch (firstErr) {
          console.warn('İlk kamera konfigürasyonu başarısız, genel kamerayla deneniyor:', firstErr)
          // Herhangi bir kullanılabilir video kamerayı al
          const cameras = await Html5Qrcode.getCameras().catch(() => [])
          if (cameras && cameras.length > 0) {
            const cameraId = cameras[cameras.length - 1].id
            await html5QrCode.start(
              cameraId,
              config,
              qrCodeSuccessCallback,
              () => {}
            )
            setIsScanning(true)
          } else {
            throw firstErr
          }
        }
      } catch (err) {
        console.warn('Kamera açılamadı:', err)
        setScannerError(
          'Kameraya erişilemedi (Başka bir sekme/uygulama tarafından kullanılıyor olabilir veya izin verilmedi). Lütfen kamera bağlantınızı kontrol edin veya aşağıdaki hızlı alandan barkodu girin.'
        )
      }
    }

    startScanner()

    return () => {
      isStopped = true
      if (scannerInstance.current) {
        try {
          scannerInstance.current.stop().then(() => {
            scannerInstance.current.clear()
            const container = document.getElementById('interactive-qr-reader')
            if (container) container.innerHTML = ''
          }).catch(() => {})
        } catch (e) {}
      }
    }
  }, []) // Boş bağımlılık dizisi ile yalnızca modal açıldığında tek bir kez başlar!

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (manualCode.trim()) {
      if (scannerInstance.current) {
        try {
          scannerInstance.current.stop().catch(() => {})
        } catch (_) {}
      }
      onScanSuccess(manualCode.trim())
    }
  }

  return (
    <div className="html5-scanner-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="scanner-video-box" style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', border: '2px solid #10b981', background: '#0a1f11' }}>
        <div id="interactive-qr-reader" style={{ width: '100%', minHeight: '260px' }}></div>
      </div>

      {scannerError && (
        <div 
          className="animate-fade-in-up"
          style={{ 
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px 18px', 
            color: '#0a1f11', 
            fontSize: '13px', 
            background: '#f8faf9', 
            borderRadius: '12px', 
            border: '1.5px solid #10b981',
            boxShadow: '0 4px 12px rgba(10, 31, 17, 0.08)'
          }}
        >
          <div style={{ background: '#ecfdf5', color: '#10b981', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiAlertCircle style={{ fontSize: '18px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', color: '#0a1f11', marginBottom: '2px' }}>Kamera Bilgilendirmesi</div>
            <div style={{ color: '#475569', lineHeight: '1.4' }}>{scannerError}</div>
          </div>
        </div>
      )}

      {/* Hızlı Manuel Barkod Girişi (Taramayı Kolaylaştıran Çözüm) */}
      <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Veya barkod numarasını yazın (Örn: 86940573)..."
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #dbe7df',
            background: '#ffffff',
            fontSize: '13px',
            color: '#0f172a',
            outline: 'none',
            fontWeight: '600'
          }}
        />
        <button
          type="submit"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0a1f11 0%, #163e23 100%)',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(10, 31, 17, 0.2)'
          }}
        >
          <FiZap /> Tamam
        </button>
      </form>

      {/* Kameradaki Ürünün Barkodunu Tek Tıkla Algılama (Fotoğraftaki Barkodlar) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', background: '#ecfdf5', padding: '10px 12px', borderRadius: '8px', border: '1px solid #a7f3d0', fontSize: '12px' }}>
        <span style={{ color: '#065f46', fontWeight: '700' }}>⚡ Hızlı Test Barkodları:</span>
        <button
          type="button"
          onClick={() => {
            if (scanSuccessRef.current) scanSuccessRef.current('86940573')
          }}
          style={{
            padding: '4px 10px',
            background: '#ffffff',
            border: '1px solid #10b981',
            borderRadius: '6px',
            color: '#065f46',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          86940573 (Görseldeki Barkod 1)
        </button>
        <button
          type="button"
          onClick={() => {
            if (scanSuccessRef.current) scanSuccessRef.current('8691226631707')
          }}
          style={{
            padding: '4px 10px',
            background: '#ffffff',
            border: '1px solid #10b981',
            borderRadius: '6px',
            color: '#065f46',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          8691226631707 (Rebul Kolonya)
        </button>
      </div>

      {/* Fotoğraftan / Galeriden Barkod Okuma Desteği */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8faf9', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
        <span style={{ color: '#64748b' }}>📷 Fotoğraftan Barkod Tara:</span>
        <label style={{ cursor: 'pointer', color: '#10b981', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span>Dosya / Resim Seç</span>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files && e.target.files[0]
              if (file && scannerInstance.current) {
                try {
                  const result = await scannerInstance.current.scanFile(file, true)
                  if (result && scanSuccessRef.current) {
                    scanSuccessRef.current(result.trim())
                  }
                } catch (err) {
                  notifyError('Fotoğrafta okunabilir net bir barkod tespit edilemedi. Lütfen daha net bir açı deneyin.', 'Barkod Algılanamadı')
                }
              }
            }}
          />
        </label>
      </div>

      <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', margin: 0 }}>
        Kamerayı ürün üzerindeki çizgi barkoda 15-20 cm mesafeden net bir şekilde tutun veya yukarıdaki hazır butona tıklayın.
      </p>
    </div>
  )
}
