import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { FiCamera, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi'

export default function Html5BarcodeScanner({ onScanSuccess, onClose }) {
  const [scannerError, setScannerError] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef(null)
  const scannerInstance = useRef(null)

  useEffect(() => {
    let html5QrCode = null

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode('interactive-qr-reader')
        scannerInstance.current = html5QrCode

        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
          if (decodedText) {
            // Barkod okundu
            html5QrCode.stop().then(() => {
              setIsScanning(false)
              onScanSuccess(decodedText)
            }).catch(() => {
              onScanSuccess(decodedText)
            })
          }
        }

        const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
          // Yatay ince uzun barkod çerçevesi (oran: 2.5 : 1)
          const minEdgePercentage = 0.8
          const boxWidth = Math.floor(viewfinderWidth * minEdgePercentage)
          const boxHeight = Math.floor(boxWidth / 2.4)
          return {
            width: Math.min(boxWidth, 420),
            height: Math.min(boxHeight, 175)
          }
        }

        const config = {
          fps: 20,
          qrbox: qrboxFunction, // Yatay dikdörtgen barkod odak alanı
          aspectRatio: 1.777778 // 16:9 Yatay kamera en boy oranı
        }

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          qrCodeSuccessCallback,
          () => {}
        )
        setIsScanning(true)
      } catch (err) {
        console.warn('Kamera açılamadı (İzin veya ortam kısıtlaması):', err)
        setScannerError('Kameraya erişilemedi veya izin verilmedi. Lütfen kamera iznini onaylayın veya simüle barkod seçeneğini kullanın.')
      }
    }

    startScanner()

    return () => {
      if (scannerInstance.current) {
        try {
          scannerInstance.current.stop().then(() => {
            scannerInstance.current.clear()
          }).catch(() => {})
        } catch (e) {}
      }
    }
  }, [onScanSuccess])

  return (
    <div className="html5-scanner-wrapper">
      <div className="scanner-video-box">
        <div id="interactive-qr-reader" style={{ width: '100%', minHeight: '260px' }}></div>
      </div>

      {scannerError && (
        <div className="scanner-error-msg" style={{ padding: '10px', color: '#f87171', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', marginTop: '10px' }}>
          <FiAlertCircle style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          {scannerError}
        </div>
      )}

      <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>
        Kamerayı ürün barkoduna veya QR koduna hizalayın. Otomatik taranacaktır.
      </p>
    </div>
  )
}
