import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { THEME } from '../theme/tokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CameraScanner({ onBarcodeScanned, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraMounted, setCameraMounted] = useState(false);

  // Android donanım hızlandırma ve SurfaceView zamanlama gecikmesi (black screen önleme)
  useEffect(() => {
    let timer;
    if (permission?.granted) {
      timer = setTimeout(() => {
        setCameraMounted(true);
      }, 300);
    }
    return () => {
      if (timer) clearTimeout(timer);
      setCameraMounted(false);
    };
  }, [permission?.granted]);

  // İzin kontrolü yükleniyor
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color={THEME.colors.primary} />
        <Text style={styles.infoText}>Kamera başlatılıyor...</Text>
      </View>
    );
  }

  // İzin verilmemiş ise
  if (!permission.granted) {
    return (
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>📷 Kamera İzni Gerekli</Text>
        <Text style={styles.permissionDesc}>
          Barkod tarayarak mal kabul ve stok eşleştirme yapabilmek için kamera izni verilmelidir.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Kamera İzni Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Vazgeç</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = (scanningResult) => {
    if (scanned) return;
    setScanned(true);
    const data = scanningResult?.data;
    if (data && onBarcodeScanned) {
      onBarcodeScanned(data);
    }
  };

  return (
    <View style={styles.fullscreenWrapper}>
      {cameraMounted ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_a', 'upc_e'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
      ) : (
        <View style={styles.loadingCameraBox}>
          <ActivityIndicator size="large" color={THEME.colors.accent} />
          <Text style={styles.loadingCameraTxt}>Kamera başlatılıyor...</Text>
        </View>
      )}

      {/* Şık ve Şeffaf Barkod Çerçevesi Overlay */}
      <View style={styles.overlay}>
        <View style={styles.headerBar}>
          <View style={styles.pillBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.pillBadgeText}>CANLI TARAYICI</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕ Kapat</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reticleBox}>
          <View style={styles.laserLine} />
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>

        <View style={styles.footerBar}>
          <Text style={styles.hintText}>Barkodu kırmızı lazer çizgisine hizalayın</Text>
          {scanned && (
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
              <Text style={styles.rescanBtnText}>Tekrar Tara</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenWrapper: {
    width: '100%',
    height: 380,
    position: 'relative',
    backgroundColor: '#000000',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  loadingCameraBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a190f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingCameraTxt: {
    color: '#96be9f',
    fontSize: 13,
    fontWeight: '600',
  },
  centerContainer: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 8,
    marginBottom: 16,
  },
  infoText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  permissionCard: {
    padding: 20,
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.primary,
    marginBottom: 6,
  },
  permissionDesc: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 18,
  },
  grantBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 6,
  },
  grantBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: 'transparent',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  pillBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  reticleBox: {
    alignSelf: 'center',
    width: '85%',
    height: 140,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  laserLine: {
    width: '92%',
    height: 2,
    backgroundColor: '#ef4444',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: THEME.colors.accent,
  },
  tl: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  footerBar: {
    alignItems: 'center',
    gap: 6,
  },
  hintText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  rescanBtn: {
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rescanBtnText: {
    color: '#07190e',
    fontWeight: '800',
    fontSize: 12,
  },
});
