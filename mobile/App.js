import React, { useState } from 'react';
import { Platform, View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import IOSApp from './src/ios/IOSApp';
import AndroidApp from './src/android/AndroidApp';

export default function App() {
  // Varsayılan olarak gerçek platformu algılar (iOS veya Android),
  // ancak test ve inceleme amacıyla kullanıcıya canlı platform değiştirici de sunar.
  const [platformMode, setPlatformMode] = useState(Platform.OS === 'ios' ? 'ios' : 'android');

  return (
    <View style={styles.root}>
      {/* Platform Switcher Switcher Header (Universal Test Desteği) */}
      <SafeAreaView style={styles.switchBar}>
        <View style={styles.switchRow}>
          <Text style={styles.switchTitle}>GastroSync Mobile Test Modu:</Text>
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleBtn, platformMode === 'ios' && styles.toggleActive]}
              onPress={() => setPlatformMode('ios')}
            >
              <Text style={[styles.toggleText, platformMode === 'ios' && styles.toggleTextActive]}>
                🍎 iOS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, platformMode === 'android' && styles.toggleActive]}
              onPress={() => setPlatformMode('android')}
            >
              <Text style={[styles.toggleText, platformMode === 'android' && styles.toggleTextActive]}>
                🤖 Android
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Seçilen Platformun Özel Arayüzü */}
      <View style={styles.appContainer}>
        {platformMode === 'ios' ? <IOSApp /> : <AndroidApp />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  switchBar: {
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  switchTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa',
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#09090b',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: '#f59e0b',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a',
  },
  toggleTextActive: {
    color: '#000000',
  },
  appContainer: {
    flex: 1,
  },
});
