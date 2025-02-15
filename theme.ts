export const colorsArray = [
  'accent',
  'secondary',
  'primary',
  'info',
  'success',
  'error',
  'transparent',
]

export const colors = {
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    light: '#e5e5e5',
    dark: '#404040',
  },
  accent: {
    light: '#EF3D23',
    DEFAULT: 'var(--eg-accent)',
    dark: '#E06A4D',
  },
  primary: {
    light: '#1d3557',
    DEFAULT: 'var(--eg-primary)',
    dark: '#00628F',
  },
  secondary: {
    light: '#00628F',
    DEFAULT: 'var(--eg-primary)',
    dark: '#618FB4',
  },
  bg: {
    light: '#E8E5E2',
    DEFAULT: 'var(--eg-bg)',
    dark: '#262626',
  },
  error: {
    light: '#EF3D23',
    DEFAULT: 'var(--eg-error)',
    dark: '#EF3D23',
  },
  info: {
    light: '#2196F3',
    DEFAULT: 'var(--eg-info)',
    dark: '#2196F3',
  },
  success: {
    light: '#28C76F',
    DEFAULT: 'var(--eg-success)',
    dark: '#28C76F',
  },
  text: {
    light: '#222222',
    DEFAULT: 'var(--eg-text)',
    dark: '#f0f0f0',
  },
} as const
