export type PathPoint = { x: number; y: number };

/** Corner radius, in px, before it is capped by the shorter of the two adjoining segments. */
const CORNER_RADIUS = 8;

const distance = (a: PathPoint, b: PathPoint) => Math.hypot(b.x - a.x, b.y - a.y);

/** Point `length` px from `from` along the line towards `towards`. */
const along = (from: PathPoint, towards: PathPoint, length: number): PathPoint => {
  const span = distance(from, towards);
  if (span === 0) return from;

  const ratio = length / span;
  return {
    x: from.x + (towards.x - from.x) * ratio,
    y: from.y + (towards.y - from.y) * ratio,
  };
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * SVG path through ELK's bend points with the corners rounded off.
 *
 * reaflow offers "linear", which draws the right angles ELK produced but leaves them sharp,
 * and "curved", which runs the whole path through curveBundle and loses the orthogonal
 * routing entirely. This keeps the straight runs and only softens where they meet.
 *
 * Each corner is cut back by the radius along both adjoining segments and bridged with a
 * quadratic curve whose control point is the original corner. The radius is capped at half
 * of the shorter neighbour, so a short segment between two bends cannot be overrun by the
 * curves on either side of it.
 */
export const roundedOrthogonalPath = (points: PathPoint[], radius = CORNER_RADIUS): string => {
  if (points.length === 0) return "";

  const [first] = points;
  if (points.length === 1) return `M${round(first.x)},${round(first.y)}`;

  let path = `M${round(first.x)},${round(first.y)}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];

    const cut = Math.min(radius, distance(previous, corner) / 2, distance(corner, next) / 2);
    const enter = along(corner, previous, cut);
    const exit = along(corner, next, cut);

    path += `L${round(enter.x)},${round(enter.y)}`;
    path += `Q${round(corner.x)},${round(corner.y)} ${round(exit.x)},${round(exit.y)}`;
  }

  const last = points[points.length - 1];
  path += `L${round(last.x)},${round(last.y)}`;

  return path;
};
