import { DiagramModel } from '../src/js/core/DiagramModel.js';
import { transitionGeometry } from '../src/js/utils/geometry.js';

const model = new DiagramModel();
for (let i = 0; i < 100; i++) model.addNode('state', 70 + (i % 10) * 400, 100 + Math.floor(i / 10) * 300);
for (let i = 0; i < 200; i++) model.addTransition(model.nodes[i % 100].id, model.nodes[(i * 7 + 13) % 100].id);
const start = performance.now();
for (const t of model.transitions) transitionGeometry(t, model.nodes, model.transitions);
console.log(`100 estados / 200 transiciones: cálculo de todas las rutas en ${(performance.now() - start).toFixed(1)} ms. La selección reutiliza las rutas almacenadas.`);
