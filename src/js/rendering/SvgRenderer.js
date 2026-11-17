import { svgElement as svg, WORLD } from '../utils/constants.js';
import { renderNode } from './NodeRenderer.js';
import { renderTransition } from './TransitionRenderer.js';
import { transitionGeometry, diagramBounds } from '../utils/geometry.js';

export class SvgRenderer {
  constructor(canvas, model, selection) {
    this.canvas = canvas; this.model = model; this.selection = selection; this.nodeCache = new Map(); this.transitionCache = new Map(); this.geometries = new Map();
    const defs = svg('defs');
    for (const [id, color] of [['arrow', '#5a6f86'], ['arrow-selected', '#416cda']]) {
      const marker = svg('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
      marker.append(svg('path', { d: 'M 1 1 L 9 5 L 1 9', fill: 'none', stroke: color, 'stroke-width': 1.5 })); defs.append(marker);
    }
    const pattern = svg('pattern', { id: 'grid-pattern', width: 20, height: 20, patternUnits: 'userSpaceOnUse' });
    pattern.append(svg('circle', { cx: 1, cy: 1, r: .8, fill: '#d8e0e9' })); defs.append(pattern);
    this.background = svg('rect', { width: WORLD.width, height: WORLD.height, fill: 'url(#grid-pattern)', 'data-ui': 'true' });
    this.content = svg('g', { id: 'diagram-content' });
    this.containers = svg('g'); this.edges = svg('g'); this.nodes = svg('g');
    this.content.append(this.containers, this.edges, this.nodes);
    this.preview = svg('path', { class: 'connection-preview', 'data-ui': 'true', 'marker-end': 'url(#arrow-selected)' });
    canvas.append(defs, this.background, this.content, this.preview);
  }
  render() {
    const live = new Set(this.model.nodes.map(n => n.id));
    for (const [id, item] of this.nodeCache) if (!live.has(id)) { item.group.remove(); this.nodeCache.delete(id); }
    const depth = node => { let level = 0; while (node?.parentId && level < 100) { level++; node = this.model.node(node.parentId); } return level; };
    for (const node of [...this.model.nodes].sort((a, b) => depth(a) - depth(b))) {
      const selected = this.selection.has(node.id), key = JSON.stringify([node, selected]);
      let item = this.nodeCache.get(node.id);
      if (!item) { item = { group: svg('g', { 'data-node-id': node.id, tabindex: 0, role: 'button' }) }; this.nodeCache.set(node.id, item); }
      if (key !== item.key) { renderNode(item.group, node, selected); item.key = key; }
      const parent = node.type === 'composite' ? this.containers : this.nodes;
      if (item.group.parentNode !== parent) parent.append(item.group);
      if (node.type === 'composite') parent.append(item.group);
    }
    const sceneKey = JSON.stringify([this.model.nodes.map(n => [n.id, n.type, n.x, n.y, n.width, n.height, n.parentId]), this.model.transitions.map(t => [t.id, t.sourceId, t.targetId])]);
    const sceneChanged = this.sceneKey !== sceneKey;
    this.sceneKey = sceneKey;
    const edgeIds = new Set(this.model.transitions.map(t => t.id));
    for (const [id, item] of this.transitionCache) if (!edgeIds.has(id)) { item.group.remove(); this.transitionCache.delete(id); this.geometries.delete(id); }
    for (const t of this.model.transitions) {
      let item = this.transitionCache.get(t.id);
      const transitionKey = JSON.stringify(t);
      const geometry = !sceneChanged && item?.transitionKey === transitionKey ? this.geometries.get(t.id) : transitionGeometry(t, this.model.nodes, this.model.transitions);
      this.geometries.set(t.id, geometry);
      const selected = this.selection.has(t.id), key = JSON.stringify([t, geometry, selected]);
      if (!item) { item = { group: svg('g', { 'data-transition-id': t.id, tabindex: 0, role: 'button' }) }; this.transitionCache.set(t.id, item); this.edges.append(item.group); }
      if (key !== item.key) { renderTransition(item.group, t, geometry, selected); item.key = key; }
      item.transitionKey = transitionKey;
    }
  }
  bounds() {
    if (!this.model.nodes.length) return diagramBounds([]);
    // getBBox includes actual font metrics and long transition labels.
    const b = this.content.getBBox();
    return { x: b.x - 45, y: b.y - 45, width: b.width + 90, height: b.height + 90 };
  }
  schedule() { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = null; this.render(); }); }
}
