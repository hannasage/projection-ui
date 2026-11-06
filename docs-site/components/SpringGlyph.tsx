import { glyphModel } from '@/lib/spring-lab';

const glyph = glyphModel();

/** The Mechanical spring curve, drawn by the same math as the lab. It overshoots once and settles. */
export function SpringGlyph() {
  return <svg className="armature-glyph" viewBox={`0 0 ${glyph.width} ${glyph.height}`} role="img" aria-label="A spring curve that overshoots its target once and settles">
    <line className="armature-grid" x1="8" x2="152" y1={glyph.baselineY} y2={glyph.baselineY} strokeDasharray="4 4" />
    <path className="armature-curve" d={glyph.curve} fill="none" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
