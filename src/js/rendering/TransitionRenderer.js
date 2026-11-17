import { svgElement as svg } from '../utils/constants.js';
import { transitionLabel } from '../models/Transition.js';

export function renderTransition(group, transition, geometry, selected) {
  group.replaceChildren(); group.setAttribute('class', `transition${selected ? ' selected' : ''}`);
  group.setAttribute('aria-label', `Transición ${transitionLabel(transition) || 'sin etiqueta'}`);
  if (!geometry) return;
  group.append(svg('path', { d: geometry.path, class: 'hit-area' }));
  group.append(svg('path', { d: geometry.path, class: 'line', 'marker-end': `url(#arrow${selected ? '-selected' : ''})` }));
  const content = transitionLabel(transition);
  const text = svg('text', { x: geometry.label.x, y: geometry.label.y, class: 'transition-label', 'text-anchor': 'middle' });
  // Multiple lines preserve long labels without clipping the exported diagram.
  const words = content.split(' '), lines = [''];
  for (const word of words) { if (lines.at(-1).length + word.length > 48 && lines.at(-1)) lines.push(''); lines[lines.length - 1] += `${lines.at(-1) ? ' ' : ''}${word}`; }
  lines.forEach((line, i) => { const span = svg('tspan', { x: geometry.label.x, dy: i ? 15 : 0 }); span.textContent = line; text.append(span); });
  group.append(text);
  if (selected) {
    const controls = svg('g', { 'data-ui': 'true' });
    transition.controlPoints.forEach((point, index) => controls.append(svg('circle', { cx: point.x, cy: point.y, r: 5, class: 'control-point', 'data-control': index })));
    group.append(controls);
  }
}
