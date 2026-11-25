// Google Play yükleme anahtarıyla release imzası (Expo config plugin).
//
// android/ klasörü Expo tarafından üretildiği için build.gradle elle düzenlenmez; bu eklenti
// release imza ayarını ekler. Anahtar bilgileri koda yazılmaz, derleme anında ortam
// değişkenlerinden okunur:
//   GASTROSYNC_UPLOAD_KEYSTORE   .jks dosyasının tam yolu
//   GASTROSYNC_UPLOAD_PROPERTIES key.properties dosyasının tam yolu (storePassword, keyPassword, keyAlias)
// Değişkenler yoksa (yerel demo APK) release eskisi gibi debug anahtarıyla imzalanır.
// EAS bulut derlemesinde imzayı EAS yönetir; bu eklenti o durumda etkisizdir.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// gastrosync-release-signing';

const SIGNING_BLOCK = `
        release {
            ${MARKER}
            def ksFile = System.getenv('GASTROSYNC_UPLOAD_KEYSTORE')
            def propsFile = System.getenv('GASTROSYNC_UPLOAD_PROPERTIES')
            if (ksFile && propsFile && file(ksFile).exists() && file(propsFile).exists()) {
                def p = new Properties()
                file(propsFile).withInputStream { p.load(it) }
                storeFile file(ksFile)
                storePassword p['storePassword']
                keyAlias p['keyAlias']
                keyPassword p['keyPassword']
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

const CMAKE_MARKER = '// gastrosync-cmake-staging';
// Windows'ta C++ derleme yolları 260 karakteri aşar: GASTROSYNC_CMAKE_STAGING (ör. C:/x) verilirse
// CMake ara dosyaları o kısa klasöre yazılır. Değişken yoksa (Linux / EAS) etkisizdir.
const CMAKE_BLOCK = `
    ${CMAKE_MARKER}
    def gsCmakeStaging = System.getenv('GASTROSYNC_CMAKE_STAGING')
    if (gsCmakeStaging) { externalNativeBuild { cmake { buildStagingDirectory = file(gsCmakeStaging) } } }
`;

function applyCmakeStaging(gradle) {
  if (gradle.includes(CMAKE_MARKER)) return gradle;
  const m = gradle.match(/\nandroid \{\n/);
  if (!m) return gradle;
  const at = m.index + m[0].length;
  return gradle.slice(0, at) + CMAKE_BLOCK + gradle.slice(at);
}

function applySigning(gradle) {
  gradle = applyCmakeStaging(gradle);
  if (gradle.includes(MARKER)) return gradle;
  // signingConfigs { debug { ... } } bloğunun sonuna release ekle
  const sc = gradle.indexOf('signingConfigs {');
  if (sc < 0) throw new Error('withReleaseSigning: signingConfigs bloğu bulunamadı');
  const debugStart = gradle.indexOf('debug {', sc);
  const debugEnd = gradle.indexOf('}', debugStart);
  let out = gradle.slice(0, debugEnd + 1) + SIGNING_BLOCK + gradle.slice(debugEnd + 1);
  // release buildType debug imzası yerine release imzasını kullansın
  const bt = out.indexOf('buildTypes {');
  const rel = out.indexOf('release {', bt);
  const relSig = out.indexOf('signingConfig signingConfigs.debug', rel);
  if (rel > 0 && relSig > 0) {
    out = out.slice(0, relSig) + 'signingConfig signingConfigs.release' + out.slice(relSig + 'signingConfig signingConfigs.debug'.length);
  }
  return out;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.applySigning = applySigning;
