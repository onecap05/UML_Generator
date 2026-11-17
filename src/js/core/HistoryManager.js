import { clone } from '../utils/constants.js';
/** One snapshot per completed gesture; pointer moves never flood the history. */
export class HistoryManager {
  constructor(limit = 100) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
  record(before, after) {
    const comparable = data => JSON.stringify({ nodes: data.nodes, transitions: data.transitions, metadata: { ...data.metadata, updatedAt: '' } });
    if (comparable(before) === comparable(after)) return false;
    this.undoStack.push(clone(before));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    return true;
  }
  undo(current) { if (!this.undoStack.length) return null; this.redoStack.push(clone(current)); return this.undoStack.pop(); }
  redo(current) { if (!this.redoStack.length) return null; this.undoStack.push(clone(current)); return this.redoStack.pop(); }
  clear() { this.undoStack = []; this.redoStack = []; }
}
