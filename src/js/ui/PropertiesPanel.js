import { NODE_TYPES, MIN_SIZE } from '../utils/constants.js';
import { transitionLabel } from '../models/Transition.js';

export class PropertiesPanel {
  constructor(editor) { this.editor = editor; this.root = document.getElementById('properties'); }
  render() {
    const editor = this.editor, ids = [...editor.selection], item = ids.length === 1 ? editor.model.element(ids[0]) : null;
    this.root.replaceChildren();
    document.getElementById('selection-kind').textContent = item ? (item.type ? 'ESTADO' : 'TRANSICIÓN') : ids.length ? 'SELECCIÓN' : 'DIAGRAMA';
    if (!item) {
      const empty = document.createElement('div'); empty.className = 'inspector-empty';
      const strong = document.createElement('strong'); strong.textContent = ids.length ? `${ids.length} elementos seleccionados` : 'Cada detalle, en su lugar';
      empty.append(strong, document.createTextNode(ids.length ? 'Puedes mover, copiar, duplicar o eliminar esta selección.' : 'Selecciona un estado o una transición para consultar y editar sus propiedades.'));
      this.root.append(empty);
      if (ids.length) { const button = document.createElement('button'); button.className = 'secondary-button'; button.textContent = 'Eliminar selección'; button.onclick = () => editor.deleteSelection(); empty.append(document.createElement('br'), button); }
      else this.exportOptions();
      return;
    }
    const form = document.createElement('form'); form.className = 'property-form'; form.addEventListener('submit', e => e.preventDefault()); this.root.append(form);
    const field = (key, label, type = 'text', options = null, parent = form) => {
      const wrapper = document.createElement('div'), caption = document.createElement('label'); caption.textContent = label; caption.htmlFor = `property-${key}`;
      const input = document.createElement(type === 'textarea' ? 'textarea' : options ? 'select' : 'input'); input.id = `property-${key}`;
      if (options) for (const [value, name] of options) { const option = document.createElement('option'); option.value = value; option.textContent = name; input.append(option); }
      else if (type !== 'textarea') { input.type = type; if (type === 'number') { input.min = 0; input.max = key === 'x' || key === 'width' ? 5000 : 3500; input.step = 1; } else input.maxLength = 1000; }
      input.value = item[key] ?? ''; input.addEventListener('change', () => editor.editProperty(item.id, key, type === 'number' ? Number(input.value) : input.value));
      wrapper.append(caption, input); parent.append(wrapper); return input;
    };
    const id = document.createElement('p'); id.className = 'element-id'; id.textContent = item.id; id.title = item.id; form.append(id);
    if (item.type) {
      field('name', 'Nombre');
      const type = document.createElement('p'); type.className = 'field-help'; type.textContent = NODE_TYPES[item.type].label; form.append(type);
      const row = document.createElement('div'); row.className = 'field-row'; form.append(row); field('x', 'Posición X', 'number', null, row); field('y', 'Posición Y', 'number', null, row);
      if (MIN_SIZE[item.type]) {
        const sizeRow = document.createElement('div'); sizeRow.className = 'field-row'; form.append(sizeRow); field('width', 'Ancho', 'number', null, sizeRow); field('height', 'Alto', 'number', null, sizeRow);
      }
      const excluded = new Set([item.id, ...editor.model.descendants(item.id).map(n => n.id)]);
      field('parentId', 'Contenedor', 'text', [['', 'Región principal'], ...editor.model.nodes.filter(n => n.type === 'composite' && !excluded.has(n.id)).map(n => [n.id, n.name])]);
      if (item.type === 'state' || item.type === 'composite') { const title = document.createElement('h3'); title.textContent = 'Comportamiento interno'; form.append(title); field('entry', 'entry /', 'textarea'); field('do', 'do /', 'textarea'); field('exit', 'exit /', 'textarea'); }
      if (item.type === 'fork' || item.type === 'join') field('orientation', 'Orientación', 'text', [['horizontal', 'Horizontal'], ['vertical', 'Vertical']]);
    } else {
      const names = editor.model.nodes.map(n => [n.id, n.name]); field('sourceId', 'Origen', 'text', names); field('targetId', 'Destino', 'text', names);
      field('event', 'Evento / disparador'); field('guard', 'Guarda / condición'); field('action', 'Acción / efecto', 'textarea');
      const preview = document.createElement('p'); preview.className = 'field-help'; preview.textContent = transitionLabel(item) || 'evento [guarda] / acción'; form.append(preview);
      const help = document.createElement('p'); help.className = 'field-help'; help.textContent = 'Doble clic en la línea para añadir un punto de control. Arrástralo para ajustar la ruta.'; form.append(help);
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'secondary-button'; reset.textContent = 'Restablecer ruta'; reset.onclick = () => editor.mutate(() => { item.controlPoints = []; }); form.append(reset);
    }
    const actions = document.createElement('div'); actions.className = 'property-actions'; form.append(actions);
    if (item.type) { const duplicate = document.createElement('button'); duplicate.type = 'button'; duplicate.className = 'secondary-button'; duplicate.textContent = 'Duplicar'; duplicate.onclick = () => editor.run('duplicate'); actions.append(duplicate); }
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary-button danger-button'; remove.textContent = 'Eliminar'; remove.onclick = () => editor.deleteSelection(); actions.append(remove);
  }
  exportOptions() {
    const box = document.createElement('div'); box.className = 'property-form';
    const label = document.createElement('label'); label.htmlFor = 'export-background'; label.textContent = 'Fondo de exportación';
    const color = document.createElement('input'); color.type = 'color'; color.id = 'export-background'; color.value = this.editor.exportBackground; color.oninput = () => { this.editor.exportBackground = color.value; };
    const help = document.createElement('p'); help.className = 'field-help'; help.textContent = 'PNG se exporta a escala 2×. SVG conserva los elementos vectoriales.';
    box.append(label, color, help); this.root.append(box);
  }
}
