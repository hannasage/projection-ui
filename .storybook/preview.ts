import type { Preview } from '@storybook/react'
import '@hannasage/projection-ui/styles'
import './docs.css'
import { DocumentationPage } from './DocumentationPage'
import { DocumentationContainer } from './DocumentationContainer'
import { projectionDocsTheme } from './projection-theme'

const preview: Preview = {
  parameters: {
    docs: { theme: projectionDocsTheme, page: DocumentationPage, container: DocumentationContainer },
    layout: 'padded',
    options: {
      storySort: { order: ['Guides', ['Introduction', 'Installation', 'Theming', 'Tokens', 'Accessibility', 'Migration', 'Releases', 'Community'], 'Foundations', 'Components', 'Forms', 'Charts'] },
    },
  },
}
export default preview
