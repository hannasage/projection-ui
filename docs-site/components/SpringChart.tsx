import { chartModel, type SpringParams } from '@/lib/spring-lab';

/** The position curve for one spring, with its peak, band, and settle time marked in text. */
export function SpringChart({ params, describedBy, compact }: { params: SpringParams; describedBy: string; compact: boolean }) {
  const model = chartModel(params, compact);
  const { left, top, width, height } = model.plot;
  return <svg className="armature-chart-svg" viewBox={`0 0 ${model.width} ${model.height}`} role="img" aria-label="Position of a spring over time, moving from 0 to its target" aria-describedby={describedBy} fontSize={model.fontSize}>
    <rect className="armature-band" x={left} y={model.band.y} width={width} height={model.band.height} />
    {model.gridLines.map(line => <line key={line.dashed ? 'target' : 'zero'} className="armature-grid" x1={left} x2={left + width} y1={line.y} y2={line.y} strokeDasharray={line.dashed ? '4 4' : undefined} />)}
    <text x={model.band.label.x} y={model.band.label.y} textAnchor={model.band.label.anchor}>{model.band.label.text}</text>
    {model.yLabels.map(label => <text key={label.text} x={label.x} y={label.y} textAnchor="end">{label.text}</text>)}
    {model.xLabels.map(label => <text key={label.anchor} x={label.x} y={label.y} textAnchor={label.anchor}>{label.text}</text>)}
    {model.settle && <>
      <line className="armature-settle-line" x1={model.settle.x} x2={model.settle.x} y1={top} y2={top + height} strokeDasharray="2 4" />
      <text x={model.settle.labelX} y={model.settle.labelY}>settled</text>
    </>}
    <path className="armature-curve" d={model.curve} fill="none" strokeWidth="3" strokeLinecap="round" />
    {model.peak && <>
      <circle className="armature-peak" cx={model.peak.x} cy={model.peak.y} r="4" />
      <text x={model.peak.labelX} y={model.peak.labelY} textAnchor={model.peak.anchor}>{model.peak.label}</text>
    </>}
  </svg>;
}
