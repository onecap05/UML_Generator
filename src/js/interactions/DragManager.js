import { snap, distance } from '../utils/geometry.js';
import { GRID, WORLD } from '../utils/constants.js';

/** Pointer capture keeps gestures stable outside a shape; all deltas use world units. */
export class DragManager {
  constructor(editor) {
    this.editor = editor;
    editor.canvas.addEventListener('pointerdown', e => this.start(e));
    editor.canvas.addEventListener('pointermove', e => this.move(e));
    editor.canvas.addEventListener('pointerup', e => this.end(e));
    editor.canvas.addEventListener('pointercancel', () => this.cancel());
  }
  start(event) {
    const e = this.editor;
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault(); e.viewport.focus({ preventScroll: true });
    const point = e.point(event), nodeId = event.target.closest('[data-node-id]')?.dataset.nodeId, transitionId = event.target.closest('[data-transition-id]')?.dataset.transitionId;
    if (e.spaceDown || event.button === 1) { this.gesture = { kind: 'pan', clientX: event.clientX, clientY: event.clientY, left: e.viewport.scrollLeft, top: e.viewport.scrollTop }; e.viewport.classList.add('panning'); }
    else if (event.target.hasAttribute('data-port')) {
      if (!e.connections.begin(nodeId)) return;
      this.gesture = { kind: 'connect' };
    } else if (e.tool === 'transition' && nodeId) {
      if (e.connections.sourceId) { e.connections.finish(nodeId); return; }
      if (e.connections.begin(nodeId)) e.notify('Selecciona el destino. Puedes elegir el mismo estado para un bucle.');
      return;
    } else if (e.tool !== 'select' && e.tool !== 'transition') { e.addNode(e.tool, point); return; }
    else if (nodeId || transitionId) {
      const id = nodeId ?? transitionId;
      if (event.shiftKey) { e.selection.has(id) ? e.selection.delete(id) : e.selection.add(id); e.refresh(); return; }
      if (!e.selection.has(id)) { e.selection.clear(); e.selection.add(id); }
      e.refresh();
      const kind = event.target.hasAttribute('data-resize') ? 'resize' : event.target.hasAttribute('data-control') ? 'control' : nodeId ? 'move' : null;
      if (!kind) return;
      this.gesture = { kind, id, start: point, before: e.model.snapshot(), index: Number(event.target.dataset.control), moved: false };
    } else {
      e.selection.clear(); e.refresh(); e.connections.cancel(); return;
    }
    e.canvas.setPointerCapture(event.pointerId);
  }
  move(event) {
    const e = this.editor, point = e.point(event), g = this.gesture;
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-node-id]')?.dataset.nodeId;
    if (e.connections.sourceId) e.connections.preview(point, under);
    if (!g) return;
    if (g.kind === 'pan') { e.viewport.scrollLeft = g.left - event.clientX + g.clientX; e.viewport.scrollTop = g.top - event.clientY + g.clientY; return; }
    if (g.kind === 'connect') return;
    let dx = point.x - g.start.x, dy = point.y - g.start.y;
    if (distance(point, g.start) < 2 && !g.moved) return;
    g.moved = true;
    e.model.replace(g.before);
    const n = e.model.node(g.id);
    if (e.snapToGrid) { dx = snap(dx, GRID); dy = snap(dy, GRID); }
    if (g.kind === 'move') e.model.moveNodes([...e.selection], dx, dy);
    if (g.kind === 'resize') e.model.resizeNode(g.id, n.width + dx, n.height + dy);
    if (g.kind === 'control') e.model.element(g.id).controlPoints[g.index] = { x: Math.min(WORLD.width, Math.max(0, e.snapToGrid ? snap(point.x) : point.x)), y: Math.min(WORLD.height, Math.max(0, e.snapToGrid ? snap(point.y) : point.y)) };
    e.renderer.schedule();
  }
  end(event) {
    const e = this.editor, g = this.gesture;
    if (!g) return;
    if (g.kind === 'connect') {
      const id = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-node-id]')?.dataset.nodeId;
      e.connections.finish(id);
    } else if (g.before && g.moved) {
      if (g.kind === 'move') for (const id of e.selection) if (e.model.node(id)) e.model.assignParent(id);
      e.commit(g.before);
    }
    this.gesture = null; e.viewport.classList.remove('panning');
    if (e.canvas.hasPointerCapture(event.pointerId)) e.canvas.releasePointerCapture(event.pointerId);
  }
  cancel() {
    if (this.gesture?.before) this.editor.model.replace(this.gesture.before);
    this.gesture = null; this.editor.connections.cancel(); this.editor.viewport.classList.remove('panning'); this.editor.refresh();
  }
}
