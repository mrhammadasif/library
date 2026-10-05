import { describe, expect, it } from 'vitest'
import { hexToColorName, hexToHsl } from '~/utils/ColorName'

describe('colorName', () => {
  it.each([
    ['#000000', 'black'],
    ['#FFFFFF', 'white'],
    ['#808080', 'grey'],
    ['#D32F2F', 'red'],
    ['#F57C00', 'orange'],
    ['#6D4C41', 'brown'],
    ['#FBC02D', 'yellow'],
    ['#388E3C', 'green'],
    ['#1976D2', 'blue'],
    ['#7B1FA2', 'purple'],
    ['#F48FB1', 'pink'],
    ['#E91E63', 'pink'],
  ])('%s is %s', (hex, name) => {
    expect(hexToColorName(hex)).toBe(name)
  })

  it('rejects invalid hex', () => {
    expect(hexToColorName('red')).toBeNull()
  })

  it('computes HSL', () => {
    expect(hexToHsl('#FF0000')).toEqual({ h: 0, s: 1, l: 0.5 })
  })
})
