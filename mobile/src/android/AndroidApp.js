import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Dimensions,
} from 'react-native';
import { INITIAL_INVENTORY } from '../data/inventoryData';
import { THEME } from '../theme/tokens';

const { width } = Dimensions.get('window');

export default function AndroidApp() {
  const [currentScreen, setCurrentScreen] = useState('home'); // home, scan, inventory, detail
  const [screenStack, setScreenStack] = useState(['home']);
  const [items, setItems] = useState(INITIAL_INVENTORY);
  const [selectedItem, setSelectedItem] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantity, setQuantity] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Material Design 3 Sayfa Yönlendirme
  const navigateTo = (screen, item = null) => {
    if (item) setSelectedItem(item);
    setScreenStack((prev) => [...prev, screen]);
    setCurrentScreen(screen);
  };

  // Kullanıcıyı Android Sistem Geri Tuşuna Mecbur Etmeyen Dahili Geri Butonu
  const handleAppBack = () => {
    if (screenStack.length > 1) {
      const updated = [...screenStack];
      updated.pop();
      const prev = updated[updated.length - 1];
      setScreenStack(updated);
      setCurrentScreen(prev);
      if (prev === 'home') setSelectedItem(null);
    } else {
      setCurrentScreen('home');
      setSelectedItem(null);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleStockAction = (isAdd) => {
    const qty = parseFloat(quantity);
    if (!selectedItem || isNaN(qty) || qty <= 0) return;

    setItems((prev) =>
      prev.map((it) =>
        it.id === selectedItem.id
          ? { ...it, stock: isAdd ? it.stock + qty : Math.max(0, it.stock - qty) }
          : it
      )
    );
    showToast(
      isAdd
        ? `✓ ${selectedItem.name} +${qty} ${selectedItem.unit} eklendi`
        : `⚠️ ${selectedItem.name} -${qty} ${selectedItem.unit} fire kaydedildi`
    );
    setQuantity('');
    handleAppBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#131b2a" barStyle="light-content" />

      {/* Material 3 Top App Bar with Embedded Back Navigation */}
      <View style={styles.topAppBar}>
        {screenStack.length > 1 ? (
          <TouchableOpacity style={styles.appBarAction} onPress={handleAppBack} activeOpacity={0.6}>
            <Text style={styles.arrowIcon}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>GS</Text>
          </View>
        )}

        <View style={styles.titleCol}>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {currentScreen === 'home' && 'GastroSync Android'}
            {currentScreen === 'scan' && 'Yatay Barkod Terminali'}
            {currentScreen === 'inventory' && 'Depo & Envanter'}
            {currentScreen === 'detail' && (selectedItem?.name || 'Ürün İşlemi')}
          </Text>
          <Text style={styles.appBarSub}>Samsung, Xiaomi, Pixel Uyumlu</Text>
        </View>

        {screenStack.length > 1 && (
          <TouchableOpacity style={styles.textBackBadge} onPress={handleAppBack}>
            <Text style={styles.textBackBadgeLabel}>GERİ</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Kompakt Yeşil Tikli Onay Kutusu */}
      {toastMessage ? (
        <View style={styles.snackBar}>
          <View style={styles.checkCircle}><Text style={styles.checkSign}>✓</Text></View>
          <Text style={styles.snackText}>{toastMessage}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {currentScreen === 'home' && (
          <View>
            <View style={styles.cardElevated}>
              <Text style={styles.labelMuted}>GÜNLÜK TOPLAM CİRO</Text>
              <Text style={styles.statLarge}>47.850 ₺</Text>
              <Text style={styles.statBadge}>▲ %12.5 dünden fazla</Text>
            </View>

            <View style={styles.gridRow}>
              <View style={[styles.cardElevated, styles.gridCol]}>
                <Text style={styles.labelMuted}>FOOD COST</Text>
                <Text style={[styles.statMedium, { color: '#10b981' }]}>%28.4</Text>
                <Text style={styles.labelSub}>Hedef: %30.0</Text>
              </View>

              <View style={[styles.cardElevated, styles.gridCol]}>
                <Text style={styles.labelMuted}>KRİTİK STOK</Text>
                <Text style={[styles.statMedium, { color: '#f59e0b' }]}>
                  {items.filter((i) => i.stock <= i.min).length} Ürün
                </Text>
                <Text style={styles.labelSub}>Acil Sipariş</Text>
              </View>
            </View>

            <Text style={styles.categoryTitle}>HIZLI ERİŞİM KARTLARI</Text>

            <TouchableOpacity style={styles.fabRow} onPress={() => navigateTo('scan')}>
              <View style={[styles.fabIconBox, { backgroundColor: '#f59e0b' }]}>
                <Text style={styles.fabIcon}>📷</Text>
              </View>
              <View style={styles.fabCol}>
                <Text style={styles.fabTitle}>Yatay Barkod Terminali</Text>
                <Text style={styles.fabSub}>16:9 Geniş açılı kamera ile mal kabul veya zayiat yap</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.fabRow} onPress={() => navigateTo('inventory')}>
              <View style={[styles.fabIconBox, { backgroundColor: '#10b981' }]}>
                <Text style={styles.fabIcon}>📦</Text>
              </View>
              <View style={styles.fabCol}>
                <Text style={styles.fabTitle}>Depo Stok Yönetimi</Text>
                <Text style={styles.fabSub}>Tüm hammaddeleri ve kritik seviyeleri listele</Text>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentScreen === 'scan' && (
          <View>
            {/* 16:9 Yatay Barkod Okuyucu Çerçevesi */}
            <View style={styles.horizontalCamBox}>
              <View style={styles.horizontalCamViewport}>
                <View style={styles.redLaser} />
              </View>
              <Text style={styles.camNotice}>16:9 Yatay Kamera Modu Aktif</Text>
            </View>

            <View style={styles.cardElevated}>
              <Text style={styles.labelField}>Barkod ile Hızlı Arama:</Text>
              <TextInput
                style={styles.textInputAndroid}
                placeholder="Örn: 8690123456781"
                placeholderTextColor="#64748b"
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.btnAndroidPrimary}
                onPress={() => {
                  const it = items.find((x) => x.barcode === barcodeInput.trim());
                  if (it) navigateTo('detail', it);
                  else showToast('Barkod bulunamadı');
                }}
              >
                <Text style={styles.btnAndroidPrimaryText}>Ürünü Getir</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.categoryTitle}>KAYITLI BARKOD LİSTESİ</Text>
            {items.map((it) => (
              <TouchableOpacity
                key={it.id}
                style={styles.fabRow}
                onPress={() => navigateTo('detail', it)}
              >
                <View style={styles.fabCol}>
                  <Text style={styles.fabTitle}>{it.name}</Text>
                  <Text style={styles.fabSub}>{it.barcode} • {it.cat}</Text>
                </View>
                <Text style={[styles.stockAmount, it.stock <= it.min ? { color: '#f59e0b' } : {}]}>
                  {it.stock} {it.unit}
                </Text>
                <Text style={styles.chevron}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {currentScreen === 'inventory' && (
          <View>
            {items.map((it) => (
              <TouchableOpacity
                key={it.id}
                style={styles.fabRow}
                onPress={() => navigateTo('detail', it)}
              >
                <View style={styles.fabCol}>
                  <Text style={styles.fabTitle}>{it.name}</Text>
                  <Text style={styles.fabSub}>Min: {it.min} {it.unit} • Birim: {it.price} ₺</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.stockAmount, it.stock <= it.min ? { color: '#f59e0b' } : {}]}>
                    {it.stock} {it.unit}
                  </Text>
                  <Text style={[styles.badgeText, it.stock <= it.min ? styles.badgeWarn : styles.badgeOk]}>
                    {it.stock <= it.min ? 'KRİTİK' : 'YETERLİ'}
                  </Text>
                </View>
                <Text style={styles.chevron}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {currentScreen === 'detail' && selectedItem && (
          <View>
            <View style={styles.cardElevated}>
              <Text style={styles.itemHeading}>{selectedItem.name}</Text>
              <Text style={styles.itemCode}>Barkod: {selectedItem.barcode}</Text>

              <View style={styles.stockInfoPill}>
                <Text style={styles.labelMuted}>MEVCUT STOK</Text>
                <Text style={styles.stockLarge}>{selectedItem.stock} {selectedItem.unit}</Text>
              </View>

              <Text style={styles.labelField}>Giriş / Çıkış Miktarı ({selectedItem.unit}):</Text>
              <TextInput
                style={styles.textInputAndroid}
                placeholder="Örn: 10"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />

              <View style={styles.btnGrid}>
                <TouchableOpacity
                  style={[styles.actionBtnAndroid, styles.btnInbound]}
                  onPress={() => handleStockAction(true)}
                >
                  <Text style={styles.actionBtnText}>+ MAL KABUL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtnAndroid, styles.btnWaste]}
                  onPress={() => handleStockAction(false)}
                >
                  <Text style={styles.actionBtnText}>- FİRE DÜŞ</Text>
                </TouchableOpacity>
              </View>

              {/* Dahili Uygulama Geri Butonu */}
              <TouchableOpacity style={styles.btnAppCancel} onPress={handleAppBack}>
                <Text style={styles.btnAppCancelText}>← Vazgeç ve Listeye Dön</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Material Design 3 Navigation Bar */}
      <View style={styles.bottomNavAndroid}>
        <TouchableOpacity style={styles.navTab} onPress={() => navigateTo('home')}>
          <Text style={[styles.navTabLabel, currentScreen === 'home' && styles.navTabActive]}>
            📊 Finans
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navTab} onPress={() => navigateTo('scan')}>
          <Text style={[styles.navTabLabel, currentScreen === 'scan' && styles.navTabActive]}>
            📷 Barkod
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navTab} onPress={() => navigateTo('inventory')}>
          <Text style={[styles.navTabLabel, currentScreen === 'inventory' && styles.navTabActive]}>
            📦 Depo
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  topAppBar: {
    height: 64,
    backgroundColor: '#131b2a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222f46',
    elevation: 4,
  },
  appBarAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c263b',
    marginRight: 10,
  },
  arrowIcon: {
    fontSize: 22,
    color: '#f59e0b',
    fontWeight: '700',
  },
  logoBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 12,
  },
  logoText: {
    color: '#0b0f17',
    fontWeight: '900',
    fontSize: 13,
  },
  titleCol: {
    flex: 1,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  appBarSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  textBackBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  textBackBadgeLabel: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '800',
  },
  snackBar: {
    margin: 14,
    backgroundColor: '#131b2a',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 6,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSign: {
    color: '#10b981',
    fontWeight: '900',
    fontSize: 13,
  },
  snackText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 90,
  },
  cardElevated: {
    backgroundColor: '#131b2a',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222f46',
    elevation: 2,
  },
  labelMuted: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
  },
  statLarge: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f8fafc',
    marginVertical: 4,
  },
  statBadge: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCol: {
    flex: 1,
  },
  statMedium: {
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 4,
  },
  labelSub: {
    fontSize: 11,
    color: '#64748b',
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginVertical: 10,
    marginLeft: 4,
  },
  fabRow: {
    backgroundColor: '#131b2a',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222f46',
    elevation: 1,
  },
  fabIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fabIcon: {
    fontSize: 20,
  },
  fabCol: {
    flex: 1,
  },
  fabTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  fabSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: '#64748b',
    marginLeft: 6,
  },
  stockAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10b981',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  badgeOk: {
    color: '#10b981',
  },
  badgeWarn: {
    color: '#f59e0b',
  },
  horizontalCamBox: {
    backgroundColor: '#131b2a',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222f46',
  },
  horizontalCamViewport: {
    width: width - 64,
    height: (width - 64) * 0.45, // 16:9 yatay ekran
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#090d14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redLaser: {
    width: '85%',
    height: 2,
    backgroundColor: '#f43f5e',
  },
  camNotice: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 10,
    fontWeight: '600',
  },
  labelField: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
    marginBottom: 8,
  },
  textInputAndroid: {
    backgroundColor: '#090d14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222f46',
    color: '#f8fafc',
    padding: 12,
    fontSize: 15,
  },
  btnAndroidPrimary: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnAndroidPrimaryText: {
    color: '#0b0f17',
    fontWeight: '800',
    fontSize: 14,
  },
  itemHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
  },
  itemCode: {
    fontSize: 13,
    color: '#64748b',
    marginVertical: 4,
  },
  stockInfoPill: {
    backgroundColor: '#090d14',
    padding: 16,
    borderRadius: 14,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#222f46',
  },
  stockLarge: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f59e0b',
    marginTop: 4,
  },
  btnGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionBtnAndroid: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnInbound: {
    backgroundColor: '#10b981',
  },
  btnWaste: {
    backgroundColor: '#f43f5e',
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  btnAppCancel: {
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#1c263b',
    borderRadius: 10,
  },
  btnAppCancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomNavAndroid: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: '#131b2a',
    borderTopWidth: 1,
    borderTopColor: '#222f46',
    flexDirection: 'row',
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTabLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
  },
  navTabActive: {
    color: '#f59e0b',
  },
});
