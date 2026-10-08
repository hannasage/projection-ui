export function Example({ id, title }: { id: string; title: string }) {
  const component = title.split(':')[0];
  const heights: Record<string, number> = { Button:144, Badge:144, Card:200, ButtonGroup:200, LinkButton:144, Separator:144, VisuallyHidden:144, Input:200, Select:200, Textarea:280, Toggle:160, Slider:180 };
  return <section className="component-example" aria-label={title}>
    <h3>{title}</h3>
    <iframe title={title} src={`/examples/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`} loading="lazy" style={{height:heights[component]??520}} />
    <a href={`/examples/?path=/story/${encodeURIComponent(id)}`}>Open {title} in the component explorer</a>
  </section>;
}
