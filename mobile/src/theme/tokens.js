/**
 * GastroSync Unified Design Tokens (Mobil Eşleşmesi)
 * Web arayüzü ile birebir senkronize Mint & Forest Green teması.
 */

export const THEME = {
  colors: {
    // Primary - Web sitesinin Koyu Orman Yeşili / Deep Forest
    primary: '#0a1f11',
    primaryDark: '#06150b',
    primaryLight: '#163e23',
    primaryBg: 'rgba(10, 31, 17, 0.06)',

    // Accent - Emerald & Canlı Nane Yeşili
    accent: '#10b981',
    accentDark: '#059669',
    accentLight: '#34d399',
    accentBg: '#dcfce7',
    mintSubtle: '#edf7f0',

    // Semantic Colors
    success: '#10b981',
    successBg: '#dcfce7',
    warning: '#f59e0b',
    warningBg: '#fef3c7',
    danger: '#ef4444',
    dangerBg: '#fee2e2',

    // Backgrounds & Surfaces (Web ile birebir: Açık Ferah Mint Zemin + Beyaz Kartlar)
    background: '#f2f7f4',
    surface: '#ffffff',
    surfaceHover: '#f9fbf9',
    surfaceAlt: '#eef6f0',
    border: '#dbe7df',
    borderLight: '#e8f0ea',

    // Typography
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    textLight: '#94a3b8',
    textWhite: '#ffffff',

    // Topbar & Navigation (Web GastroSync stili)
    headerBg: '#07190e',
    headerText: '#ffffff',
    headerSub: '#96be9f',
  },

  radii: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  shadows: {
    card: {
      shadowColor: '#0a1f11',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    primaryBtn: {
      shadowColor: '#10b981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};
