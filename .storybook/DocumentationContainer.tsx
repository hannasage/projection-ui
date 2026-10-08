import { DocsContainer, type DocsContainerProps } from '@storybook/blocks'
import { useEffect, useRef, type PropsWithChildren } from 'react'

/** Generated code and Canvas viewports need named keyboard scroll targets. */
export function DocumentationContainer(props: PropsWithChildren<DocsContainerProps>) {
  const scope = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = scope.current
    if (!root) return
    const connectViewports = () => {
      for (const viewport of root.querySelectorAll<HTMLElement>('[data-radix-scroll-area-viewport]')) {
        viewport.tabIndex = 0
        viewport.setAttribute('role', 'region')
        viewport.setAttribute('aria-label', 'Code example')
      }
      for (const viewport of root.querySelectorAll<HTMLElement>('.docs-story > div:first-child')) {
        const name = viewport.querySelector('[data-name]')?.getAttribute('data-name')
        viewport.tabIndex = 0
        viewport.setAttribute('role', 'region')
        viewport.setAttribute('aria-label', name ? `Component preview: ${name}` : 'Component preview')
      }
    }
    connectViewports()
    const observer = new MutationObserver(connectViewports)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return <div ref={scope}><DocsContainer {...props} /></div>
}
