import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../theme/tokens';
import { ROLES, ROLE_LABELS, ROLE_COLORS, DEMO_USERS } from '../data/inventoryData';

export default function MobileLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const demoAccounts = [
    { username: 'admin', role: ROLES.ADMIN, realPass: 'admin123' },
    { username: 'mudur', role: ROLES.MANAGER, realPass: 'mudur123' },
    { username: 'muhasebe', role: ROLES.ACCOUNTANT, realPass: 'muhasebe123' },
    { username: 'malimusavir', role: ROLES.FINANCIAL_ADVISOR, realPass: 'musavir123' },
    { username: 'sef', role: ROLES.CHEF, realPass: 'sef123' },
    { username: 'depocu', role: ROLES.WAREHOUSE, realPass: 'depo123' },
  ];

  const handleLogin = async () => {
    const rawInput = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!rawInput || !cleanPassword) {
      setError('Lütfen kullanıcı adı ve şifre giriniz.');
      return;
    }

    setError('');
    setLoading(true);

    // Hafif geçiş simülasyonu
    await new Promise((r) => setTimeout(r, 400));

    // Demo hesap kontrolü
    const found = DEMO_USERS.find(
      (u) =>
        u.username.toLowerCase() === rawInput ||
        u.email.toLowerCase() === rawInput
    );

    const isMatch =
      (rawInput === 'admin' && (cleanPassword === 'admin123' || cleanPassword === '123456')) ||
      (rawInput === 'mudur' && (cleanPassword === 'mudur123' || cleanPassword === '123456')) ||
      (rawInput === 'muhasebe' && (cleanPassword === 'muhasebe123' || cleanPassword === '123456')) ||
      (rawInput === 'malimusavir' && (cleanPassword === 'musavir123' || cleanPassword === '123456')) ||
      (rawInput === 'sef' && (cleanPassword === 'sef123' || cleanPassword === '123456')) ||
      (rawInput === 'depocu' && (cleanPassword === 'depo123' || cleanPassword === '123456'));

    setLoading(false);

    if (found && isMatch) {
      onLoginSuccess(found);
    } else {
      setError('Geçersiz kullanıcı adı veya şifre!');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Web İle Birebir: Keyvo Mint & Emerald Hero Tanıtımı */}
        <View style={styles.heroBox}>
          <View style={styles.workspaceTag}>
            <View style={styles.workspaceDot} />
            <Text style={styles.workspaceTagTxt}>GASTROSYNC KURUMSAL SİSTEMİ</Text>
          </View>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>GS</Text>
            </View>
            <Text style={styles.brandTitle}>GastroSync</Text>
          </View>
          <Text style={styles.brandTagline}>Akıllı Reçete, Maliyet Zekası & Mal Kabul</Text>
        </View>

        {/* Web Login Kartı (tein-login-card) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderBox}>
            <Text style={styles.cardHeader}>Giriş Yapın</Text>
            <Text style={styles.cardSub}>Restoran rolünüze göre kimliğinizi doğrulayın</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Username Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>KULLANICI ADI VEYA E-POSTA</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Örn: admin, mudur, sef, depocu"
              placeholderTextColor={THEME.colors.textLight}
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                setError('');
              }}
              autoCapitalize="none"
            />
          </View>

          {/* Password Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PAROLA</Text>
            <View style={styles.pwWrapper}>
              <TextInput
                style={[styles.textInput, { flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]}
                placeholder="••••••"
                placeholderTextColor={THEME.colors.textLight}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError('');
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.togglePwBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitBtnText}>Sisteme Giriş Yap →</Text>
            )}
          </TouchableOpacity>

          {/* Hızlı Demo Hesap Butonları (Web tein-demo-section ile birebir) */}
          <View style={styles.demoSection}>
            <Text style={styles.demoHint}>HIZLI SEÇİM (DEMO ROLLER):</Text>
            <View style={styles.demoChipsRow}>
              {demoAccounts.map((acc) => (
                <TouchableOpacity
                  key={acc.username}
                  style={[
                    styles.demoChip,
                    username === acc.username && styles.demoChipActive,
                  ]}
                  onPress={() => {
                    setUsername(acc.username);
                    setPassword(acc.realPass);
                    setError('');
                  }}
                >
                  <View style={[styles.demoDot, { backgroundColor: ROLE_COLORS[acc.role] }]} />
                  <Text style={[styles.demoChipText, username === acc.username && styles.demoChipTextActive]}>
                    {acc.username} ({ROLE_LABELS[acc.role]})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Rol Bilgisi & Yetki Matrisi */}
          <View style={styles.roleInfoBox}>
            <Text style={styles.roleInfoTitle}>ROL YETKİLERİ (WEB MATRİSİ):</Text>
            <Text style={styles.roleInfoItem}>• <Text style={{ fontWeight: '700', color: ROLE_COLORS[ROLES.ADMIN] }}>Yönetici (admin):</Text> Tüm Sayfalar & Personel Yönetimi</Text>
            <Text style={styles.roleInfoItem}>• <Text style={{ fontWeight: '700', color: ROLE_COLORS[ROLES.MANAGER] }}>Restoran Müdürü (mudur):</Text> Finans, Ciro, Stok & Reçeteler</Text>
            <Text style={styles.roleInfoItem}>• <Text style={{ fontWeight: '700', color: ROLE_COLORS[ROLES.ACCOUNTANT] }}>Muhasebeci (muhasebe):</Text> Kasa, Kira & Gider Ödemeleri</Text>
            <Text style={styles.roleInfoItem}>• <Text style={{ fontWeight: '700', color: ROLE_COLORS[ROLES.FINANCIAL_ADVISOR] }}>Mali Müşavir (malimusavir):</Text> Defter Kayıtları, Vergi & Beyan</Text>
            <Text style={styles.roleInfoItem}>• <Text style={{ fontWeight: '700', color: ROLE_COLORS[ROLES.CHEF] }}>Mutfak Şefi (sef):</Text> Reçeteler & Malzeme Stokları</Text>
            <Text style={styles.roleInfoItem}>• <Text style={{ fontWeight: '700', color: ROLE_COLORS[ROLES.WAREHOUSE] }}>Depocu (depocu):</Text> Mal Kabul & Sayım (Elle Barkod)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f9f5',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  heroBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  workspaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 10,
  },
  workspaceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  workspaceTagTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: 0.5,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    backgroundColor: THEME.colors.accent,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  logoText: {
    color: '#07190e',
    fontWeight: '900',
    fontSize: 16,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0a1f11',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#d1ebdd',
    shadowColor: '#0a1f11',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeaderBox: {
    marginBottom: 20,
  },
  cardHeader: {
    fontSize: 22,
    fontWeight: '850',
    color: '#0a1f11',
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: {
    fontSize: 14,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f0f7f3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbebe2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  pwWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7f3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbebe2',
  },
  togglePwBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  submitBtn: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 18,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  demoSection: {
    borderTopWidth: 1,
    borderTopColor: '#eef6f1',
    paddingTop: 16,
    marginBottom: 14,
  },
  demoHint: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  demoChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7faf8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbebe2',
    gap: 6,
  },
  demoChipActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#10b981',
  },
  demoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  demoChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  demoChipTextActive: {
    color: '#047857',
  },
  roleInfoBox: {
    backgroundColor: '#edf7f0',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1ebdd',
    marginTop: 6,
  },
  roleInfoTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  roleInfoItem: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 18,
    marginTop: 2,
  },
});
