import { DocsContainer, type DocsContainerProps } from '@storybook/blocks'
import { useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { GLOBALS_UPDATED } from 'storybook/internal/core-events'
import { coastalDocsTheme, projectionDocsTheme } from './projection-theme'
import { applyPreviewTheme } from './PreviewTheme'

/** Generated code and Canvas viewports need named keyboard scroll targets. */
export function DocumentationContainer(props: PropsWithChildren<DocsContainerProps>) {
  const [theme, setTheme] = useState<unknown>(() => {
    const firstStory = props.context.componentStories()[0]
    if (firstStory) return props.context.getStoryContext(firstStory).globals.theme
    const globals = new URLSearchParams(window.location.search).get('globals') ?? ''
    return globals.split(';').find(value => value.startsWith('theme:'))?.slice(6) ?? 'dark'
  })
  useEffect(() => {
    const update = ({ globals }: { globals: Record<string, unknown> }) => setTheme(globals.theme)
    props.context.channel.on(GLOBALS_UPDATED, update)
    return () => { props.context.channel.off(GLOBALS_UPDATED, update) }
  }, [props.context.channel])
  useEffect(() => applyPreviewTheme(theme), [theme])
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
  return <div ref={scope}><DocsContainer {...props} theme={String(theme).startsWith('light') ? coastalDocsTheme : projectionDocsTheme} /></div>
}
