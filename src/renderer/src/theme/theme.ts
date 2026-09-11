export const appTheme = {
  colors: {
    primary: '#17827a',
    primaryHover: '#1fa89e',
    background: '#0f1115',
    surface: '#171a21',
    surfaceRaised: '#1f232c',
    text: '#e8e8e8',
    textMuted: '#9aa0a6',
    success: '#3fb950',
    danger: '#f85149',
    warning: '#d4a72c',
    border: '#2a2f3a'
  },
  radius: '10px',
  spacing: (n: number): string => `${n * 8}px`
}

export type AppTheme = typeof appTheme
