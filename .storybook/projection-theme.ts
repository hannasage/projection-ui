import { create } from '@storybook/theming'

export const projectionDocsTheme = create({
  base: 'dark',
  brandTitle: 'Projection UI',
  brandUrl: '?path=/docs/guides-introduction--docs',
  brandTarget: '_self',
  fontBase: "'IBM Plex Sans', sans-serif",
  fontCode: "'IBM Plex Mono', monospace",
  colorPrimary: '#C9F53A',
  colorSecondary: '#C9F53A',
  appBg: '#07090C',
  appContentBg: '#07090C',
  appPreviewBg: '#07090C',
  appBorderColor: '#1B2535',
  textColor: '#DDE3EE',
  textInverseColor: '#07090C',
  barTextColor: '#8396AB',
  barSelectedColor: '#C9F53A',
  barBg: '#0D1117',
  inputBg: '#0D1117',
  inputBorder: '#1B2535',
  inputTextColor: '#DDE3EE',
})

export const coastalDocsTheme = create({
  ...projectionDocsTheme,
  base: 'light',
  colorPrimary: '#006A85', colorSecondary: '#006A85',
  appBg: '#F1F8FC', appContentBg: '#FFFFFF', appPreviewBg: '#F1F8FC',
  appBorderColor: '#B7CFDD', textColor: '#172B3A', textInverseColor: '#FFFFFF',
  barTextColor: '#465F70', barSelectedColor: '#006A85', barBg: '#FFFFFF',
  inputBg: '#FFFFFF', inputBorder: '#B7CFDD', inputTextColor: '#172B3A',
})
