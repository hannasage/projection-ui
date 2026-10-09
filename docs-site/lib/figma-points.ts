export type FigmaPoint = { x: number; y: number; z: number };
export type FigmaCursor = { x: number; y: number; strength: number };

function inside(x: number, y: number): boolean {
  const disk = (cx: number, cy: number) => Math.hypot(x - cx, y - cy) <= 30;
  const left = (cy: number) => (x >= 30 && x <= 60 && Math.abs(y - cy) <= 30) || (x < 30 && disk(30, cy));
  return left(30) || left(90)
    || (x >= 60 && x <= 90 && y >= 0 && y <= 60) || (x > 90 && disk(90, 30))
    || disk(90, 90) || disk(30, 150) || (x >= 30 && x <= 60 && y >= 120 && y <= 150);
}

/** Sample the front, back, and rim of a rounded extrusion. */
export function createFigmaPoints(): FigmaPoint[] {
  const points: FigmaPoint[] = [];
  for (let y = 1.5; y < 180; y += 3) {
    for (let x = 1.5; x < 120; x += 3) {
      if (!inside(x, y)) continue;
      const cy = Math.floor(y / 60) * 60 + 30;
      const cx = x > 60 ? 90 : 30;
      const dome = Math.sqrt(Math.max(0, 1 - ((x - cx) ** 2 + (y - cy) ** 2) / 1800));
      const z = 7 + dome * 15;
      points.push({ x, y, z }, { x, y, z: -z });
      if (!inside(x - 3, y) || !inside(x + 3, y) || !inside(x, y - 3) || !inside(x, y + 3)) {
        for (let rim = -12; rim <= 12; rim += 6) points.push({ x, y, z: rim });
      }
    }
  }
  return points;
}

export function projectFigmaPoints(points: FigmaPoint[], width: number, height: number, phase: number, cursor?: FigmaCursor): (FigmaPoint & { glow: number })[] {
  if (width <= 0 || height <= 0) return [];
  const turn = -.24 + Math.sin(phase * .35) * .10;
  const tilt = -.10 + Math.cos(phase * .28) * .05;
  const scale = Math.min(width / 205, height / 225);
  return points.map(point => {
    const x = point.x - 60;
    const y = point.y - 90;
    const z = point.z + Math.sin(point.y * .06 + phase * .5) * 1.2;
    const turnedX = x * Math.cos(turn) + z * Math.sin(turn);
    const turnedZ = z * Math.cos(turn) - x * Math.sin(turn);
    const tiltedY = y * Math.cos(tilt) - turnedZ * Math.sin(tilt);
    let depth = y * Math.sin(tilt) + turnedZ * Math.cos(tilt);
    const basePerspective = 420 / (420 - depth);
    const screenX = width / 2 + turnedX * scale * basePerspective;
    const screenY = height / 2 + tiltedY * scale * basePerspective;
    const proximity = cursor && depth > 0 ? Math.max(0, 1 - Math.hypot(screenX - cursor.x, screenY - cursor.y) / 68) : 0;
    const glow = proximity * proximity * (3 - 2 * proximity) * Math.max(0, Math.min(1, cursor?.strength ?? 0));
    depth += glow * 10;
    const perspective = 420 / (420 - depth);
    return { x: width / 2 + turnedX * scale * perspective, y: height / 2 + tiltedY * scale * perspective - glow * 4, z: depth, glow };
  }).sort((a, b) => a.z - b.z);
}
