import assert from 'node:assert/strict';
import test from 'node:test';
import { createFigmaPoints, projectFigmaPoints } from '../lib/figma-points.ts';

test('the point cloud has depth and preserves the five-lobed Figma silhouette', () => {
  const points = createFigmaPoints();
  assert.ok(points.length > 1000 && points.length < 5000);
  assert.ok(points.some(point => point.z > 15));
  assert.ok(points.some(point => point.z < -15));
  for (const point of points) {
    assert.ok(point.x >= 0 && point.x <= 120 && point.y >= 0 && point.y <= 180);
    assert.ok(!(point.x > 60 && point.y > 120), 'The bottom-right cell stays empty');
  }
});

test('cursor proximity lifts nearby front dots and leaves distant dots unchanged', () => {
  const points = [{x: 60, y: 50, z: 20}, {x: 10, y: 170, z: 20}];
  const original = projectFigmaPoints(points, 400, 240, 0);
  const nearest = original.find(point => point.y < 120);
  const hover = projectFigmaPoints(points, 400, 240, 0, {...nearest, strength: 1});
  const lifted = hover.find(point => point.glow > 0);
  assert.ok(lifted.z > nearest.z && lifted.y < nearest.y);
  assert.ok(lifted.glow > .9 && lifted.glow <= 1);
  assert.deepEqual(hover.find(point => point.glow === 0), original.find(point => point.y > 120));
  assert.deepEqual(projectFigmaPoints(points, 400, 240, 0, {...nearest, strength: 0}), original);
});

test('projection stays bounded, sorts depth, and changes gently over time', () => {
  const points = createFigmaPoints();
  const still = projectFigmaPoints(points, 400, 240, 0);
  const moved = projectFigmaPoints(points, 400, 240, 1);
  assert.equal(still.length, points.length);
  assert.notDeepEqual(moved, still);
  for (let i = 0; i < still.length; i++) {
    const point = still[i];
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(point.x > 0 && point.x < 400 && point.y > 0 && point.y < 240);
    if (i) assert.ok(still[i - 1].z <= point.z);
  }
  assert.deepEqual(projectFigmaPoints(points, 0, 0, 0), []);
});
