import { transitionLabel } from '../models/Transition.js';

export const center = node => ({ x: node.x + node.width / 2, y: node.y + node.height / 2 });
export const snap = (value, grid = 20) => Math.round(value / grid) * grid;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Intersects a ray from the center with a circle, diamond, or rectangle boundary. */
export function boundaryPoint(node, toward) {
  const c = center(node), dx = toward.x - c.x, dy = toward.y - c.y;
  if (!dx && !dy) return { x: c.x + node.width / 2, y: c.y };
  let ratio;
  if (node.type === 'initial' || node.type === 'final') ratio = 1 / Math.sqrt((dx / (node.width / 2)) ** 2 + (dy / (node.height / 2)) ** 2);
  else if (node.type === 'choice') ratio = 1 / (Math.abs(dx) / (node.width / 2) + Math.abs(dy) / (node.height / 2));
  else ratio = Math.min(node.width / 2 / Math.abs(dx || 1e-10), node.height / 2 / Math.abs(dy || 1e-10));
  return { x: c.x + dx * ratio, y: c.y + dy * ratio };
}

function segmentHits(a, b, node, padding = 8) {
  const left = node.x - padding, right = node.x + node.width + padding, top = node.y - padding, bottom = node.y + node.height + padding;
  if (Math.abs(a.y - b.y) < 1e-8) return a.y > top && a.y < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
  if (Math.abs(a.x - b.x) < 1e-8) return a.x > left && a.x < right && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom;
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [[a.x, b.x - a.x, left, right], [a.y, b.y - a.y, top, bottom]]) {
    if (Math.abs(delta) < 1e-8) { if (origin <= min || origin >= max) return false; }
    else {
      const t1 = (min - origin) / delta, t2 = (max - origin) / delta;
      low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2));
      if (low >= high) return false;
    }
  }
  return high > 0 && low < 1;
}

function ancestors(node, nodes) {
  const ids = new Set();
  while (node?.parentId && !ids.has(node.parentId)) { ids.add(node.parentId); node = nodes.find(n => n.id === node.parentId); }
  return ids;
}

/** Candidate orthogonal lanes avoid obstacles without a costly full-world routing grid.
 * A manually supplied bend takes priority. Multiple edges receive separate lanes. */
