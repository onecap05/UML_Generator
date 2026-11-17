import { NODE_TYPES, WORLD } from '../utils/constants.js';
import { createId } from '../utils/identifiers.js';
export function createNode(type, x, y, index = 1) {
  const definition = NODE_TYPES[type];
  if (!definition) throw new Error('Tipo de estado no compatible.');
  return { id: createId(), type, name: `${definition.name} ${index}`, x: Math.max(20, Math.min(WORLD.width - definition.width, x)), y: Math.max(20, Math.min(WORLD.height - definition.height, y)), width: definition.width, height: definition.height, parentId: null, entry: '', do: '', exit: '', orientation: 'horizontal' };
}
