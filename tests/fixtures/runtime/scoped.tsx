import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, Prose, Button } from '@hannasage/projection-ui/core'
import { DEFAULT_THEME } from '@hannasage/projection-ui/foundations'
import '@hannasage/projection-ui/styles'

createRoot(document.getElementById('root')!).render(<>
  <button type="button">Outside</button>
  <ThemeProvider theme={DEFAULT_THEME} style={{'--ui-primary':'#00ff00','--ui-font':'serif'} as React.CSSProperties}>
    <Button>Outer</Button><Prose>Outer text</Prose>
    <ThemeProvider theme={{...DEFAULT_THEME,primary:'#FF5252'}}><Button>Inner</Button></ThemeProvider>
  </ThemeProvider>
</>)
