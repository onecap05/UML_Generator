import { icon } from './icons.js';
export class Toolbar {
  constructor(editor) {
    this.editor = editor;
    this.buttons = {};
    const add = (group, action, label, glyph, title = label, iconOnly = false) => {
      const button = document.createElement('button'); button.className = `tool-button${action === 'save' ? ' primary' : ''}`; button.title = title; button.setAttribute('aria-label', label);
      button.innerHTML = icon(glyph); // Only fixed, internal icon paths enter innerHTML.
      if (!iconOnly) button.append(document.createTextNode(label));
      button.addEventListener('click', () => editor.run(action)); document.getElementById(group).append(button); this.buttons[action] = button;
    };
    add('file-tools', 'new', 'Nuevo', 'new'); add('file-tools', 'open', 'Abrir', 'open'); add('file-tools', 'save', 'Guardar', 'save', 'Guardar proyecto JSON · Ctrl + S');
    add('history-tools', 'undo', 'Deshacer', 'undo', 'Deshacer · Ctrl + Z', true); add('history-tools', 'redo', 'Rehacer', 'redo', 'Rehacer · Ctrl + Y', true);
    add('export-tools', 'svg', 'SVG', 'export', 'Exportar SVG completo'); add('export-tools', 'png', 'PNG', 'export', 'Exportar PNG a escala 2×');
    add('zoom-tools', 'zoom-out', 'Alejar', 'minus', 'Alejar', true);
    this.zoom = document.createElement('span'); this.zoom.className = 'zoom-output'; document.getElementById('zoom-tools').append(this.zoom);
    add('zoom-tools', 'zoom-in', 'Acercar', 'plus', 'Acercar', true); add('zoom-tools', 'fit', 'Ajustar', 'fit', 'Ajustar contenido a la vista', true);
  }
  update() {
    this.buttons.undo.disabled = !this.editor.history.undoStack.length; this.buttons.redo.disabled = !this.editor.history.redoStack.length;
    this.zoom.textContent = `${Math.round(this.editor.zoom.value * 100)}%`;
  }
}
