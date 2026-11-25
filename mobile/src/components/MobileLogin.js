import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Text, TextInput, LANGUAGES, setI18nLang, useI18nLang } from '../i18n';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../theme/tokens';
import { ROLE_LABELS, ROLE_COLORS, ROLE_ORDER } from '../data/inventoryData';
import { apiLogin, apiChangePassword, apiLogout, apiFetchDemoAccounts } from '../services/api';
import { getMobileApiBaseUrl, setServerOverride, getServerOverride, loadServerOverride } from '../services/mobileAxiosClient';

// Demo hızlı giriş listesini sunucu belirler: yalnızca demo modu açıkken ve gerçekten çalışan hesaplar gelir.

const passwordIssues = (p) => {
  const issues = [];
  if (!p || p.length < 8) issues.push('en az 8 karakter');
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p || '')) issues.push('harf');
  if (!/\d/.test(p || '')) issues.push('rakam');
  return issues;
};

export default function MobileLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [pendingUser, setPendingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const [demoAccounts, setDemoAccounts] = useState([]);

  const [serverRev, setServerRev] = useState(0);

  useEffect(() => {
    let alive = true;
    // Kayıtlı sunucu adresi yüklendikten sonra demo hesapları o sunucudan istenir
    loadServerOverride().then(() => apiFetchDemoAccounts()).then((list) => {
      if (alive) setDemoAccounts((list || []).map((a) => ({ ...a, role: String(a.role || '').toLowerCase() })));
    });
    return () => { alive = false; };
  }, [serverRev]);

  // Kimlik doğrulama yalnızca sunucuda yapılır; çevrimdışı / yerel giriş yoktur.
  const handleLogin = async (idArg, pwArg) => {
    const identifier = (typeof idArg === 'string' ? idArg : username).trim();
    const secret = typeof pwArg === 'string' ? pwArg : password;
    if (!identifier || !secret) {
      setError('Lütfen kullanıcı adı ve şifre giriniz.');
      return;
    }
    setError('');
    setLoading(true);
    const res = await apiLogin(identifier, secret);
    setLoading(false);
    if (!res.success) {
      setError(res.message || 'Giriş başarısız.');
      return;
    }
    if (res.user.mustChangePassword) {
      setPendingUser(res.user);
      return;
    }
    onLoginSuccess(res.user);
  };

  const handleChangePassword = async () => {
    const issues = passwordIssues(newPassword);
    if (issues.length) {
      setError(`Yeni şifre için eksik: ${issues.join(', ')}`);
      return;
    }
    if (newPassword !== newPassword2) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    setError('');
    setLoading(true);
    const res = await apiChangePassword(password, newPassword);
    setLoading(false);
    if (!res.success) {
      setError(res.message || 'Şifre değiştirilemedi.');
      return;
    }
    setPendingUser(null);
    setNewPassword('');
    setNewPassword2('');
    onLoginSuccess(res.user);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Dil seçimi: girişten önce de değiştirilebilir ve cihazda hatırlanır */}
        <LanguageBar />
        <View style={styles.heroBox}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="cover" />
          <Text style={styles.brandTitle}>GastroSync</Text>
          <Text style={styles.brandTagline}>Restoran Yönetim Sistemi</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeader}>Giriş Yap</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {pendingUser ? (
            <View>
              <View style={styles.roleInfoBox}>
                <Text style={styles.roleInfoTitle}>YENİ ŞİFRE BELİRLEYİN</Text>
                <Text style={styles.roleInfoItem}>En az 8 karakter, harf ve rakam.</Text>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>YENİ ŞİFRE</Text>
                <TextInput style={styles.textInput} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>YENİ ŞİFRE (TEKRAR)</Text>
                <TextInput style={styles.textInput} value={newPassword2} onChangeText={setNewPassword2} secureTextEntry autoCapitalize="none" />
              </View>
              <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleChangePassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Kaydet ve Devam Et</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ alignItems: 'center', marginTop: 12 }}
                onPress={() => { apiLogout(); setPendingUser(null); setPassword(''); }}
              >
                <Text style={{ color: THEME.colors.textLight, fontWeight: '600' }}>Vazgeç ve çıkış yap</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <View>
          {/* Username Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>KULLANICI ADI / E-POSTA</Text>
            <TextInput
              style={styles.textInput}
              placeholder="kullanici.adi"
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
              <Text style={styles.submitBtnText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>

          {/* Demo: yalnızca sunucu demo modundayken; dokununca o rolle doğrudan giriş yapılır */}
          {demoAccounts.length > 0 && (
            <View style={styles.demoSection}>
              <Text style={styles.demoHint}>DEMO HESAPLARI</Text>
              <View style={styles.demoGrid}>
                {[...demoAccounts]
                  .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
                  .map((acc) => (
                    <TouchableOpacity
                      key={acc.username}
                      style={styles.demoChip}
                      disabled={loading}
                      activeOpacity={0.75}
                      onPress={() => {
                        setUsername(acc.username);
                        setPassword(acc.password);
                        handleLogin(acc.username, acc.password);
                      }}
                    >
                      <View style={[styles.demoDot, { backgroundColor: ROLE_COLORS[acc.role] }]} />
                      <Text style={styles.demoChipText} numberOfLines={1}>{ROLE_LABELS[acc.role] || acc.username}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}
          </View>
          )}
        </View>

        <ServerBox onChanged={() => { setError(''); setDemoAccounts([]); setServerRev((n) => n + 1); }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Sunucu adresi: kendi sunucusunu barındıran restoranlar veya canlıya alınmadan yerel ağdaki
 * bilgisayara bağlanan demo kurulumları için. Boş bırakılırsa uygulamanın varsayılan adresi kullanılır.
 */
function ServerBox({ onChanged }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [current, setCurrent] = useState(getMobileApiBaseUrl());
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => { loadServerOverride().then(() => setCurrent(getMobileApiBaseUrl())); }, []);

  const save = async (raw) => {
    setChecking(true);
    setStatus('');
    const url = await setServerOverride(raw);
    const target = url || getMobileApiBaseUrl();
    setCurrent(target);
    let ok = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${target}/auth/demo-accounts`, { signal: ctrl.signal });
      clearTimeout(t);
      ok = res.ok;
    } catch (_) { ok = false; }
    setChecking(false);
    setStatus(ok ? 'Sunucuya bağlanıldı.' : 'Sunucuya ulaşılamadı. Adresi ve ağ bağlantısını kontrol edin.');
    if (ok) setOpen(false);
    onChanged && onChanged();
  };

  return (
    <View style={styles.serverBox}>
      <TouchableOpacity onPress={() => { setValue(getServerOverride().replace(/\/api$/, '')); setOpen(!open); }} activeOpacity={0.8}>
        <Text style={styles.serverLabel}>SUNUCU</Text>
        <Text style={styles.serverUrl} numberOfLines={1}>{current.replace(/\/api$/, '')}  ✎</Text>
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop: 10 }}>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={setValue}
            placeholder="192.168.1.36 veya https://panel.restoraniniz.com"
            placeholderTextColor={THEME.colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={[styles.serverBtn, { flex: 1 }]} onPress={() => save(value)} disabled={checking}>
              {checking ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.serverBtnTxt}>Kaydet ve Dene</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.serverBtn, styles.serverBtnGhost]} onPress={() => { setValue(''); save(''); }} disabled={checking}>
              <Text style={[styles.serverBtnTxt, { color: '#334155' }]}>Varsayılan</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {status ? <Text style={[styles.serverStatus, /ulaşılamadı/.test(status) && { color: '#b91c1c' }]}>{status}</Text> : null}
    </View>
  );
}

function LanguageBar() {
  const lang = useI18nLang();
  return (
    <View style={styles.langBar}>
      {LANGUAGES.map((l) => (
        <TouchableOpacity key={l.code} onPress={() => setI18nLang(l.code)} activeOpacity={0.8}
          style={[styles.langChip, lang === l.code && styles.langChipActive]} accessibilityLabel={l.label}>
          <Text style={[styles.langChipTxt, lang === l.code && styles.langChipTxtActive]}>{l.flag} {l.code.toUpperCase()}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  serverBox: { marginTop: 16, marginHorizontal: 4, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#d7e7dd', backgroundColor: '#ffffff' },
  serverLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#64748b' },
  serverUrl: { marginTop: 4, fontSize: 14, fontWeight: '600', color: '#0f172a' },
  serverBtn: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#047857' },
  serverBtnGhost: { backgroundColor: '#f1f5f9' },
  serverBtnTxt: { color: '#ffffff', fontWeight: '700' },
  serverStatus: { marginTop: 8, fontSize: 12, color: '#047857', fontWeight: '600' },
  langBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4, marginBottom: 4, flexWrap: 'wrap' },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#cfe3d6', backgroundColor: '#ffffff' },
  langChipActive: { backgroundColor: '#047857', borderColor: '#047857' },
  langChipTxt: { fontSize: 13, fontWeight: '700', color: '#334155' },
  langChipTxtActive: { color: '#ffffff' },
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
    marginBottom: 18,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.85)',
    marginBottom: 8,
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
    fontSize: 20,
    fontWeight: '800',
    color: '#0a1f11',
    letterSpacing: -0.3,
    marginBottom: 16,
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
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  demoChip: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7faf8',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbebe2',
    marginBottom: 8,
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
    flex: 1,
    fontSize: 12,
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
