export class ContextMenu {
  constructor(editor) {
    this.element = document.getElementById('context-menu');
    for (const [action, label] of [['copy', 'Copiar'], ['paste', 'Pegar'], ['duplicate', 'Duplicar'], ['delete', 'Eliminar']]) {
      const button = document.createElement('button'); button.role = 'menuitem'; button.textContent = label;
      button.onclick = () => { this.close(); editor.run(action); }; this.element.append(button);
    }
    document.addEventListener('pointerdown', e => { if (!this.element.contains(e.target)) this.close(); });
  }
  open(x, y) { this.element.hidden = false; this.element.style.left = `${Math.min(x, innerWidth - 180)}px`; this.element.style.top = `${Math.min(y, innerHeight - 185)}px`; this.element.querySelector('button').focus(); }
  close() { this.element.hidden = true; }
}
