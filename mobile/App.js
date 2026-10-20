import React, { useState } from 'react';
import { Platform, View, StyleSheet, TouchableOpacity, Text, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import IOSApp from './src/ios/IOSApp';
import AndroidApp from './src/android/AndroidApp';
import MobileLogin from './src/components/MobileLogin';
import { THEME } from './src/theme/tokens';

import { DEMO_USERS } from './src/data/inventoryData';

function MainApp() {
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  const handleLogout = () => {
    setAuthenticatedUser(null);
  };

  // Cihazın işletim sistemi donanım düzeyinde otomatik algılanır (iOS ise iOS, Android ise Android)
  const isIOS = Platform.OS === 'ios';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.headerBg} translucent={false} />

      {/* Uygulama Ekranı */}
      <View style={styles.appContainer}>
        {!authenticatedUser ? (
          <MobileLogin onLoginSuccess={(user) => setAuthenticatedUser(user)} />
        ) : isIOS ? (
          <IOSApp initialUser={authenticatedUser} onLogout={handleLogout} />
        ) : (
          <AndroidApp initialUser={authenticatedUser} onLogout={handleLogout} />
        )}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
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
