import { NODE_TYPES, WORLD } from '../utils/constants.js';
import { validateDiagram } from './DiagramValidator.js';

const text = (value, fallback = '') => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > 10000) throw new Error('El proyecto contiene texto inválido o demasiado largo.');
  return value;
};
const number = (value, min, max) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('El proyecto contiene coordenadas o dimensiones fuera de rango.');
  return value;
};
/** Copies only allowlisted data. Imported strings are never inserted as markup. */
export function parseProject(json) {
  if (typeof json !== 'string' || json.length > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.');
  let raw;
  try { raw = JSON.parse(json); } catch { throw new Error('El archivo no contiene JSON válido.'); }
  if (!raw || raw.version !== '1.0') throw new Error('Versión incompatible. Se requiere un proyecto JSON versión 1.0.');
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.transitions) || raw.nodes.length > 1000 || raw.transitions.length > 3000 || !raw.metadata || typeof raw.metadata !== 'object') throw new Error('La estructura del proyecto no es válida o supera los límites de seguridad.');
  const id = value => { if (typeof value !== 'string' || !value || value.length > 200) throw new Error('Hay un identificador no válido.'); return value; };
  const nodes = raw.nodes.map(n => {
    if (!n || !Object.hasOwn(NODE_TYPES, n.type)) throw new Error('El proyecto incluye un tipo de elemento no compatible.');
    const node = { id: id(n.id), type: n.type, name: text(n.name, NODE_TYPES[n.type].name), x: number(n.x, 0, WORLD.width), y: number(n.y, 0, WORLD.height), width: number(n.width, 6, WORLD.width), height: number(n.height, 6, WORLD.height), parentId: n.parentId == null ? null : id(n.parentId), entry: text(n.entry), do: text(n.do), exit: text(n.exit), orientation: n.orientation === 'vertical' ? 'vertical' : 'horizontal' };
    if (node.x + node.width > WORLD.width || node.y + node.height > WORLD.height) throw new Error('Un elemento excede el tamaño máximo del lienzo.');
    return node;
  });
  const transitions = raw.transitions.map(t => {
    if (!t || (t.controlPoints !== undefined && (!Array.isArray(t.controlPoints) || t.controlPoints.length > 100))) throw new Error('Puntos de control no válidos.');
    return { id: id(t.id), sourceId: id(t.sourceId), targetId: id(t.targetId), event: text(t.event), guard: text(t.guard), action: text(t.action), controlPoints: (t.controlPoints ?? []).map(p => ({ x: number(p?.x, 0, WORLD.width), y: number(p?.y, 0, WORLD.height) })) };
  });
  const data = { version: '1.0', metadata: { name: text(raw.metadata.name, 'Máquina de estados'), createdAt: text(raw.metadata.createdAt, new Date().toISOString()), updatedAt: text(raw.metadata.updatedAt, new Date().toISOString()) }, nodes, transitions, viewport: { x: number(raw.viewport?.x ?? 0, 0, WORLD.width * 3), y: number(raw.viewport?.y ?? 0, 0, WORLD.height * 3), zoom: number(raw.viewport?.zoom ?? 1, .2, 3) } };
  const fatal = validateDiagram(data).filter(i => i.severity === 'error' && /identificadores|inexistente|contenedor|circular/.test(i.message));
  if (fatal.length) throw new Error(`No se puede abrir: ${fatal[0].message}`);
  return data;
}
