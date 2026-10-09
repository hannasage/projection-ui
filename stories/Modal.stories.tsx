import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Modal } from '@hannasage/projection-ui/core'
import { Button } from '@hannasage/projection-ui/core'
import { withTheme } from './decorators'

const meta: Meta<typeof Modal> = { parameters: { docs: { description: { component: 'Import from `@hannasage/projection-ui/core`. This entry requires React and React DOM. Read the [component contracts](https://github.com/hannasage/projection-ui/blob/831d9aecaca2bcff1c4ea55d85a85636453f1982/docs/components.md) for required props and interaction behavior.' } } },
  component: Modal,
  title:      'Components/Modal',
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

function ModalDemo(): React.ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        open={open}
        title="Save example preferences"
        onDismiss={() => setOpen(false)}
        actions={[
          { label: 'Cancel',  onClick: () => setOpen(false) },
          { label: 'Confirm', onClick: () => setOpen(false), variant: 'primary' },
        ]}
      >
        Save the preferences for this local example?
      </Modal>
    </>
  )
}

export const Default: StoryObj = { render: () => <ModalDemo /> }
