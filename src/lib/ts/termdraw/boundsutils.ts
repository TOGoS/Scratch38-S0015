import AABB2D from "./AABB2D.ts";
import Vec2D from "./Vec2D.ts";

export function boundsAreEqual(a:AABB2D<number>, b:AABB2D<number>) : boolean {
  return a.x0 == b.x0 && a.y0 == b.y0 && a.x1 == b.x1 && a.y1 == b.y1;
}

export function boundsToSize(aabb:AABB2D<number>) : Vec2D<number> {
  return {x: aabb.x1 - aabb.x0, y: aabb.y1 - aabb.y0 };
}

export function intersection(a:AABB2D<number>, b:AABB2D<number>) : AABB2D<number> {
	return {
		x0: Math.max(a.x0, b.x0),
		y0: Math.max(a.y0, b.y0),
		x1: Math.min(a.x1, b.x1),
		y1: Math.min(a.y1, b.y1),
	}
}

/**
 * Convert size to bounds for cases where the position
 * of the bounding box doesn't matter (i.e. usually!)
 */
export function sizeToBounds(size:Vec2D<number>) : AABB2D<number> {
  return {x0: 0, y0: 0, x1: size.x, y1: size.y};
}

export function validateSize(size:Vec2D<number>) {
	if( size.x < 0 || !isFinite(size.x) || size.y < 0 || !isFinite(size.y) ) throw new Error(`Invalid size: ${JSON.stringify(size)}`);
	return size;
}

export function centeredExpandedBounds(objectBounds: AABB2D<number>, outerSize: Vec2D<number>): AABB2D<number> {
  const internalSize = boundsToSize(objectBounds);
  const padTop  = Math.round((outerSize.y - internalSize.y) / 2);
  const padLeft = Math.round((outerSize.x - internalSize.x) / 2);
  const adjustedInternalX0 = objectBounds.x0 - padLeft;
  const adjustedInternalY0 = objectBounds.y0 - padTop;
  return {
    x0: adjustedInternalX0,
    y0: adjustedInternalY0,
    x1: adjustedInternalX0 + outerSize.x,
    y1: adjustedInternalY0 + outerSize.y,
  };
}

