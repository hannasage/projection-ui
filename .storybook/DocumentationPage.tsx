import { Description, Primary, Stories, Subtitle, Title, useOf } from '@storybook/blocks'

import contractsData from '../docs/component-contracts.json'
const contracts: Record<string, string[]> = contractsData

/** Authored contracts remain available when packed JavaScript has no docgen metadata. */
function ComponentContract() {
  const resolved = useOf('meta', ['meta'])
  const name = resolved.preparedMeta.title.split('/').pop() ?? ''
  const contract = contracts[name]
  if (!contract) return null
  return <section aria-label={`${name} API`}>
    <h2>Component contract</h2>
    <table><thead><tr><th scope="col">Required props</th><th scope="col">Options and defaults</th></tr></thead>
      <tbody><tr><td>{contract[0]}</td><td>{contract[1]}</td></tr></tbody></table>
    <p><a href="https://github.com/hannasage/projection-ui/blob/831d9aecaca2bcff1c4ea55d85a85636453f1982/docs/components.md">Read the full component reference</a> for value choices and interaction behavior.</p>
  </section>
}

export function DocumentationPage() {
  return <><Title /><Subtitle /><Description /><Primary /><ComponentContract /><Stories /></>
}
