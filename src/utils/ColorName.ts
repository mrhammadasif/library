import type { ColorName } from '~/constants/BookColors'

/** HSL of a #RRGGBB colour: h in [0, 360), s and l in [0, 1]. */
export function hexToHsl(hex: string): { h: number, s: number, l: number } {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) {
    return { h: 0, s: 0, l }
  }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0)
  }
  else if (max === g) {
    h = (b - r) / d + 2
  }
  else {
    h = (r - g) / d + 4
  }
  return { h: h * 60, s, l }
}

/** Buckets a cover's dominant colour into a searchable colour name. */
export function hexToColorName(hex: string): ColorName | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    return null
  }
  const { h, s, l } = hexToHsl(hex)
  if (l < 0.13) {
    return 'black'
  }
  if (l > 0.9) {
    return 'white'
  }
  if (s < 0.15) {
    return l > 0.75 ? 'white' : l < 0.22 ? 'black' : 'grey'
  }
  // Dark, desaturated oranges/reds read as brown on a shelf.
  if (h >= 15 && h < 40 && l < 0.45) {
    return 'brown'
  }
  if (h < 15 || h >= 345) {
    return l > 0.7 ? 'pink' : 'red'
  }
  if (h < 40) {
    return 'orange'
  }
  if (h < 70) {
    return 'yellow'
  }
  if (h < 170) {
    return 'green'
  }
  if (h < 255) {
    return 'blue'
  }
  if (h < 300) {
    return 'purple'
  }
  return 'pink'
}
