'use client'

import { useState } from 'react'
import { Toggle } from '@hannasage/projection-ui/core'
export default function Controls() {
  const [checked, setChecked] = useState(false)
  return <Toggle label="Enable updates" checked={checked} onChange={setChecked} />
}
