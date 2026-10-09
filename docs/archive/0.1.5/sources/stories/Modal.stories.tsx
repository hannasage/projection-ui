import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Modal } from '../src/components/Modal'
import { Button } from '../src/components/Button'
import { withTheme } from './decorators'

const meta: Meta = {
  title:      'Components/Modal',
  decorators: [withTheme],
  tags:       ['autodocs'],
}
export default meta

function ModalDemo(): React.ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        open={open}
        title="Confirm action"
        onDismiss={() => setOpen(false)}
        actions={[
          { label: 'Cancel',  onClick: () => setOpen(false) },
          { label: 'Confirm', onClick: () => setOpen(false), variant: 'primary' },
        ]}
      >
        Are you sure you want to proceed? This action cannot be undone.
      </Modal>
    </>
  )
}

export const Default: StoryObj = { render: () => <ModalDemo /> }
