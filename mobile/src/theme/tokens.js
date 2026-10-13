/**
 * GastroSync Unified Design Tokens (Mobil Eşleşmesi)
 * src/theme/tokens.js ile birebir senkronize tasarım katmanı.
 */

export const THEME = {
  colors: {
    primary: '#0a1f11',        // Koyu Orman Yeşili / Keyvo Dark Forest
    primaryHover: '#143820',
    primaryText: '#ffffff',
    
    accent: '#10b981',         // Keyvo Yeşili
    accentText: '#ffffff',
    accentLight: '#dcfce7',
    
    danger: '#ef4444',         // Fire butonu
    dangerText: '#ffffff',
    
    background: '#f2f8f4',     // Nane zemin
    surface: '#ffffff',        // Beyaz kartlar
    surfaceHover: '#f8faf9',
    surfaceAlt: '#eef6f0',
    border: '#dbe7df',
    
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    textLight: '#94a3b8',
  },
  
  radii: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    full: 9999,
  },
  
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontWeight: '800',
    fontSize: 14,
  }
};
