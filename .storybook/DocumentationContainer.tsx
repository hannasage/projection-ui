import { DocsContainer, type DocsContainerProps } from '@storybook/blocks'
import { useEffect, useRef, type PropsWithChildren } from 'react'

/** Storybook's generated code viewports need a named keyboard scroll target. */
export function DocumentationContainer(props: PropsWithChildren<DocsContainerProps>) {
  const scope = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = scope.current
    if (!root) return
    const connectCodeViewports = () => {
      for (const viewport of root.querySelectorAll<HTMLElement>('[data-radix-scroll-area-viewport]')) {
        viewport.tabIndex = 0
        viewport.setAttribute('role', 'region')
        viewport.setAttribute('aria-label', 'Code example')
      }
    }
    connectCodeViewports()
    const observer = new MutationObserver(connectCodeViewports)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return <div ref={scope}><DocsContainer {...props} /></div>
}
