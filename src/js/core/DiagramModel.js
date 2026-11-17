import { clone, WORLD, MIN_SIZE } from '../utils/constants.js';
import { createNode } from '../models/StateNode.js';
import { createTransition } from '../models/Transition.js';
import { createId } from '../utils/identifiers.js';

export function emptyDiagram() {
  const now = new Date().toISOString();
  return { version: '1.0', metadata: { name: 'Máquina de estados', createdAt: now, updatedAt: now }, nodes: [], transitions: [], viewport: { x: 0, y: 0, zoom: 1 } };
}
/** The model owns semantic and geometric data. UI selection and history live elsewhere. */
export class DiagramModel {
  constructor(data = emptyDiagram()) { this.data = clone(data); }
  get nodes() { return this.data.nodes; }
  get transitions() { return this.data.transitions; }
  node(id) { return this.nodes.find(node => node.id === id); }
  element(id) { return this.node(id) ?? this.transitions.find(item => item.id === id); }
  snapshot() { return clone(this.data); }
  replace(data) { this.data = clone(data); }
  touch() { this.data.metadata.updatedAt = new Date().toISOString(); }
  addNode(type, x, y) {
    const node = createNode(type, x, y, this.nodes.filter(n => n.type === type).length + 1);
    this.nodes.push(node);
    this.assignParent(node.id);
    return node;
  }
  addTransition(sourceId, targetId) {
    const source = this.node(sourceId), target = this.node(targetId);
    if (!source || !target) throw new Error('Selecciona dos elementos existentes para conectarlos.');
    if (source.type === 'final') throw new Error('Un estado final no puede tener transiciones salientes.');
    if (target.type === 'initial') throw new Error('Un estado inicial no puede tener transiciones entrantes.');
    const transition = createTransition(sourceId, targetId);
    this.transitions.push(transition);
    return transition;
  }
  descendants(id) {
    const result = [];
    const visit = parent => { for (const node of this.nodes.filter(n => n.parentId === parent)) { result.push(node); visit(node.id); } };
    visit(id);
    return result;
  }
  remove(ids) {
    const removed = new Set(ids);
    for (const id of ids) for (const child of this.descendants(id)) removed.add(child.id);
    this.data.nodes = this.nodes.filter(node => !removed.has(node.id));
    this.data.transitions = this.transitions.filter(t => !removed.has(t.id) && !removed.has(t.sourceId) && !removed.has(t.targetId));
  }
  /** Composite children keep absolute coordinates, so crossing edges need no coordinate conversion. */
  assignParent(id) {
    const node = this.node(id);
    const excluded = new Set([id, ...this.descendants(id).map(n => n.id)]);
    const candidates = this.nodes.filter(n => n.type === 'composite' && !excluded.has(n.id) && node.x >= n.x + 12 && node.y >= n.y + 46 && node.x + node.width <= n.x + n.width - 12 && node.y + node.height <= n.y + n.height - 12);
    candidates.sort((a, b) => a.width * a.height - b.width * b.height);
    node.parentId = candidates[0]?.id ?? null;
  }
  moveNodes(ids, dx, dy) {
    const moved = new Set();
    for (const id of ids) {
      if (this.node(id)) { moved.add(id); for (const child of this.descendants(id)) moved.add(child.id); }
    }
    const nodes = [...moved].map(id => this.node(id));
    if (!nodes.length) return;
    dx = Math.max(-Math.min(...nodes.map(n => n.x)) + 4, Math.min(dx, WORLD.width - Math.max(...nodes.map(n => n.x + n.width)) - 4));
    dy = Math.max(-Math.min(...nodes.map(n => n.y)) + 4, Math.min(dy, WORLD.height - Math.max(...nodes.map(n => n.y + n.height)) - 4));
    for (const node of nodes) { node.x += dx; node.y += dy; }
    for (const t of this.transitions) if (moved.has(t.sourceId) && moved.has(t.targetId)) for (const p of t.controlPoints) { p.x += dx; p.y += dy; }
  }
  resizeNode(id, width, height) {
    const node = this.node(id);
    if (!MIN_SIZE[node.type]) return;
    const children = this.descendants(id);
    node.width = Math.min(WORLD.width - node.x, Math.max(MIN_SIZE[node.type][0], width, ...children.map(n => n.x + n.width - node.x + 15)));
    node.height = Math.min(WORLD.height - node.y, Math.max(MIN_SIZE[node.type][1], height, ...children.map(n => n.y + n.height - node.y + 15)));
  }
  duplicate(ids, offset = 30, sourceData = this.snapshot()) {
    const chosen = new Set(ids);
    const includeChildren = parent => { for (const node of sourceData.nodes.filter(n => n.parentId === parent)) { chosen.add(node.id); includeChildren(node.id); } };
    for (const id of ids) includeChildren(id);
    const originals = sourceData.nodes.filter(n => chosen.has(n.id));
    const mapping = new Map(originals.map(n => [n.id, createId()]));
    const nodes = originals.map(n => ({ ...clone(n), id: mapping.get(n.id), name: `${n.name} (copia)`, x: Math.min(WORLD.width - n.width, n.x + offset), y: Math.min(WORLD.height - n.height, n.y + offset), parentId: mapping.get(n.parentId) ?? (this.node(n.parentId) ? n.parentId : null) }));
    this.nodes.push(...nodes);
    for (const t of sourceData.transitions.filter(t => mapping.has(t.sourceId) && mapping.has(t.targetId))) this.transitions.push({ ...clone(t), id: createId('transition'), sourceId: mapping.get(t.sourceId), targetId: mapping.get(t.targetId), controlPoints: t.controlPoints.map(p => ({ x: p.x + offset, y: p.y + offset })) });
    for (const node of nodes) if (!mapping.has(originals.find(n => mapping.get(n.id) === node.id)?.parentId)) this.assignParent(node.id);
    return nodes.map(n => n.id);
  }
}
