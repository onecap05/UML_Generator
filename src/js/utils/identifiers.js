/** Random UUIDs work offline; the fallback also supports older static HTTP browsers. */
export function createId(prefix = 'node') {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
