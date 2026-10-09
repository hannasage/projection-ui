import type { Meta, StoryObj } from '@storybook/react'
import { RadioGroup } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'
const meta: Meta<typeof RadioGroup> = { title: 'Components/RadioGroup', component: RadioGroup, decorators: [withTheme], tags: ['autodocs'] }
export default meta
export const Default: StoryObj = { render: () => <RadioGroup label="Density" defaultValue="comfortable" options={[{value:"compact",label:"Compact"},{value:"comfortable",label:"Comfortable"}]} /> }
