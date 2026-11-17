import { icon } from './icons.js';
import { NODE_TYPES } from '../utils/constants.js';
export class ComponentPalette {
  constructor(editor) {
    this.editor = editor; this.buttons = new Map(); const palette = document.getElementById('palette');
    for (const [title, tools] of [['Herramientas', ['select', 'transition']], ['Estados', ['initial', 'state', 'final', 'composite']], ['Pseudestados', ['choice', 'fork', 'join']]]) {
      const heading = document.createElement('h3'); heading.className = 'palette-category'; heading.textContent = title; palette.append(heading);
      for (const type of tools) {
        const button = document.createElement('button'); button.className = 'palette-item'; button.dataset.tool = type;
        button.innerHTML = icon(type); const text = document.createElement('span'); text.textContent = NODE_TYPES[type]?.label ?? (type === 'select' ? 'Seleccionar' : 'Transición'); button.append(text);
        button.title = NODE_TYPES[type] ? `Arrastrar o hacer clic para crear: ${NODE_TYPES[type].label}` : type === 'select' ? 'Seleccionar y mover · V' : 'Conectar origen y destino · T';
        button.draggable = Boolean(NODE_TYPES[type]);
        button.addEventListener('click', () => editor.setTool(type));
        button.addEventListener('dragstart', event => { event.dataTransfer.setData('application/x-uml-node', type); event.dataTransfer.effectAllowed = 'copy'; });
        palette.append(button); this.buttons.set(type, button);
      }
    }
  }
  update(tool) { for (const [type, button] of this.buttons) { button.classList.toggle('active', tool === type); button.setAttribute('aria-pressed', tool === type); } }
}
