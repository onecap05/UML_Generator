import { boundaryPoint, center } from '../utils/geometry.js';
export class ConnectionManager {
  constructor(editor) { this.editor = editor; this.sourceId = null; }
  begin(id) {
    const node = this.editor.model.node(id);
    if (node.type === 'final') { this.editor.notify('Un estado final no admite transiciones salientes.', true); return false; }
    this.sourceId = id; this.editor.viewport.classList.add('connecting'); return true;
  }
  preview(point, targetId) {
    const source = this.editor.model.node(this.sourceId); if (!source) return;
    const a = boundaryPoint(source, point);
    this.editor.renderer.preview.setAttribute('d', `M ${a.x} ${a.y} L ${point.x} ${point.y}`);
    for (const [id, item] of this.editor.renderer.nodeCache) item.group.classList.toggle('connection-target', id === targetId);
  }
  finish(targetId) {
    const source = this.sourceId;
    if (source && targetId) this.editor.mutate(() => { const t = this.editor.model.addTransition(source, targetId); this.editor.selection.clear(); this.editor.selection.add(t.id); });
    this.cancel();
  }
  cancel() {
    this.sourceId = null; this.editor.renderer.preview.setAttribute('d', ''); this.editor.viewport.classList.remove('connecting');
    for (const item of this.editor.renderer.nodeCache.values()) item.group.classList.remove('connection-target');
  }
}
