export const ICONS = {
  new: '<path d="M5 2h9l5 5v15H5zM14 2v6h5M9 14h6m-3-3v6"/>',
  open: '<path d="M3 7h7l2 2h9l-3 11H3zM3 7V4h7l2 3h6v2"/>',
  save: '<path d="M4 3h14l3 3v15H3V3zM7 3v6h10V3M7 21v-8h10v8"/>',
  undo: '<path d="M8 5 3 10l5 5M3 10h10c9 0 9 10 1 10"/>',
  redo: '<path d="m16 5 5 5-5 5m5-5H11c-9 0-9 10-1 10"/>',
  export: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/>',
  minus: '<path d="M5 12h14"/>', plus: '<path d="M5 12h14M12 5v14"/>',
  fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 7h10v10H7z"/>',
  select: '<path d="m6 3 14 10-7 1-3 7z"/>',
  transition: '<path d="M3 19V6h17m-5-4 5 4-5 4"/>',
  state: '<rect x="2" y="4" width="24" height="17" rx="5"/>',
  initial: '<circle cx="14" cy="12.5" r="6" fill="currentColor" stroke="none"/>',
  final: '<circle cx="14" cy="12.5" r="9"/><circle cx="14" cy="12.5" r="5.5" fill="currentColor" stroke="none"/>',
  composite: '<rect x="1" y="2" width="26" height="21" rx="4"/><path d="M1 8h26"/><rect x="6" y="12" width="16" height="7" rx="2"/>',
  choice: '<path d="m14 2 11 10.5L14 23 3 12.5z"/>',
  fork: '<path d="M3 11h22v4H3z" fill="currentColor"/><path d="M14 2v9M8 15v8m12-8v8"/>',
  join: '<path d="M3 11h22v4H3z" fill="currentColor"/><path d="M8 2v9m12-9v9m-6 4v8"/>'
};
export function icon(name) { return `<svg viewBox="0 0 ${['initial','final','state','composite','choice','fork','join'].includes(name) ? '28 25' : '24 24'}" aria-hidden="true">${ICONS[name] ?? ''}</svg>`; }
