import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { INITIAL_INVENTORY } from '../data/inventoryData';
import { THEME } from '../theme/tokens';

const { width } = Dimensions.get('window');

export default function IOSApp() {
  const [currentScreen, setCurrentScreen] = useState('home'); // home, scan, inventory, detail
  const [screenHistory, setScreenHistory] = useState(['home']);
  const [items, setItems] = useState(INITIAL_INVENTORY);
  const [selectedItem, setSelectedItem] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [amount, setAmount] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // iOS Tarzı Sayfa Geçişi
  const navigateTo = (screenName, params = null) => {
    if (params) setSelectedItem(params);
    setScreenHistory((prev) => [...prev, screenName]);
    setCurrentScreen(screenName);
  };

  // Uygulama İçi Dahili Geri Butonu
  const goBack = () => {
    if (screenHistory.length > 1) {
      const nextHistory = [...screenHistory];
      nextHistory.pop();
      const previousScreen = nextHistory[nextHistory.length - 1];
      setScreenHistory(nextHistory);
      setCurrentScreen(previousScreen);
      if (previousScreen === 'home') setSelectedItem(null);
    } else {
      setCurrentScreen('home');
      setSelectedItem(null);
    }
  };

  const showNotification = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleStockAction = (isAdd) => {
    const qty = parseFloat(amount);
    if (!selectedItem || isNaN(qty) || qty <= 0) return;

    setItems((prev) =>
      prev.map((it) =>
        it.id === selectedItem.id
          ? { ...it, stock: isAdd ? it.stock + qty : Math.max(0, it.stock - qty) }
          : it
      )
    );
    showNotification(
      isAdd
        ? `✓ ${selectedItem.name} +${qty} ${selectedItem.unit} eklendi`
        : `⚠️ ${selectedItem.name} -${qty} ${selectedItem.unit} fire kaydedildi`
    );
    setAmount('');
    goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* iOS Navigation Bar */}
      <View style={styles.navBar}>
        {screenHistory.length > 1 ? (
          <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backText}>Geri</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>GS</Text>
          </View>
        )}

        <Text style={styles.navTitle} numberOfLines={1}>
          {currentScreen === 'home' && 'GastroSync iOS'}
          {currentScreen === 'scan' && 'Yatay Barkod Terminali'}
          {currentScreen === 'inventory' && 'Envanter Listesi'}
          {currentScreen === 'detail' && (selectedItem?.name || 'Ürün Detayı')}
        </Text>

        <View style={styles.navRight}>
          <Text style={styles.platformBadge}>iOS</Text>
        </View>
      </View>

      {/* Kompakt Yeşil Tikli Mesaj Kutusu */}
      {toastMsg ? (
        <View style={styles.toastBox}>
          <View style={styles.toastCheckBadge}><Text style={styles.toastCheckText}>✓</Text></View>
          <Text style={styles.toastMsgText}>{toastMsg}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {currentScreen === 'home' && (
          <View>
            <View style={styles.kpiContainer}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Bugünkü Ciro</Text>
                <Text style={styles.kpiValue}>47.850 ₺</Text>
                <Text style={styles.kpiTrend}>%12.5 dünden fazla</Text>
              </View>

              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, styles.kpiHalf]}>
                  <Text style={styles.kpiLabel}>Food Cost</Text>
                  <Text style={[styles.kpiValue, { color: '#10b981' }]}>%28.4</Text>
                  <Text style={styles.kpiSub}>Hedef: %30.0</Text>
                </View>
                <View style={[styles.kpiCard, styles.kpiHalf]}>
                  <Text style={styles.kpiLabel}>Kritik Stok</Text>
                  <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>
                    {items.filter((i) => i.stock <= i.min).length} Kalem
                  </Text>
                  <Text style={styles.kpiSub}>Acil Sipariş</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionHeader}>HIZLI OPERASYONLAR</Text>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigateTo('scan')}>
              <View style={[styles.actionIcon, { backgroundColor: '#f59e0b' }]}>
                <Text style={styles.actionIconText}>📷</Text>
              </View>
              <View style={styles.actionTextCol}>
                <Text style={styles.actionTitle}>Barkod / QR Terminali</Text>
                <Text style={styles.actionSub}>Yatay kamera ile mal kabul veya fire gir</Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigateTo('inventory')}>
              <View style={[styles.actionIcon, { backgroundColor: '#10b981' }]}>
                <Text style={styles.actionIconText}>📦</Text>
              </View>
              <View style={styles.actionTextCol}>
                <Text style={styles.actionTitle}>Stok & Depo Listesi</Text>
                <Text style={styles.actionSub}>Tüm hammadde seviyelerini incele</Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentScreen === 'scan' && (
          <View>
            {/* Yatay Kamera Önizleme Çerçevesi */}
            <View style={styles.landscapeCamCard}>
              <View style={styles.landscapeFrame}>
                <View style={styles.laserLine} />
              </View>
              <Text style={styles.landscapeCamText}>16:9 Yatay Barkod Okuyucu Aktif</Text>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Barkod Numarası ile Manuel Sorgu:</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: 8690123456781"
                placeholderTextColor="#64748b"
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => {
                  const f = items.find((i) => i.barcode === barcodeInput.trim());
                  if (f) navigateTo('detail', f);
                  else showNotification('Barkod bulunamadı');
                }}
              >
                <Text style={styles.submitBtnText}>Ürünü Getir</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>KAYITLI BARKODLAR</Text>
            {items.map((it) => (
              <TouchableOpacity
                key={it.id}
                style={styles.actionRow}
                onPress={() => navigateTo('detail', it)}
              >
                <View style={styles.actionTextCol}>
                  <Text style={styles.actionTitle}>{it.name}</Text>
                  <Text style={styles.actionSub}>{it.barcode} • {it.cat}</Text>
                </View>
                <Text style={[styles.stockText, it.stock <= it.min ? { color: '#f59e0b' } : {}]}>
                  {it.stock} {it.unit}
                </Text>
                <Text style={styles.rowChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {currentScreen === 'inventory' && (
          <View>
            {items.map((it) => (
              <TouchableOpacity
                key={it.id}
                style={styles.actionRow}
                onPress={() => navigateTo('detail', it)}
              >
                <View style={styles.actionTextCol}>
                  <Text style={styles.actionTitle}>{it.name}</Text>
                  <Text style={styles.actionSub}>Min: {it.min} {it.unit} • Birim: {it.price} ₺</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.stockText, it.stock <= it.min ? { color: '#f59e0b' } : {}]}>
                    {it.stock} {it.unit}
                  </Text>
                  <Text style={[styles.statusMini, it.stock <= it.min ? styles.statusMiniWarn : styles.statusMiniOk]}>
                    {it.stock <= it.min ? 'Kritik' : 'Yeterli'}
                  </Text>
                </View>
                <Text style={styles.rowChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {currentScreen === 'detail' && selectedItem && (
          <View>
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>{selectedItem.name}</Text>
              <Text style={styles.detailBarcode}>Barkod: {selectedItem.barcode}</Text>
              
              <View style={styles.detailStockBox}>
                <Text style={styles.detailStockLabel}>Mevcut Depo Stoğu</Text>
                <Text style={styles.detailStockValue}>{selectedItem.stock} {selectedItem.unit}</Text>
              </View>

              <Text style={styles.inputLabel}>İşlem Miktarı ({selectedItem.unit}):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: 5"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.halfBtn, styles.btnGreen]}
                  onPress={() => handleStockAction(true)}
                >
                  <Text style={styles.halfBtnText}>+ Mal Kabul</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.halfBtn, styles.btnRed]}
                  onPress={() => handleStockAction(false)}
                >
                  <Text style={styles.halfBtnText}>- Fire Düş</Text>
                </TouchableOpacity>
              </View>

              {/* Ekran İçi Geri Dön Butonu */}
              <TouchableOpacity style={styles.cancelBackBtn} onPress={goBack}>
                <Text style={styles.cancelBackText}>Vazgeç ve Listeye Dön</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Alt iOS Navigasyon Butonları */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomTab}
          onPress={() => navigateTo('home')}
        >
          <Text style={[styles.bottomTabText, currentScreen === 'home' && styles.bottomTabActive]}>
            📊 Finans
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomTab}
          onPress={() => navigateTo('scan')}
        >
          <Text style={[styles.bottomTabText, currentScreen === 'scan' && styles.bottomTabActive]}>
            📷 Barkod
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomTab}
          onPress={() => navigateTo('inventory')}
        >
          <Text style={[styles.bottomTabText, currentScreen === 'inventory' && styles.bottomTabActive]}>
            📦 Stok
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  navBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#121212',
    borderBottomWidth: 0.5,
    borderBottomColor: '#27272a',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 12,
  },
  backChevron: {
    fontSize: 26,
    color: '#f59e0b',
    fontWeight: '300',
    marginTop: -2,
  },
  backText: {
    fontSize: 16,
    color: '#f59e0b',
    fontWeight: '500',
    marginLeft: 2,
  },
  brandBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  brandBadgeText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  navRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  platformBadge: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: '600',
  },
  toastBox: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toastCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCheckText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '900',
  },
  toastMsgText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  kpiContainer: {
    marginBottom: 20,
  },
  kpiCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#27272a',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiHalf: {
    flex: 1,
    marginBottom: 0,
  },
  kpiLabel: {
    fontSize: 13,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginVertical: 4,
  },
  kpiTrend: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  kpiSub: {
    fontSize: 11,
    color: '#71717a',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
    marginLeft: 4,
  },
  actionRow: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: '#27272a',
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionIconText: {
    fontSize: 18,
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionSub: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 2,
  },
  rowChevron: {
    fontSize: 20,
    color: '#52525b',
    marginLeft: 8,
  },
  stockText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10b981',
  },
  statusMini: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  statusMiniOk: {
    color: '#10b981',
  },
  statusMiniWarn: {
    color: '#f59e0b',
  },
  landscapeCamCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: '#27272a',
  },
  landscapeFrame: {
    width: width - 64,
    height: (width - 64) * 0.45, // 16:9 yatay oran
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#f43f5e',
  },
  landscapeCamText: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 10,
    fontWeight: '500',
  },
  inputCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: '#27272a',
  },
  inputLabel: {
    fontSize: 13,
    color: '#d4d4d8',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#09090b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
    color: '#ffffff',
    padding: 12,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  detailCard: {
    backgroundColor: '#18181b',
    borderRadius: 18,
    padding: 20,
    borderWidth: 0.5,
    borderColor: '#27272a',
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  detailBarcode: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 4,
    marginBottom: 16,
  },
  detailStockBox: {
    backgroundColor: '#09090b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  detailStockLabel: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  detailStockValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f59e0b',
    marginTop: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  halfBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnGreen: {
    backgroundColor: '#10b981',
  },
  btnRed: {
    backgroundColor: '#f43f5e',
  },
  halfBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBackBtn: {
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBackText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: '#121212',
    borderTopWidth: 0.5,
    borderTopColor: '#27272a',
    flexDirection: 'row',
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabText: {
    fontSize: 13,
    color: '#71717a',
    fontWeight: '600',
  },
  bottomTabActive: {
    color: '#f59e0b',
  },
});
