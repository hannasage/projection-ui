export function Example({ id, title }: { id: string; title: string }) {
  const component = title.split(':')[0];
  const heights: Record<string, number> = { Button:128, Badge:128, Card:180, ButtonGroup:180, LinkButton:128, Separator:128, VisuallyHidden:128, Input:180, Select:180, Textarea:248, Toggle:144, Slider:160 };
  return <section className="component-example" aria-label={title}>
    <h3>{title}</h3>
    <iframe title={title} src={`/examples/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`} loading="lazy" style={{height:heights[component]??520}} />
    <a href={`/examples/?path=/story/${encodeURIComponent(id)}`}>Open {title} in the component explorer</a>
  </section>;
}
