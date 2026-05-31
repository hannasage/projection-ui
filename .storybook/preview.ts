import type { Preview } from '@storybook/react'
import '../src/tokens/theme.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark',  value: '#07090C' },
        { name: 'light', value: '#f6f8fa' },
      ],
    },
    layout: 'padded',
  },
}

export default preview
