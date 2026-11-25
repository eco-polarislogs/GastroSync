import React, { useEffect, useState } from 'react';
import {
  Platform,
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Text } from './src/i18n';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import IOSApp from './src/ios/IOSApp';
import AndroidApp from './src/android/AndroidApp';
import MobileLogin from './src/components/MobileLogin';
import { THEME } from './src/theme/tokens';

import { apiLogout, apiRestoreSession } from './src/services/api';
import { onSessionExpired } from './src/services/mobileAxiosClient';

function MainApp() {
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [restoring, setRestoring] = useState(true);

  // Açılışta kayıtlı oturumu geri yükle: Android uygulamayı arka planda kapatsa da yeniden giriş gerekmez
  useEffect(() => {
    let alive = true;
    apiRestoreSession()
      .then((user) => { if (alive && user && !user.mustChangePassword) handleLoginSuccess(user); })
      .catch(() => {})
      .finally(() => { if (alive) setRestoring(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    apiLogout();
    setAuthenticatedUser(null);
  };

  // Sunucu oturumu geçersiz kıldığında (401: süre doldu, hesap pasif, şifre değişti) girişe dön
  useEffect(() => onSessionExpired(() => setAuthenticatedUser(null)), []);

  const handleLoginSuccess = (user) => {
    if (!user) return;
    const normalizedUser = {
      ...user,
      role: (user.role || '').toLowerCase(),
    };
    setAuthenticatedUser(normalizedUser);
  };

  // Cihazın işletim sistemi donanım düzeyinde otomatik algılanır (iOS ise iOS, Android ise Android)
  const isIOS = Platform.OS === 'ios';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.headerBg} translucent={false} />

      {/* Uygulama Ekranı */}
      <View style={styles.appContainer}>
        {restoring && !authenticatedUser ? (
          <View style={styles.restoring}>
            <ActivityIndicator size="large" color="#047857" />
            <Text style={styles.restoringText}>Oturum açılıyor…</Text>
          </View>
        ) : !authenticatedUser ? (
          <MobileLogin onLoginSuccess={handleLoginSuccess} />
        ) : isIOS ? (
          <IOSApp initialUser={authenticatedUser} onLogout={handleLogout} />
        ) : (
          <AndroidApp initialUser={authenticatedUser} onLogout={handleLogout} />
        )}
      </View>
    </View>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <MainApp />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  restoring: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f9f5', gap: 12 },
  restoringText: { color: '#475569', fontSize: 15, fontWeight: '600' },
  root: {
    flex: 1,
    backgroundColor: THEME.colors.headerBg,
  },
  switchBar: {
    backgroundColor: THEME.colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.2)',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    backgroundColor: THEME.colors.accent,
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    color: '#07190e',
    fontWeight: '900',
    fontSize: 11,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#0a1f11',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#153d24',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: THEME.colors.accent,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#96be9f',
  },
  toggleTextActive: {
    color: '#07190e',
  },
  appContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});
