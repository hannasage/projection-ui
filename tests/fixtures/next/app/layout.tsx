import type { ReactNode } from 'react'
import '@hannasage/projection-ui/styles'
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
