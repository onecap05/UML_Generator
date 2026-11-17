import { svgElement as svg, MIN_SIZE } from '../utils/constants.js';

function label(parent, content, x, y, className, anchor = 'start') {
  const text = svg('text', { x, y, class: className, 'text-anchor': anchor });
  text.textContent = content; parent.append(text); return text;
}
function clippedText(value, width, fontSize = 12) {
  const max = Math.max(4, Math.floor(width / (fontSize * .56)));
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
export function renderNode(group, node, selected) {
  const { width: w, height: h, type } = node;
  group.replaceChildren();
  group.setAttribute('transform', `translate(${node.x} ${node.y})`);
  group.setAttribute('class', `node${selected ? ' selected' : ''}`);
  group.setAttribute('data-type', type);
  group.setAttribute('aria-label', node.name);
  const title = svg('title'); title.textContent = [node.name, node.entry && `entry / ${node.entry}`, node.do && `do / ${node.do}`, node.exit && `exit / ${node.exit}`].filter(Boolean).join('\n'); group.append(title);
  if (type === 'initial' || type === 'final') {
    group.append(svg('ellipse', { cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2, class: type === 'initial' ? 'shape solid' : 'shape' }));
    if (type === 'final') group.append(svg('ellipse', { cx: w / 2, cy: h / 2, rx: w / 2 - 6, ry: h / 2 - 6, class: 'solid' }));
  } else if (type === 'choice') group.append(svg('path', { d: `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`, class: 'shape' }));
  else if (type === 'fork' || type === 'join') group.append(svg('rect', { x: 0, y: 0, width: w, height: h, rx: 2, class: 'shape solid' }));
  else {
    group.append(svg('rect', { x: 0, y: 0, width: w, height: h, rx: 11, class: 'shape' }));
    label(group, clippedText(node.name, w - 24), w / 2, 26, 'node-title', 'middle');
    const behaviors = ['entry', 'do', 'exit'].filter(key => node[key]);
    if (behaviors.length || type === 'composite') group.append(svg('path', { d: `M 0 40 H ${w}`, class: 'divider' }));
    if (type === 'composite') label(group, 'REGIÓN', 14, h - 12, 'composite-label');
    const visibleLines = Math.floor((h - 49) / 18);
    behaviors.slice(0, visibleLines).forEach((key, index) => label(group, clippedText(`${key} / ${node[key].replace(/\n/g, ' ')}`, w - 25, 11), 13, 59 + index * 18, 'node-body'));
  }
  if (!selected) return;
  const handles = svg('g', { 'data-ui': 'true' });
  handles.append(svg('rect', { x: -5, y: -5, width: w + 10, height: h + 10, rx: 3, class: 'selection-box' }));
  if (type !== 'final') for (const [side, cx, cy] of [['top', w / 2, 0], ['right', w, h / 2], ['bottom', w / 2, h], ['left', 0, h / 2]]) handles.append(svg('circle', { cx, cy, r: 4.5, class: 'port', 'data-port': side }));
  if (MIN_SIZE[type]) handles.append(svg('rect', { x: w - 4, y: h - 4, width: 8, height: 8, class: 'resize-handle', 'data-resize': 'true' }));
  group.append(handles);
}
