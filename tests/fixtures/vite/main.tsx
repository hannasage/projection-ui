import React from 'react'
import { createRoot } from 'react-dom/client'
import { Button, Container, Prose, ThemeProvider } from '@hannasage/projection-ui/core'
import { DEFAULT_THEME } from '@hannasage/projection-ui/foundations'
import '@hannasage/projection-ui/styles'

createRoot(document.getElementById('root')!).render(<ThemeProvider theme={DEFAULT_THEME}><Container><Prose><h1>Vite packed consumer</h1><Button>Continue</Button></Prose></Container></ThemeProvider>)
