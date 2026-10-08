import { DEFAULT_THEME } from '@hannasage/projection-ui/foundations'
import { Card, ThemeProvider } from '@hannasage/projection-ui/core'
import Controls from './controls'

export default function Page() {
  return <ThemeProvider theme={DEFAULT_THEME}><Card><h1>Next packed server page</h1><Controls /></Card></ThemeProvider>
}
