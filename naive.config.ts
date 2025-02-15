import type { GlobalThemeOverrides } from 'naive-ui'
import type { NuxtConfig } from 'nuxt/config'
import { colors } from './theme'

const commonValues: GlobalThemeOverrides = {
  common: {
    borderRadius: '4px',
    borderRadiusSmall: '2px',
  },
  Input: {
    boxShadowFocus: '0 0 0 2px rgba(0,0,0,0.04)',
    placeholderColor: 'transparent',
  },
  Drawer: {
    bodyPadding: '0',
    headerPadding: '0',
    footerPadding: '0',
  },
  Tabs: { tabFontWeightActive: 'bold' },

}

const lightThemeOverrides: GlobalThemeOverrides = {
  ...commonValues,
  common: {
    primaryColor: colors.primary.light,
    primaryColorPressed: colors.primary.light,
    primaryColorHover: colors.primary.dark,
    primaryColorSuppl: colors.primary.dark,
    errorColor: colors.accent.light,
    errorColorPressed: colors.accent.light,
    errorColorHover: colors.accent.dark,
    errorColorSuppl: colors.accent.dark,
  },
  Input: {
    borderFocus: `1px solid ${colors.primary.light}`,
    boxShadowFocusError: `0 0 0 2px ${colors.accent.light}`,
  },
  Tabs: {
    ...commonValues.Tabs,
    tabTextColorActiveCard: colors.text.light,
    tabBorderColor: 'rgba(0,0,0, 0.4)',
    tabColor: 'rgba(0,0,0, 0.1)',
    tabTextColorCard: 'rgba(0,0,0,0.5)',
  },

}

const darkThemeOverrides: GlobalThemeOverrides = {
  ...commonValues,
  common: {
    // textColorBase: '#fff',
    primaryColor: colors.primary.dark,
    primaryColorPressed: colors.info.dark,
    primaryColorHover: colors.info.light,
    primaryColorSuppl: colors.info.light,
    errorColor: colors.accent.dark,
    errorColorPressed: colors.accent.dark,
    errorColorHover: colors.accent.light,
    errorColorSuppl: colors.accent.light,
  },
  Button: {
    textColorGhost: '#ddd',
    textColorGhostHover: '#fff',
    textColor: '#ffffff',
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    borderHover: '1px solid #fff',
  },
  Input: {
    borderFocus: `1px solid ${colors.primary.dark}`,
    boxShadowFocusError: `0 0 0 2px ${colors.accent.dark}`,
  },
  Tabs: {
    ...commonValues.Tabs,
    tabTextColorActiveCard: '#ffffff',
    tabTextColorActiveLine: '#ffffff',
    tabBorderColor: colors.gray['500'],
    tabColor: colors.gray['700'],
    tabTextColorCard: colors.gray['400'],
    barColor: '#f00',
  },

  Checkbox: { checkMarkColor: 'white' },
}

export default () => (<NuxtConfig['naiveui']> {
  themeConfig: {
    dark: darkThemeOverrides,
    light: lightThemeOverrides,
  },
})
