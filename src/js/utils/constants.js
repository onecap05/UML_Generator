export const GRID = 20;
export const WORLD = { width: 5000, height: 3500 };
export const NODE_TYPES = {
  initial: { label: 'Estado inicial', name: 'Inicial', width: 26, height: 26 },
  state: { label: 'Estado simple', name: 'Estado', width: 170, height: 100 },
  final: { label: 'Estado final', name: 'Final', width: 34, height: 34 },
  composite: { label: 'Estado compuesto', name: 'Compuesto', width: 420, height: 300 },
  choice: { label: 'Elección', name: 'Elección', width: 48, height: 48 },
  fork: { label: 'Bifurcación', name: 'Fork', width: 130, height: 10 },
  join: { label: 'Unión', name: 'Join', width: 130, height: 10 }
};
export const MIN_SIZE = { state: [100, 60], composite: [220, 160], fork: [10, 10], join: [10, 10] };
export const clone = value => structuredClone(value);
export const svgElement = (tag, attributes = {}) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
};
