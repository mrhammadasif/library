/** Mirrors the @theme tokens in global.css for places that need raw values (icons, charts, svg). */
export const Colors = {
  canvas: '#F7F4EE',
  card: '#FFFFFF',
  line: '#EBE5DA',
  walnut: '#2B211A',
  walnutSoft: '#3D3027',
  primary: '#2F5D50',
  primarySoft: '#E3EEE9',
  ink: '#1F1A14',
  muted: '#6F665C',
  faint: '#A39A8F',
  positive: '#2E7D4F',
  negative: '#C2412D',
  warn: '#C98A12',
} as const

/** Appends an alpha channel to a #RRGGBB colour, e.g. for tinted icon backgrounds. */
export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
}
