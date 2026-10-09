'use client';
import { useTheme } from 'fumadocs-ui/provider/base';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

export function Example({ id, title }: { id: string; title: string }) {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const theme = mounted && resolvedTheme === 'light' ? 'light' : 'dark';
  const globals = encodeURIComponent(`theme:${theme}`);
  const component = title.split(':')[0];
  const heights: Record<string, number> = { Button:128, Badge:128, Card:180, ButtonGroup:180, LinkButton:128, Separator:128, VisuallyHidden:128, Input:180, Select:180, Textarea:248, Toggle:144, Slider:160 };
  return <section className="component-example" aria-label={title}>
    <h3>{title}</h3>
    {mounted && resolvedTheme ? <iframe title={title} src={`/examples/iframe.html?id=${encodeURIComponent(id)}&viewMode=story&globals=${globals}`} loading="lazy" style={{height:heights[component]??520}} /> : <div role="status" style={{height:heights[component]??520}}>Loading example…</div>}
    <a href={`/examples/?path=/story/${encodeURIComponent(id)}&globals=${globals}`}>Open {title} in the component explorer</a>
  </section>;
}
