// Dinamik Expo yapılandırması: temel ayarlar app.json'dadır.
//
// GASTROSYNC_LOCAL_DEMO=1 yalnızca yerel demo APK'sı içindir: telefon backend'e USB (adb reverse) veya
// yerel ağ üzerinden http://localhost:8080 ile bağlanabilsin diye şifresiz HTTP'ye izin verilir.
// Google Play / mağaza derlemesinde bu değişken tanımlanmaz; uygulama yalnızca HTTPS sunucuya bağlanır.
module.exports = ({ config }) => {
  const plugins = (config.plugins || []).filter(
    (p) => p !== 'expo-build-properties' && !(Array.isArray(p) && p[0] === 'expo-build-properties'),
  );
  const localDemo = process.env.GASTROSYNC_LOCAL_DEMO === '1';
  plugins.push(['expo-build-properties', { android: { usesCleartextTraffic: localDemo } }]);
  return { ...config, plugins };
};
