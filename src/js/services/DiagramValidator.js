/** Structural checks report errors separately from incomplete-model warnings. */
export function validateDiagram(data) {
  const issues = [], ids = new Set(), nodes = new Map(data.nodes.map(n => [n.id, n]));
  const add = (severity, message, elementId) => issues.push({ severity, message, elementId });
  for (const element of [...data.nodes, ...data.transitions]) {
    if (ids.has(element.id)) add('error', 'Hay identificadores duplicados en el proyecto.', element.id);
    ids.add(element.id);
  }
  for (const n of data.nodes) {
    if (n.parentId && nodes.get(n.parentId)?.type !== 'composite') add('error', `${n.name}: el contenedor no existe o no es compuesto.`, n.id);
    const visited = new Set([n.id]);
    let current = n;
    while (current?.parentId) {
      if (visited.has(current.parentId)) { add('error', `${n.name}: pertenencia circular.`, n.id); break; }
      visited.add(current.parentId); current = nodes.get(current.parentId);
    }
    const incoming = data.transitions.filter(t => t.targetId === n.id), outgoing = data.transitions.filter(t => t.sourceId === n.id);
    if (n.type === 'initial' && incoming.length) add('error', `${n.name}: un inicial no admite transiciones entrantes.`, n.id);
    if (n.type === 'final' && outgoing.length) add('error', `${n.name}: un final no admite transiciones salientes.`, n.id);
    if (n.type === 'initial' && outgoing.length !== 1) add('warning', `${n.name}: se espera una transición saliente.`, n.id);
    if (n.type === 'fork' && (incoming.length !== 1 || outgoing.length < 2)) add('warning', `${n.name}: se espera una entrada y al menos dos salidas.`, n.id);
    if (n.type === 'join' && (incoming.length < 2 || outgoing.length !== 1)) add('warning', `${n.name}: se esperan al menos dos entradas y una salida.`, n.id);
    if (n.type === 'choice' && (outgoing.length < 2 || outgoing.some(t => !t.guard.trim()))) add('warning', `${n.name}: añade al menos dos salidas con guardas.`, n.id);
    if (!incoming.length && !outgoing.length && n.type !== 'composite') add('warning', `${n.name}: el elemento está desconectado.`, n.id);
    if (n.parentId) {
      const p = nodes.get(n.parentId);
      if (p && (n.x < p.x + 10 || n.y < p.y + 44 || n.x + n.width > p.x + p.width - 10 || n.y + n.height > p.y + p.height - 10)) add('warning', `${n.name}: está fuera del área de su contenedor.`, n.id);
    }
  }
  const regions = new Map();
  for (const n of data.nodes.filter(n => n.type === 'initial')) {
    const region = n.parentId ?? 'root';
    if (regions.has(region)) add('error', 'Cada región admite como máximo un estado inicial.', n.id);
    regions.set(region, true);
  }
  if (data.nodes.length && !data.nodes.some(n => n.type === 'initial' && !n.parentId)) add('warning', 'La región principal aún no tiene un estado inicial.');
  for (const t of data.transitions) if (!nodes.has(t.sourceId) || !nodes.has(t.targetId)) add('error', 'Una transición hace referencia a un elemento inexistente.', t.id);
  return issues;
}
