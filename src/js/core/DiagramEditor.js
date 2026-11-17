import { DiagramModel, emptyDiagram } from './DiagramModel.js';
import { HistoryManager } from './HistoryManager.js';
import { SvgRenderer } from '../rendering/SvgRenderer.js';
import { ZoomManager } from '../interactions/ZoomManager.js';
import { ConnectionManager } from '../interactions/ConnectionManager.js';
import { DragManager } from '../interactions/DragManager.js';
import { Toolbar } from '../ui/Toolbar.js';
import { ComponentPalette } from '../ui/ComponentPalette.js';
import { PropertiesPanel } from '../ui/PropertiesPanel.js';
import { ContextMenu } from '../ui/ContextMenu.js';
import { validateDiagram } from '../services/DiagramValidator.js';
import { parseProject } from '../services/ImportService.js';
import { buildSvg, downloadBlob, exportPng, projectFilename } from '../services/ExportService.js';
import { NODE_TYPES, WORLD } from '../utils/constants.js';
import { snap } from '../utils/geometry.js';

/** Coordinates model operations and small UI/interaction modules, without storing data in SVG. */
export class DiagramEditor {
  constructor() {
    this.model = new DiagramModel(); this.history = new HistoryManager(); this.selection = new Set();
    this.tool = 'select'; this.snapToGrid = true; this.dirty = false; this.spaceDown = false; this.clipboard = null; this.exportBackground = '#ffffff';
    this.canvas = document.getElementById('canvas'); this.viewport = document.getElementById('canvas-viewport');
    this.renderer = new SvgRenderer(this.canvas, this.model, this.selection);
    this.zoom = new ZoomManager(this); this.connections = new ConnectionManager(this); this.drag = new DragManager(this);
    this.toolbar = new Toolbar(this); this.palette = new ComponentPalette(this); this.properties = new PropertiesPanel(this); this.contextMenu = new ContextMenu(this);
    this.bindEvents(); this.refresh();
  }
  point(event) {
    const rect = this.canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / this.zoom.value, y: (event.clientY - rect.top) / this.zoom.value };
  }
  bindEvents() {
    document.getElementById('snap').addEventListener('change', e => { this.snapToGrid = e.target.checked; });
    document.getElementById('grid').addEventListener('change', e => { this.renderer.background.style.display = e.target.checked ? '' : 'none'; });
    document.getElementById('diagram-name').addEventListener('change', e => this.mutate(() => { this.model.data.metadata.name = e.target.value.trim() || 'Máquina de estados'; }));
    document.getElementById('file-input').addEventListener('change', async e => { const file = e.target.files[0]; if (file) await this.openFile(file); e.target.value = ''; });
    document.getElementById('load-example').addEventListener('click', () => this.loadExample());
    this.viewport.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('application/x-uml-node')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    this.viewport.addEventListener('drop', e => { e.preventDefault(); const type = e.dataTransfer.getData('application/x-uml-node'); if (Object.hasOwn(NODE_TYPES, type)) this.addNode(type, this.point(e)); });
    this.canvas.addEventListener('dblclick', event => {
      const id = event.target.closest('[data-transition-id]')?.dataset.transitionId;
      if (id) this.mutate(() => { this.model.element(id).controlPoints.push(this.point(event)); this.selection.clear(); this.selection.add(id); });
      else if (event.target.closest('[data-node-id]')) document.getElementById('property-name')?.focus();
    });
    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault(); const id = e.target.closest('[data-node-id]')?.dataset.nodeId ?? e.target.closest('[data-transition-id]')?.dataset.transitionId;
      if (id && !this.selection.has(id)) { this.selection.clear(); this.selection.add(id); this.refresh(); }
      this.contextMenu.open(e.clientX, e.clientY);
    });
    document.addEventListener('keydown', event => this.onKeyDown(event));
    document.addEventListener('keyup', event => { if (event.code === 'Space') this.spaceDown = false; });
    window.addEventListener('blur', () => { this.spaceDown = false; if (this.drag.gesture) this.drag.cancel(); });
    window.addEventListener('beforeunload', event => { if (this.dirty) { event.preventDefault(); event.returnValue = ''; } });
  }
  setTool(tool) {
    this.connections.cancel(); this.tool = tool; this.palette.update(tool);
    this.canvas.style.cursor = tool === 'select' ? '' : 'crosshair';
    document.getElementById('status-message').textContent = tool === 'select' ? 'Listo para diseñar' : tool === 'transition' ? 'Selecciona el origen y después el destino' : `Haz clic en el lienzo para crear: ${NODE_TYPES[tool].label}`;
  }
  addNode(type, point) {
    this.mutate(() => {
      const def = NODE_TYPES[type];
      const x = point.x - def.width / 2, y = point.y - def.height / 2;
      const node = this.model.addNode(type, this.snapToGrid ? snap(x) : x, this.snapToGrid ? snap(y) : y);
      this.selection.clear(); this.selection.add(node.id);
    });
    this.setTool('select');
  }
  mutate(operation) {
    const before = this.model.snapshot();
    try { operation(); this.commit(before); }
    catch (error) { this.model.replace(before); this.pruneSelection(); this.refresh(); this.notify(error.message || 'No se pudo completar la operación.', true); }
  }
  commit(before) {
    if (this.history.record(before, this.model.snapshot())) { this.model.touch(); this.dirty = true; }
    this.refresh();
  }
  pruneSelection() { for (const id of this.selection) if (!this.model.element(id)) this.selection.delete(id); }
  refresh() {
    this.pruneSelection(); this.renderer.render(); this.properties.render(); this.toolbar.update(); this.palette.update(this.tool); this.renderValidation();
    const data = this.model.data;
    document.getElementById('diagram-name').value = data.metadata.name;
    document.getElementById('dirty-indicator').hidden = !this.dirty;
    document.getElementById('empty-guide').hidden = Boolean(data.nodes.length);
    document.getElementById('counts').textContent = `${data.nodes.length} estados · ${data.transitions.length} transiciones`;
    const item = this.selection.size === 1 ? this.model.element([...this.selection][0]) : null;
    document.getElementById('selection-status').textContent = item ? item.name ?? 'Transición' : this.selection.size ? `${this.selection.size} seleccionados` : 'Sin selección';
  }
  renderValidation() {
    const issues = validateDiagram(this.model.data), root = document.getElementById('validation-results'); root.replaceChildren();
    const errors = issues.filter(i => i.severity === 'error').length;
    document.getElementById('validation-count').textContent = issues.length ? `${errors} E · ${issues.length - errors} A` : '✓';
    if (!issues.length) { const ok = document.createElement('p'); ok.className = 'validation-ok'; ok.textContent = this.model.nodes.length ? '✓ Sin problemas estructurales' : 'Sin elementos para validar'; root.append(ok); }
    for (const issue of issues) {
      const element = document.createElement('button'); element.className = `validation-item ${issue.severity}`; element.textContent = `${issue.severity === 'error' ? 'Error' : 'Aviso'} · ${issue.message}`;
      element.onclick = () => { if (issue.elementId) { this.selection.clear(); this.selection.add(issue.elementId); this.refresh(); } }; root.append(element);
    }
  }
  updateZoom() { this.toolbar?.update(); document.getElementById('zoom-status').textContent = `${Math.round(this.zoom.value * 100)}%`; }
  notify(message, error = false) {
    const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.toggle('error', error); toast.hidden = false;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 6500 : 3500);
    document.getElementById('status-message').textContent = message;
  }
  editProperty(id, key, value) {
    this.mutate(() => {
      const item = this.model.element(id);
      if (item.type) {
        if (['x', 'y', 'width', 'height'].includes(key) && !Number.isFinite(value)) throw new Error('Introduce un número válido.');
        if (key === 'x' || key === 'y') {
          this.model.moveNodes([id], key === 'x' ? value - item.x : 0, key === 'y' ? value - item.y : 0); this.model.assignParent(id);
        } else if (key === 'width' || key === 'height') this.model.resizeNode(id, key === 'width' ? value : item.width, key === 'height' ? value : item.height);
        else if (key === 'parentId') {
          if (value) {
            const parent = this.model.node(value);
            if (item.width > parent.width - 30 || item.height > parent.height - 65) throw new Error('Amplía el contenedor para que el estado quepa en su región.');
            const x = Math.max(parent.x + 15, Math.min(item.x, parent.x + parent.width - item.width - 15));
            const y = Math.max(parent.y + 50, Math.min(item.y, parent.y + parent.height - item.height - 15));
            this.model.moveNodes([id], x - item.x, y - item.y);
          }
          item.parentId = value || null;
        } else if (key === 'orientation') { if (item.orientation !== value) { [item.width, item.height] = [item.height, item.width]; item.orientation = value; } }
        else item[key] = value;
      } else {
        if (key === 'sourceId' && this.model.node(value).type === 'final') throw new Error('El estado final no admite transiciones salientes.');
        if (key === 'targetId' && this.model.node(value).type === 'initial') throw new Error('El estado inicial no admite transiciones entrantes.');
        item[key] = value;
      }
    });
  }
  deleteSelection() {
    if (!this.selection.size) return;
    const children = [...this.selection].flatMap(id => this.model.descendants(id));
    if ((this.selection.size > 1 || children.length) && !confirm(`¿Eliminar la selección${children.length ? ' y los estados que contiene' : ''}? También se eliminarán las transiciones asociadas.`)) return;
    this.mutate(() => { this.model.remove([...this.selection]); this.selection.clear(); });
  }
  restoreHistory(direction) {
    const data = this.history[direction](this.model.snapshot());
    if (!data) return;
    data.viewport = { ...this.model.data.viewport }; this.model.replace(data); this.model.touch(); this.dirty = true; this.connections.cancel(); this.refresh();
  }
  async run(action) {
    try {
      switch (action) {
        case 'new':
          if (this.dirty && !confirm('Hay cambios sin guardar. ¿Crear un diagrama nuevo y descartarlos?')) return;
          this.model.replace(emptyDiagram()); this.history.clear(); this.selection.clear(); this.dirty = false; this.setTool('select'); this.zoom.restore(); this.refresh(); break;
        case 'open': document.getElementById('file-input').click(); break;
        case 'save':
          this.zoom.save(); downloadBlob(new Blob([JSON.stringify(this.model.data, null, 2)], { type: 'application/json' }), projectFilename(this.model.data.metadata.name, 'json'));
          this.dirty = false; this.refresh(); this.notify('Proyecto JSON preparado para descargar.'); break;
        case 'svg': {
          const svg = buildSvg(this.renderer, this.exportBackground); downloadBlob(new Blob([svg.source], { type: 'image/svg+xml;charset=utf-8' }), projectFilename(this.model.data.metadata.name, 'svg')); this.notify('Diagrama SVG exportado.'); break;
        }
        case 'png': await exportPng(this.renderer, this.model.data.metadata.name, this.exportBackground); this.notify('Diagrama PNG exportado a escala 2×.'); break;
        case 'undo': this.restoreHistory('undo'); break;
        case 'redo': this.restoreHistory('redo'); break;
        case 'zoom-in': this.zoom.set(this.zoom.value * 1.2); break;
        case 'zoom-out': this.zoom.set(this.zoom.value / 1.2); break;
        case 'fit': this.zoom.fit(); break;
        case 'delete': this.deleteSelection(); break;
        case 'copy': this.clipboard = { ids: [...this.selection], data: this.model.snapshot() }; this.notify('Estados y conexiones internas copiados.'); break;
        case 'paste':
          if (this.clipboard) this.mutate(() => { const ids = this.model.duplicate(this.clipboard.ids, 40, this.clipboard.data); this.selection.clear(); ids.forEach(id => this.selection.add(id)); }); break;
        case 'duplicate':
          this.mutate(() => { const ids = this.model.duplicate([...this.selection]); this.selection.clear(); ids.forEach(id => this.selection.add(id)); }); break;
        case 'select-all': this.selection.clear(); [...this.model.nodes, ...this.model.transitions].forEach(n => this.selection.add(n.id)); this.refresh(); break;
      }
    } catch (error) { this.notify(error.message || 'No se pudo completar la operación.', true); }
  }
  async openFile(file) {
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.');
      const data = parseProject(await file.text());
      if (this.dirty && !confirm('¿Abrir el proyecto y descartar los cambios sin guardar?')) return;
      this.model.replace(data); this.history.clear(); this.selection.clear(); this.dirty = false; this.setTool('select'); this.zoom.restore(); this.refresh(); this.notify('Proyecto importado. Puedes continuar editando.');
    } catch (error) { this.notify(error.message, true); }
  }
  async loadExample() {
    try {
      const response = await fetch('examples/pedido.json'); if (!response.ok) throw new Error('No se pudo leer el ejemplo. Ejecuta la aplicación con un servidor estático.');
      const data = parseProject(await response.text());
      if (this.dirty && !confirm('¿Abrir el ejemplo y descartar los cambios sin guardar?')) return;
      this.model.replace(data); this.history.clear(); this.selection.clear(); this.dirty = true; this.setTool('select'); this.refresh(); this.zoom.fit();
    } catch (error) { this.notify(error.message, true); }
  }
  onKeyDown(event) {
    const typing = event.target.closest('input,textarea,select,[contenteditable="true"]');
    if (event.key === 'Escape') { if (typing) event.target.blur(); this.drag.cancel(); this.contextMenu.close(); this.setTool('select'); return; }
    if (typing) return;
    const inEditor = this.viewport.contains(document.activeElement);
    const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    if (modifier && ['z', 'y', 's', 'o'].includes(key)) {
      event.preventDefault(); this.run(key === 'z' ? event.shiftKey ? 'redo' : 'undo' : { y: 'redo', s: 'save', o: 'open' }[key]); return;
    }
    if (!inEditor) return;
    if (event.key === 'Enter') {
      const id = event.target.closest('[data-node-id]')?.dataset.nodeId ?? event.target.closest('[data-transition-id]')?.dataset.transitionId;
      if (id) {
        event.preventDefault();
        if (!event.shiftKey) this.selection.clear();
        if (event.shiftKey && this.selection.has(id)) this.selection.delete(id); else this.selection.add(id);
        this.refresh();
      }
      return;
    }
    if (modifier && ['a', 'c', 'v', 'd'].includes(key)) { event.preventDefault(); this.run({ a: 'select-all', c: 'copy', v: 'paste', d: 'duplicate' }[key]); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); this.deleteSelection(); }
    else if (event.code === 'Space') { event.preventDefault(); this.spaceDown = true; }
    else if (key === 'v' || key === 't') this.setTool(key === 'v' ? 'select' : 'transition');
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); const step = event.shiftKey ? 20 : 1;
      this.mutate(() => { this.model.moveNodes([...this.selection], event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0); });
    }
  }
}
