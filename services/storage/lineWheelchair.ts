// GTFS-derived wheelchair accessibility per bus line
// true = accessible, false = not accessible, null = unknown
const data = require('../../assets/line_wheelchair.json') as Record<string, boolean | null>;

export function isLineWheelchairAccessible(lineName: string): boolean | null {
  const val = data[lineName.trim()];
  return val === undefined ? null : val;
}
