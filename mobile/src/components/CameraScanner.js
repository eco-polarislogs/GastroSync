import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { THEME } from '../theme/tokens';

export default function CameraScanner({ onBarcodeScanned, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // İzin kontrolü yükleniyor
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoText}>Kamera izni kontrol ediliyor...</Text>
      </View>
    );
  }

  // İzin verilmemiş ise
  if (!permission.granted) {
    return (
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>📷 Kamera İzni Gereklidir</Text>
        <Text style={styles.permissionDesc}>
          Ürün barkodlarını taramak ve otomatik mal kabul / fire girişi yapabilmek için kameraya izin vermelisiniz.
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
    const data = scanningResult.data;
    if (onBarcodeScanned) {
      onBarcodeScanned(data);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_a', 'upc_e'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Kamera Üzerindeki GastroSync 16:9 Yatay Çerçevesi */}
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>📷 Barkodu Kırmızı Çizgiye Hizalayın</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
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

        <View style={styles.bottomBar}>
          <Text style={styles.hintText}>EAN-13, EAN-8 ve QR Kodlar otomatik taranır</Text>
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
  container: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#07190e',
    marginBottom: 16,
  },
  centerContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  infoText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  permissionCard: {
    padding: 20,
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.primary,
    marginBottom: 8,
  },
  permissionDesc: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  grantBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  grantBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  cancelBtn: {
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(7, 25, 14, 0.4)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  closeBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  reticleBox: {
    alignSelf: 'center',
    width: '85%',
    height: 120, // 16:9 yatay barkod çerçevesi
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#ef4444',
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: THEME.colors.accent,
  },
  tl: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  bottomBar: {
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rescanBtn: {
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  rescanBtnText: {
    color: '#07190e',
    fontWeight: '800',
    fontSize: 12,
  },
});
