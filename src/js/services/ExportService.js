const EXPORT_STYLES = `
svg{font-family:'Segoe UI',Arial,sans-serif} .shape{fill:#fff;stroke:#53677e;stroke-width:1.4}
[data-type="composite"] .shape{fill:#f5f8ff;fill-opacity:.8}.solid{fill:#273b50;stroke:#273b50}
.node-title{font-size:13px;font-weight:600;fill:#293f56}.node-body{font-size:11px;fill:#67798c}
.divider{stroke:#dbe2ec;stroke-width:1}.composite-label{font-size:9px;fill:#8294af;letter-spacing:1px}
.line{fill:none;stroke:#5a6f86;stroke-width:1.5;stroke-linejoin:round}
.transition-label{font-size:11px;fill:#40556f;paint-order:stroke;stroke:BACKGROUND;stroke-width:5;stroke-linejoin:round}
`;

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function projectFilename(name, extension) { return `${name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 100) || 'diagrama'}.${extension}`; }

/** Creates a standalone SVG containing only diagram data and embedded styles. */
export function buildSvg(renderer, background = '#ffffff') {
  renderer.render();
  const bounds = renderer.bounds();
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); root.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
  root.setAttribute('width', Math.ceil(bounds.width)); root.setAttribute('height', Math.ceil(bounds.height));
  const style = document.createElementNS(root.namespaceURI, 'style'); style.textContent = EXPORT_STYLES.replace('BACKGROUND', background); root.append(style);
  const defs = renderer.canvas.querySelector('defs').cloneNode(true); defs.querySelector('pattern')?.remove(); root.append(defs);
  const rect = document.createElementNS(root.namespaceURI, 'rect');
  for (const [key, value] of Object.entries({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, fill: background })) rect.setAttribute(key, value);
  root.append(rect);
  const content = renderer.content.cloneNode(true);
  content.querySelectorAll('[data-ui],.hit-area').forEach(element => element.remove());
  content.querySelectorAll('.selected').forEach(element => element.classList.remove('selected'));
  content.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
  content.querySelectorAll('[marker-end]').forEach(element => element.setAttribute('marker-end', 'url(#arrow)'));
  root.append(content);
  return { source: new XMLSerializer().serializeToString(root), width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) };
}

export async function exportPng(renderer, name, background, scale = 2) {
  const svg = buildSvg(renderer, background);
  if (svg.width * scale > 16384 || svg.height * scale > 16384 || svg.width * svg.height * scale ** 2 > 64000000) throw new Error('El diagrama es demasiado grande para PNG a 2×. Exporta SVG o reduce su extensión.');
  const url = URL.createObjectURL(new Blob([svg.source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('No se pudo convertir el SVG en imagen PNG.')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = svg.width * scale; canvas.height = svg.height * scale;
    const context = canvas.getContext('2d'); if (!context) throw new Error('El navegador no admite la exportación PNG.');
    context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar el archivo PNG.');
    downloadBlob(blob, projectFilename(name, 'png'));
  } finally { URL.revokeObjectURL(url); }
}
