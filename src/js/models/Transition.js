import { createId } from '../utils/identifiers.js';
export function createTransition(sourceId, targetId) {
  return { id: createId('transition'), sourceId, targetId, event: '', guard: '', action: '', controlPoints: [] };
}
export function transitionLabel(transition) {
  return [transition.event, transition.guard ? `[${transition.guard}]` : '', transition.action ? `/ ${transition.action}` : ''].filter(Boolean).join(' ');
}
