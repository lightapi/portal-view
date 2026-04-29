import type { StatusPhase } from '../listTypes';

// ── Shared color palette ──────────────────────────────────────────────────

export const TOOL_COLORS = [
  '#5c6bc0', '#26a69a', '#ec407a', '#ffa726', '#42a5f5',
  '#66bb6a', '#ab47bc', '#ef5350', '#8d6e63', '#78909c',
];

// Deterministic color derived from the first character of a name string.
export function apiIconColor(name: string): string {
  const char = (name ?? '?')[0].toUpperCase();
  return TOOL_COLORS[char.charCodeAt(0) % TOOL_COLORS.length];
}

// Alias kept separate so call-sites can be semantically clear.
export const toolColor = apiIconColor;

// ── Environment tag → hex color ───────────────────────────────────────────

/** Maps a short environment tag to a representative hex color. */
export function envColor(tag?: string): string {
  switch ((tag ?? '').toLowerCase()) {
    case 'prd': case 'prod': return '#ef5350';
    case 'stg': case 'staging': return '#ffa726';
    default: return '#42a5f5';
  }
}
