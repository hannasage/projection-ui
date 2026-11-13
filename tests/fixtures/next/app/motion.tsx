'use client'

import { useState } from 'react'
import { Button, ButtonGroup, Slider, Tabs, Toggle } from '@hannasage/projection-ui/core'
import { MotionProvider, projectionGlide } from '@hannasage/projection-ui/motion'

export default function MotionControls() {
  const [on, setOn] = useState(false)
  const [level, setLevel] = useState(30)
  const [mode, setMode] = useState('day')
  return (
    <MotionProvider flavor={projectionGlide}>
      <Button type="button">Motion button</Button>
      <Toggle label="Motion toggle" checked={on} onChange={setOn} />
      <Slider label="Motion level" value={level} onChange={setLevel} />
      <ButtonGroup aria-label="Motion mode" value={mode} onChange={setMode} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />
      <Tabs label="Motion tabs" items={[{ value: 'one', label: 'One', content: 'First' }, { value: 'two', label: 'Two', content: 'Second' }]} />
    </MotionProvider>
  )
}