export function transitionGeometry(transition, nodes, transitions) {
  const source = nodes.find(n => n.id === transition.sourceId), target = nodes.find(n => n.id === transition.targetId);
  if (!source || !target) return null;
  const a = center(source), b = center(target);
  const siblings = transitions.filter(t => (t.sourceId === source.id && t.targetId === target.id) || (t.sourceId === target.id && t.targetId === source.id));
  const index = siblings.findIndex(t => t.id === transition.id);
  const lane = siblings.length > 1 ? (index - (siblings.length - 1) / 2) * 35 : 0;
  let points;
  if (transition.controlPoints.length) {
    points = [boundaryPoint(source, transition.controlPoints[0]), ...transition.controlPoints, boundaryPoint(target, transition.controlPoints.at(-1))];
  } else if (source.id === target.id) {
    const extent = 48 + index * 28;
    points = [{ x: a.x + source.width * .22, y: source.y }, { x: a.x + source.width * .22, y: Math.max(3, source.y - extent) }, { x: source.x + source.width + extent, y: Math.max(3, source.y - extent) }, { x: source.x + source.width + extent, y: a.y }, { x: source.x + source.width, y: a.y }];
  } else {
    const excluded = new Set([source.id, target.id, ...ancestors(source, nodes), ...ancestors(target, nodes)]);
    const obstacles = nodes.filter(n => !excluded.has(n.id));
    const candidates = [];
    if (!lane) candidates.push([a, b]);
    const xLanes = new Set([(a.x + b.x) / 2 + lane]);
    const yLanes = new Set([(a.y + b.y) / 2 + lane]);
    if (lane) {
      if (Math.abs(a.x - b.x) >= Math.abs(a.y - b.y)) yLanes.add(Math.min(source.y, target.y) - 35 - index * 28);
      else xLanes.add(Math.max(source.x + source.width, target.x + target.width) + 35 + index * 28);
      yLanes.add(Math.max(source.y + source.height, target.y + target.height) + 35 + index * 28);
      xLanes.add(Math.min(source.x, target.x) - 35 - index * 28);
    }
    for (const n of obstacles) {
      if (n.x + n.width >= Math.min(a.x, b.x) - 40 && n.x <= Math.max(a.x, b.x) + 40 && n.y + n.height >= Math.min(a.y, b.y) - 40 && n.y <= Math.max(a.y, b.y) + 40) {
        xLanes.add(n.x - 22 - index * 5); xLanes.add(n.x + n.width + 22 + index * 5);
        yLanes.add(n.y - 22 - index * 5); yLanes.add(n.y + n.height + 22 + index * 5);
      }
    }
    const horizontal = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
    for (const x of xLanes) if (!lane || !horizontal) candidates.push([a, { x, y: a.y }, { x, y: b.y }, b]);
    for (const y of yLanes) if (!lane || horizontal) candidates.push([a, { x: a.x, y }, { x: b.x, y }, b]);
    const prepared = candidates.map(path => {
      path = path.filter((p, i) => !i || distance(p, path[i - 1]) > .1);
      path[0] = boundaryPoint(source, path[1]); path[path.length - 1] = boundaryPoint(target, path.at(-2));
      return path;
    });
    const scoringObstacles = [...obstacles, source, target];
    const score = path => {
      let value = path.length * 8;
      for (let i = 1; i < path.length; i++) {
        value += distance(path[i - 1], path[i]);
        for (const obstacle of scoringObstacles) if (segmentHits(path[i - 1], path[i], obstacle, obstacle === source || obstacle === target ? -1 : 8)) value += 100000;
      }
      // Distinct parallel lanes matter more than a marginally shorter route.
      if (lane && path.length > 2 && distance(path[0], path[1]) < 2) value += 1000;
      return value;
    };
    points = prepared.map(path => ({ path, score: score(path) })).sort((p, q) => p.score - q.score)[0].path;
    if (lane && points.length <= 2) {
      const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
      const bend = horizontal ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + lane * 2 } : { x: (a.x + b.x) / 2 + lane * 2, y: (a.y + b.y) / 2 };
      points = [boundaryPoint(source, bend), bend, boundaryPoint(target, bend)];
    }
  }
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  let remaining = total / 2, label = points[0];
  for (let i = 1; i < points.length; i++) {
    const length = distance(points[i - 1], points[i]);
    if (remaining <= length) { const f = length ? remaining / length : 0; label = { x: points[i - 1].x + (points[i].x - points[i - 1].x) * f, y: points[i - 1].y + (points[i].y - points[i - 1].y) * f - 9 }; break; }
    remaining -= length;
  }
  const content = transitionLabel(transition);
  if (content) {
    const labelWidth = Math.min(48, content.length) * 6.4 + 12;
    const labelHeight = Math.ceil(content.length / 45) * 15;
    // Lift long labels out of node bodies. Containers deliberately remain behind labels.
    for (let pass = 0; pass < 30; pass++) {
      const obstacle = nodes.find(n => n.type !== 'composite' && label.x + labelWidth / 2 > n.x - 6 && label.x - labelWidth / 2 < n.x + n.width + 6 && label.y + labelHeight - 12 > n.y - 6 && label.y - 12 < n.y + n.height + 6);
      if (!obstacle) break;
      label = { x: label.x, y: obstacle.y - labelHeight - 6 };
    }
  }
  return { points, label, path: points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') };
}

export function diagramBounds(nodes, geometries = []) {
  const points = nodes.flatMap(n => [{ x: n.x, y: n.y }, { x: n.x + n.width, y: n.y + n.height }]);
  for (const g of geometries) if (g) points.push(...g.points, g.label);
  if (!points.length) return { x: 0, y: 0, width: 800, height: 500 };
  const x = Math.min(...points.map(p => p.x)) - 45, y = Math.min(...points.map(p => p.y)) - 45;
  return { x, y, width: Math.max(...points.map(p => p.x)) - x + 45, height: Math.max(...points.map(p => p.y)) - y + 45 };
}
