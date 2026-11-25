import React from 'react';
import { Modal, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * React Native Modal'ın güvenli alan uyumlu hâli.
 *
 * Android 15+ (hedef API 35/36) uygulamaları kenardan kenara çizer: alttan açılan sayfaların
 * düğmeleri sistem gezinme çubuğunun altında kalır. Alttan açılan (animationType="slide")
 * sayfaların altına gezinme çubuğu yüksekliği kadar beyaz boşluk eklenir; ortada açılan
 * pencereler etkilenmez.
 */
export default function SafeModal({ children, animationType, ...rest }) {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'android' && animationType === 'slide' ? insets.bottom : 0;
  return (
    <Modal animationType={animationType} statusBarTranslucent navigationBarTranslucent {...rest}>
      {bottom > 0 ? (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>{children}</View>
          <View style={{ height: bottom, backgroundColor: '#fff' }} />
        </View>
      ) : children}
    </Modal>
  );
}
