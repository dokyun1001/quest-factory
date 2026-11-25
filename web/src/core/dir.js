export const DIRS = ['N', 'E', 'S', 'W'];
export const VEC = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const CW = { N: 'E', E: 'S', S: 'W', W: 'N' };
export const ARROW = { N: '↑', E: '→', S: '↓', W: '←' };
// Edge midpoint offsets in tile units (0..1), y down
export const EDGE = { N: [0.5, 0], S: [0.5, 1], E: [1, 0.5], W: [0, 0.5] };
export function dirBetween(ax, ay, bx, by) {
  if (bx > ax) return 'E'; if (bx < ax) return 'W'; if (by > ay) return 'S'; if (by < ay) return 'N'; return null;
}
