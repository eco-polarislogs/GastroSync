/**
 * GastroSync Unified Design Tokens (Tek Doğruluk Kaynağı - Single Source of Truth)
 * Bu dosyadaki herhangi bir renk, buton veya arayüz token'ı değiştirildiğinde
 * hem Web Sitesi (React) hem Mobil Uygulama (iOS & Android) otomatik olarak güncellenir.
 */

export const THEME = {
  // Marka & Buton Renkleri (Değiştirildiğinde Web ve Mobil aynı renge bürünür)
  // Keyvo Estetiği: Koyu orman yeşili sidebar, berrak nane/beyaz kartlar, neon/lime yeşil vurgular
  colors: {
    primary: '#0a1f11',        // Ana marka ve eylem butonu (Koyu Orman Yeşili / Keyvo Dark Forest)
    primaryHover: '#143820',   // Buton basılma / hover
    primaryText: '#ffffff',    // Beyaz yazı
    
    accent: '#10b981',         // Keyvo Yeşil / Kâr / Pozitif durum (#10b981 - #12b76a)
    accentLight: '#dcfce7',    // Nane yeşili hafif arka plan
    accentText: '#064e3b',     // Nane üzerinde koyu yeşil yazı
    
    lime: '#22c55e',           // Canlı Açık Yeşil vurgu
    limeBg: '#bbf7d0',         // Rozet açık zemin
    
    danger: '#ef4444',         // Fire / Zayiat / Tehlike butonu
    dangerBg: '#fee2e2',
    dangerText: '#991b1b',
    
    warning: '#f59e0b',
    warningBg: '#fef3c7',
    warningText: '#92400e',

    // Zemin ve Kartlar (Keyvo Temiz / Berrak Kurumsal Tema)
    background: '#f2f8f4',     // Berrak Açık Nane & Gri Arka Plan (Mint Canvas)
    surface: '#ffffff',        // Bembeyaz, tertemiz kartlar
    surfaceHover: '#f8faf9',   // Hafif gri-yeşil hover
    surfaceAlt: '#eef6f0',     // Kart içi ikincil blok zemini
    border: '#dbe7df',         // İnce kurumsal kenarlık
    borderLight: '#eef4f0',
    
    // Sidebar (Keyvo Koyu Orman Yeşili)
    sidebarBg: '#081c0f',
    sidebarHover: '#112f1b',
    sidebarActive: '#1b4327',
    sidebarText: '#98bfa2',
    sidebarTextActive: '#ffffff',
    
    // Tipografi Renkleri
    textPrimary: '#0f172a',    // Net, okunabilir koyu gri/siyah
    textSecondary: '#475569',  // Açıklayıcı metin
    textMuted: '#64748b',      // Yardımcı bilgi
    textLight: '#94a3b8',
  },
  
  // Ortak Radyus & Köşelik Standartları (Keyvo modern yuvarlatılmış kartlar)
  radii: {
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
    full: 9999,
  },
  
  // Buton Padding Standartları
  button: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    fontWeight: '700',
    fontSize: 14,
  }
};
