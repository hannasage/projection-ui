import type { Preview } from '@storybook/react'
import '@hannasage/projection-ui/styles'
import './docs.css'
import { DocumentationPage } from './DocumentationPage'
import { DocumentationContainer } from './DocumentationContainer'
import { projectionDocsTheme } from './projection-theme'
import { withPreviewTheme } from './PreviewTheme'

const preview: Preview = {
  decorators: [withPreviewTheme],
  initialGlobals: { theme: 'dark' },
  globalTypes: {
    theme: {
      description: 'Component appearance',
      toolbar: {
        title: 'Theme', icon: 'paintbrush', dynamicTitle: true,
        items: [
          { value: 'dark', title: 'Projection · Dark' },
          { value: 'light', title: 'Coastal Day · Light' },
          { value: 'dark-flat', title: 'Projection Flat · Dark' },
          { value: 'light-flat', title: 'Coastal Day Flat · Light' },
        ],
      },
    },
  },
  parameters: {
    docs: { theme: projectionDocsTheme, page: DocumentationPage, container: DocumentationContainer },
    layout: 'padded',
    controls: { expanded: true, sort: 'requiredFirst', disableSaveFromUI: true },
    viewport: {
      viewports: {
        phone: { name: 'Phone · 390px', styles: { width: '390px', height: '844px' }, type: 'mobile' },
        tablet: { name: 'Tablet · 768px', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
        desktop: { name: 'Desktop · 1440px', styles: { width: '1440px', height: '900px' }, type: 'desktop' },
      },
    },
    backgrounds: { disable: true },
    options: {
      storySort: { order: ['Guides', ['Introduction', 'Installation', 'Theming', 'Tokens', 'Accessibility', 'Migration', 'Releases', 'Community'], 'Foundations', 'Components', 'Forms', 'Charts'] },
    },
  },
}
export default preview
