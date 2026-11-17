import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiagramModel } from '../src/js/core/DiagramModel.js';
import { HistoryManager } from '../src/js/core/HistoryManager.js';
import { createId } from '../src/js/utils/identifiers.js';
import { boundaryPoint, transitionGeometry } from '../src/js/utils/geometry.js';
import { validateDiagram } from '../src/js/services/DiagramValidator.js';
import { parseProject } from '../src/js/services/ImportService.js';
import { transitionLabel } from '../src/js/models/Transition.js';

test('crea todos los tipos con nombres, geometría e identificadores únicos', () => {
  const model = new DiagramModel();
  for (const type of ['initial', 'state', 'final', 'composite', 'choice', 'fork', 'join']) {
    const node = model.addNode(type, 40, 60); assert.equal(node.type, type); assert.ok(node.width > 0); assert.ok(node.name); assert.equal(node.x, 40);
  }
  const ids = Array.from({ length: 10000 }, () => createId()); assert.equal(new Set(ids).size, ids.length);
});
test('conecta, formatea etiquetas UML, permite bucles y bloquea extremos prohibidos', () => {
  const model = new DiagramModel(), a = model.addNode('initial', 30, 60), b = model.addNode('state', 200, 60), c = model.addNode('final', 500, 60);
  model.addTransition(a.id, b.id); const loop = model.addTransition(b.id, b.id); model.addTransition(b.id, c.id);
  Object.assign(loop, { event: 'pagar', guard: 'saldo >= total', action: 'confirmarPago()' });
  assert.equal(transitionLabel(loop), 'pagar [saldo >= total] / confirmarPago()');
  assert.throws(() => model.addTransition(c.id, b.id), /final/); assert.throws(() => model.addTransition(b.id, a.id), /inicial/); assert.throws(() => model.addTransition('missing', b.id), /existentes/);
});
test('elimina nodos y sus conexiones sin dañar las demás', () => {
  const m = new DiagramModel(), a = m.addNode('state', 30, 60), b = m.addNode('state', 300, 60), c = m.addNode('state', 600, 60);
  m.addTransition(a.id, b.id); m.addTransition(b.id, b.id); const retained = m.addTransition(c.id, c.id);
  m.remove([b.id]); assert.equal(m.nodes.length, 2); assert.deepEqual(m.transitions.map(t => t.id), [retained.id]); m.remove([retained.id]); assert.equal(m.transitions.length, 0);
});
test('pertenencia, movimiento, tamaño mínimo del contenedor y eliminación en cascada', () => {
  const m = new DiagramModel(), p = m.addNode('composite', 100, 100), child = m.addNode('state', 150, 180);
  assert.equal(child.parentId, p.id); m.moveNodes([p.id, child.id], 40, 20); assert.equal(child.x, 190); assert.equal(child.y, 200);
  m.resizeNode(p.id, 220, 160); assert.ok(p.width >= child.x + child.width - p.x + 15);
  m.remove([p.id]); assert.equal(m.nodes.length, 0);
});
test('duplicar jerarquías conserva conexiones internas con nuevos identificadores', () => {
  const m = new DiagramModel(), p = m.addNode('composite', 100, 100), child = m.addNode('state', 150, 180); m.addTransition(child.id, child.id);
  const ids = m.duplicate([p.id]); assert.equal(ids.length, 2); const copiedChild = m.node(ids[1]); assert.equal(copiedChild.parentId, ids[0]); assert.equal(m.transitions.length, 2); assert.equal(m.transitions[1].sourceId, copiedChild.id);
});
test('serialización e importación conservan todos los datos y extremos', () => {
  const m = new DiagramModel(), a = m.addNode('state', 50, 100), b = m.addNode('state', 350, 100); a.entry = '<script>alert(1)</script>'; const t = m.addTransition(a.id, b.id); t.guard = 'x > 3'; t.controlPoints.push({ x: 250, y: 40 });
  const data = parseProject(JSON.stringify(m.snapshot())); assert.deepEqual(data, m.snapshot()); const copy = new DiagramModel(data); copy.moveNodes([a.id], 50, 0); assert.equal(copy.transitions[0].sourceId, a.id); assert.equal(m.node(a.id).x, 50);
});
test('importación rechaza JSON inválido, versiones y referencias corruptas', () => {
  assert.throws(() => parseProject('oops'), /JSON/); assert.throws(() => parseProject('{"version":"2"}'), /Versión/);
  const m = new DiagramModel(), n = m.addNode('state', 20, 30); m.addTransition(n.id, n.id);
  let data = m.snapshot(); data.nodes.push({ ...n }); assert.throws(() => parseProject(JSON.stringify(data)), /duplicados/);
  data = m.snapshot(); data.transitions[0].targetId = 'gone'; assert.throws(() => parseProject(JSON.stringify(data)), /inexistente/);
  data = m.snapshot(); data.nodes[0].parentId = n.id; data.nodes[0].type = 'composite'; assert.throws(() => parseProject(JSON.stringify(data)), /circular/);
  data = m.snapshot(); data.nodes[0].x = null; assert.throws(() => parseProject(JSON.stringify(data)), /rango/);
  data = m.snapshot(); data.nodes[0].type = '__proto__'; assert.throws(() => parseProject(JSON.stringify(data)), /tipo/);
});
test('validación separa errores, advertencias y regiones de iniciales', () => {
  const m = new DiagramModel(), a = m.addNode('initial', 30, 50), b = m.addNode('initial', 90, 50), f = m.addNode('final', 350, 50); m.addNode('fork', 600, 100);
  m.data.transitions.push({ id: 'bad', sourceId: f.id, targetId: a.id, event: '', guard: '', action: '', controlPoints: [] });
  const issues = validateDiagram(m.data);
  assert.ok(issues.some(i => i.severity === 'error' && /región/.test(i.message))); assert.ok(issues.some(i => /entrantes/.test(i.message))); assert.ok(issues.some(i => /salientes/.test(i.message))); assert.ok(issues.some(i => i.severity === 'warning' && /Fork/.test(i.message)));
  m.remove([b.id]); const p = m.addNode('composite', 500, 400); const inner = m.addNode('initial', 550, 470); assert.equal(inner.parentId, p.id); assert.ok(!validateDiagram(m.data).some(i => /máximo/.test(i.message)));
});
test('historial deshace, rehace y elimina la rama futura tras una edición', () => {
  const m = new DiagramModel(), h = new HistoryManager(); const initial = m.snapshot(); m.addNode('state', 30, 50); h.record(initial, m.snapshot());
  const current = m.snapshot(); m.replace(h.undo(current)); assert.equal(m.nodes.length, 0); m.replace(h.redo(m.snapshot())); assert.deepEqual(m.snapshot(), current);
  m.replace(h.undo(m.snapshot())); const before = m.snapshot(); m.addNode('final', 300, 50); h.record(before, m.snapshot()); assert.equal(h.redo(m.snapshot()), null); assert.equal(h.record(m.snapshot(), m.snapshot()), false);
});
test('intersecciones exactas de rectángulo, círculo y rombo', () => {
  const node = { x: 100, y: 100, width: 100, height: 100, type: 'state' };
  assert.deepEqual(boundaryPoint(node, { x: 300, y: 150 }), { x: 200, y: 150 });
  node.type = 'initial'; const p = boundaryPoint(node, { x: 250, y: 250 }); assert.ok(Math.abs(Math.hypot(p.x - 150, p.y - 150) - 50) < 1e-7);
  node.type = 'choice'; assert.deepEqual(boundaryPoint(node, { x: 250, y: 250 }), { x: 175, y: 175 });
});
test('rutas dinámicas, bucles, conexiones paralelas y puntos de control', () => {
  const m = new DiagramModel(), a = m.addNode('state', 100, 150), b = m.addNode('state', 500, 150);
  const t = m.addTransition(a.id, b.id), reverse = m.addTransition(b.id, a.id);
  const route = transitionGeometry(t, m.nodes, m.transitions), other = transitionGeometry(reverse, m.nodes, m.transitions);
  assert.notEqual(route.path, other.path); assert.notEqual(route.label.y, other.label.y);
  const oldPath = route.path; m.moveNodes([b.id], 0, 100); assert.notEqual(transitionGeometry(t, m.nodes, m.transitions).path, oldPath);
  const loop = m.addTransition(a.id, a.id); const geometry = transitionGeometry(loop, m.nodes, m.transitions); assert.ok(geometry.points.length >= 4); assert.ok(!geometry.path.includes('NaN'));
  t.controlPoints = [{ x: 400, y: 80 }]; assert.ok(transitionGeometry(t, m.nodes, m.transitions).path.includes('400 80'));
});
test('ruta automática rodea un obstáculo entre dos estados', () => {
  const m = new DiagramModel(), a = m.addNode('state', 60, 160), b = m.addNode('state', 700, 160); m.addNode('state', 370, 130); const t = m.addTransition(a.id, b.id);
  const route = transitionGeometry(t, m.nodes, m.transitions); assert.ok(route.points.length > 2); assert.ok(route.points.some(p => p.y < 130 || p.y > 230));
});
