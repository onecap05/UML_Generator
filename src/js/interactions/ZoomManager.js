import { WORLD } from '../utils/constants.js';
export class ZoomManager {
  constructor(editor) {
    this.editor = editor; this.value = 1;
    editor.viewport.addEventListener('wheel', event => {
      event.preventDefault();
      if (event.shiftKey && !event.ctrlKey) { editor.viewport.scrollLeft += event.deltaY; return; }
      this.set(this.value * (event.deltaY < 0 ? 1.1 : 1 / 1.1), { x: event.clientX, y: event.clientY });
    }, { passive: false });
    editor.viewport.addEventListener('scroll', () => this.save(), { passive: true });
    this.apply();
  }
  apply() {
    const canvas = this.editor.canvas;
    canvas.setAttribute('viewBox', `0 0 ${WORLD.width} ${WORLD.height}`);
    canvas.setAttribute('width', WORLD.width * this.value); canvas.setAttribute('height', WORLD.height * this.value);
    this.editor.model.data.viewport.zoom = this.value;
  }
  set(value, at) {
    const view = this.editor.viewport, rect = view.getBoundingClientRect();
    const px = at ? at.x - rect.left : view.clientWidth / 2, py = at ? at.y - rect.top : view.clientHeight / 2;
    const x = (view.scrollLeft + px) / this.value, y = (view.scrollTop + py) / this.value;
    this.value = Math.max(.2, Math.min(3, value)); this.apply();
    view.scrollLeft = x * this.value - px; view.scrollTop = y * this.value - py;
    this.save(); this.editor.updateZoom();
  }
  save() { this.editor.model.data.viewport = { x: this.editor.viewport.scrollLeft, y: this.editor.viewport.scrollTop, zoom: this.value }; }
  restore() { const v = this.editor.model.data.viewport; this.value = v.zoom; this.apply(); this.editor.viewport.scrollLeft = v.x; this.editor.viewport.scrollTop = v.y; this.editor.updateZoom(); }
  fit() {
    const bounds = this.editor.renderer.bounds(), view = this.editor.viewport;
    this.value = Math.max(.2, Math.min(1.5, (view.clientWidth - 80) / bounds.width, (view.clientHeight - 80) / bounds.height)); this.apply();
    view.scrollLeft = Math.max(0, (bounds.x + bounds.width / 2) * this.value - view.clientWidth / 2);
    view.scrollTop = Math.max(0, (bounds.y + bounds.height / 2) * this.value - view.clientHeight / 2);
    this.save(); this.editor.updateZoom();
  }
}
