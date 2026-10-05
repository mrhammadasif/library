export type ColorName =
  | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'brown' | 'black' | 'white' | 'grey' | 'multi'

/** Swatches for the colour filter/picker. Must match the color_name enum. */
export const BOOK_COLORS: { name: ColorName, label: string, swatch: string }[] = [
  { name: 'red', label: 'Red', swatch: '#D64535' },
  { name: 'orange', label: 'Orange', swatch: '#EC8A2F' },
  { name: 'yellow', label: 'Yellow', swatch: '#F2C94C' },
  { name: 'green', label: 'Green', swatch: '#3E9B5F' },
  { name: 'blue', label: 'Blue', swatch: '#3570C4' },
  { name: 'purple', label: 'Purple', swatch: '#7D52B8' },
  { name: 'pink', label: 'Pink', swatch: '#E57AA6' },
  { name: 'brown', label: 'Brown', swatch: '#8A5A3B' },
  { name: 'black', label: 'Black', swatch: '#222222' },
  { name: 'white', label: 'White', swatch: '#F4F1EA' },
  { name: 'grey', label: 'Grey', swatch: '#9A9A9A' },
  { name: 'multi', label: 'Multi', swatch: '#B0A0D0' },
]
