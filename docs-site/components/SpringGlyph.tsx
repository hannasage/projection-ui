import { glyphModel } from '@/lib/spring-lab';

const glyph = glyphModel();

/**
 * The Mechanical spring curve, drawn by the same math as the lab. It overshoots once and settles.
 * Inside a link that already has a name, pass `decorative` so the curve adds nothing to that name.
 */
export function SpringGlyph({ decorative = false }: { decorative?: boolean }) {
  const label = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'A spring curve that overshoots its target once and settles' };
  return <svg className="armature-glyph" viewBox={`0 0 ${glyph.width} ${glyph.height}`} {...label}>
    <line className="armature-grid" x1="8" x2="152" y1={glyph.baselineY} y2={glyph.baselineY} strokeDasharray="4 4" />
    <text className="armature-glyph-label" x={glyph.label.x} y={glyph.label.y}>{glyph.label.text}</text>
    <path className="armature-curve" d={glyph.curve} fill="none" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
