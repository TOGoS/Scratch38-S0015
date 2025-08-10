import { assert } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import AABB2D from "../../lib/ts/termdraw/AABB2D.ts";
import TextRaster2 from "../../lib/ts/termdraw/TextRaster2.ts";
import Vec2D from "../../lib/ts/termdraw/Vec2D.ts";
import { blitToRaster } from "../../lib/ts/termdraw/textraster2utils.ts";

// Automatic 'component' layout system
// 
// General idea is like so:
// 
//  .-----------------------.
// ( Abstract component tree )
//  '-----------------------'
//    \
//     '-- pack --.
//                v
//  .-----------------------.
// ( Packed component tree   )
//  '-----------------------'
//    \
//     '-- fill(area) --.
//                      v
//  .----------------------------.
// ( With position/sizes baked in )
//  '----------------------------'
//    \
//     '-- toRaster(region) --.
//                            v
//  .----------------------------.
// ( TextRaster2                  )
//  '----------------------------'

/**
 * Component without any notion of size;
 */
export interface AbstractRasterable {
	pack() : PackedRasterable;
}

/**
 * Component that knows its 'natural minimum bounds'
 * but can still be asked to cram itself into
 * a differently-sized space
 */
export interface PackedRasterable {
	/**
	 * Bounding box of this object, relative to its own origin,
	 * which is usually arbirary and unimportant
	 * (but maybe not always, which is why this isn't just a Vec2D
	 * with the origin implied to be in the top-left corner).
	 * i.e. the bounds oc a child element are *not*
	 * relative to any ancestors' coordinate system!
	 * Parents know where their children are, not the other way around.
	 */
	readonly bounds : AABB2D<number>;
	/**
	 * Inflate as desired to fill the given space;
	 * result may be larger or smaller than the given region;
	 * it is a suggestion.
	 * 
	 * TODO: Should probably just indicate a size, not 'bounds'
	 */
	fill(bounds : AABB2D<number>) : SizedRasterable
}

export interface RegionRasterable {
	toRaster(region:AABB2D<number>) : TextRaster2;	
}

/**
 * A thing that is conceptually 'all layed out' and can be queried
 * for an image of part of itself
 */
export interface SizedRasterable extends RegionRasterable {
	readonly bounds : AABB2D<number>;
}

export function rasterToSize(raster:TextRaster2, targetSize:Vec2D<number>) : TextRaster2 {
	// Hmm: Could take whatever it gives us and massage it to the target size,
	// but that's kind of what toRaster was supposed to do, so for now let's
	// just panic if it doesn't match:
	assert(raster.size.x == targetSize.x);
	assert(raster.size.y == targetSize.y);
	return raster;
}

export function rasterizeRasterableToSize(rasterable:SizedRasterable, targetSize:Vec2D<number>) : TextRaster2 {
	const rcx : number = (rasterable.bounds.x0 + rasterable.bounds.x1) / 2;
	const rcy : number = (rasterable.bounds.y0 + rasterable.bounds.y1) / 2;
	const rast = rasterable.toRaster({
		x0: rcx - targetSize.x / 2,
		y0: rcy - targetSize.y / 2,
		x1: rcx + targetSize.x / 2,
		y1: rcy + targetSize.y / 2,
	})
	return rasterToSize(rast, targetSize);
}

export function rasterizePackedRasterableToSize(packrast:PackedRasterable, targetSize:Vec2D<number>) : TextRaster2 {
	const targetBounds = {
		x0: 0, y0: 0,
		x1: targetSize.x, y1: targetSize.y
	};
	return rasterizeRasterableToSize(packrast.fill(targetBounds), targetSize);
}

export function rasterizeAbstractRasterableToSize(abstrast:AbstractRasterable, targetSize:Vec2D<number>) : TextRaster2 {
	return rasterizePackedRasterableToSize(abstrast.pack(), targetSize);
}

//// Some building blocks

// TODO: Review/test; this was originally copilot-generated

/**
 * Rasterable that makes no effort to conform to any given size,
 * and packs to the size of the raster.
 */
export class FixedRasterable implements AbstractRasterable, PackedRasterable, SizedRasterable {
	#raster : TextRaster2;
	#bounds : AABB2D<number>;
	constructor(raster:TextRaster2) {
		this.#raster = raster;
		this.#bounds = {x0: 0, y0: 0, x1: raster.size.x, y1: raster.size.y}
	}
	pack() : PackedRasterable {
		return this;
	}
	get bounds() : AABB2D<number> {
		return this.#bounds;
	}
	fill(_bounds: AABB2D<number>): SizedRasterable {
		return this;
	}
	toRaster(_region: AABB2D<number>) : TextRaster2 {
		return this.#raster;
	}
}

export class AbstractBorderRasterable implements AbstractRasterable {
	readonly #inner: AbstractRasterable;
	readonly #borderWidth: number;
	readonly #background: RegionRasterable;
	
	constructor(
		inner: AbstractRasterable,
		borderWidth: number,
		background: RegionRasterable
	) {
		this.#inner = inner;
		this.#borderWidth = borderWidth;
		this.#background = background;
	}
	
	pack(): PackedRasterable {
		const packedInner = this.#inner.pack();
		const b = this.#borderWidth;
		const bounds = {
			x0: packedInner.bounds.x0 - b,
			y0: packedInner.bounds.y0 - b,
			x1: packedInner.bounds.x1 + b,
			y1: packedInner.bounds.y1 + b,
		};
		return new PackedBorderRasterable(
			packedInner,
			this.#borderWidth,
			this.#background,
			bounds
		);
	}
}

class PackedBorderRasterable implements PackedRasterable {
	readonly bounds: AABB2D<number>;
	readonly #packedInner: PackedRasterable;
	readonly #borderWidth: number;
	readonly #background: RegionRasterable;
	
	constructor(
		packedInner: PackedRasterable,
		borderWidth: number,
		background: RegionRasterable,
		bounds: AABB2D<number>
	) {
		this.#packedInner = packedInner;
		this.#borderWidth = borderWidth;
		this.#background = background;
		this.bounds = bounds;
	}
	
	fill(bounds: AABB2D<number>): SizedRasterable {
		const b = this.#borderWidth;
		const innerBounds = {
			x0: bounds.x0 + b,
			y0: bounds.y0 + b,
			x1: bounds.x1 - b,
			y1: bounds.y1 - b,
		};
		const filledInner = this.#packedInner.fill(innerBounds);
		return new BorderedRasterable(
			filledInner,
			bounds,
			this.#borderWidth,
			this.#background
		);
	}
}

class BorderedRasterable implements SizedRasterable {
	readonly bounds: AABB2D<number>;
	readonly #inner: SizedRasterable;
	readonly #borderWidth: number;
	readonly #background : RegionRasterable;

	constructor(
		inner: SizedRasterable,
		bounds: AABB2D<number>,
		borderWidth: number,
		background: RegionRasterable
	) {
		this.#inner = inner;
		this.bounds = bounds;
		this.#borderWidth = borderWidth;
		this.#background = background;
	}
	
	toRaster(region: AABB2D<number>): TextRaster2 {
		const background = this.#background.toRaster(region);
		const innerBounds = this.#inner.bounds;
		const innerW = innerBounds.x1 - innerBounds.x0;
		const innerH = innerBounds.y1 - innerBounds.y0;
		const iX = Math.round((this.bounds.x0 + this.bounds.x1 - innerW) / 2);
		const iY = Math.round((this.bounds.y0 + this.bounds.y1 - innerH) / 2);
		const innerRegion = {
			x0: iX, y0: iX,
			x1: iX + innerW,
			y1: iY + innerH,
		};
		const inner = this.#inner.toRaster(innerRegion);
		return blitToRaster(background, {x: iX - region.x0, y: iY - region.y0}, inner);
	}
}

const ZERO_BOUNDS = {x0:0, y0:0, x1:0, y1: 0};

export class PaddingRasterable implements AbstractRasterable, PackedRasterable {
	readonly #background: RegionRasterable;
	constructor(background: RegionRasterable) {
		this.#background = background;
	}
	get bounds() { return ZERO_BOUNDS; }
	pack(): PackedRasterable {
		return this;
	}
	fill(bounds: AABB2D<number>): SizedRasterable {
		return {
			bounds,
			toRaster: this.#background.toRaster.bind(this.#background),
		};
	}
}

// TODO: 'flex' rasterable, which lays children out in rows and/or columns,
// similar to HTML/CSS flexbox

type FlexDirection = "rows"|"columns";
interface FlexChild<T> {
	component: T;
	flexShrink: number;
	flexGrow: number;
}

export class PackedFlexRasterable implements PackedRasterable {
	readonly bounds : AABB2D<number>;
	readonly #children : FlexChild<PackedRasterable>[];
	readonly #direction : FlexDirection;
	constructor(direction:FlexDirection, bounds:AABB2D<number>, children:FlexChild<PackedRasterable>[]) {
		this.bounds = bounds;
		this.#direction = direction;
		this.#children = children;
	}
	fill(bounds: AABB2D<number>): SizedRasterable {
		const horiz = this.#direction == "rows";
		
		const rows = [];
		const boxWidth  = bounds.x1 - bounds.x0;
		const boxHeight = bounds.y1 - bounds.y0;
		const boxLength = horiz ? boxWidth : boxHeight;
		const boxDepth  = horiz ? boxHeight : boxWidth;

		if( this.#children.length > 0 ) {
			let currentRowLength = 0;
			let currentRow : FlexChild<PackedRasterable>[] = [];
			
			// Lay packed children out in rows or columns (depending on direction),
			// wrapping when the total width or height overflows the bounds specified,
			// always cramming at least one into each row.
			
			// length / depth = main-axis / cross-axis (in flexbox terms)
			for( const child of this.#children ) {
				const cBounds = child.component.bounds;
				const cWidth  = cBounds.x1 - cBounds.x0;
				const cHeight = cBounds.y1 - cBounds.y0;
				const cLength = horiz ? cWidth : cHeight;
				// const cDepth  = horiz ? cHeight : cWidth;
				const currentRowTentativeLength = currentRowLength + cLength;
				if( currentRow.length == 0 || currentRowTentativeLength <= boxLength ) {
					currentRow.push(child);
					currentRowLength = currentRowTentativeLength;
				} else {
					rows.push(currentRow = [child]);
					currentRowLength = cLength;
				}
			}
		}
		
		const sizedChildren : {bounds:AABB2D<number>, component:SizedRasterable}[] = [];
		
		let across = 0;
		for( const row of rows ) {
			let along = 0;
			let maxDepth = 0;
			let totalLength = 0;
			let totalShrink = 0;
			let totalGrow = 0;
			for( const child of row ) {
				const cBounds = child.component.bounds;
				const cWidth  = cBounds.x1 - cBounds.x0;
				const cHeight = cBounds.y1 - cBounds.y0;
				const cLength = horiz ? cWidth : cHeight;
				const cDepth  = horiz ? cHeight : cWidth;
				totalLength += cLength;
				maxDepth = Math.max(maxDepth, cDepth);
				totalShrink += child.flexShrink;
				totalGrow   += child.flexGrow;
			}
			const leftoverLength = boxLength - totalLength;
			if( leftoverLength < 0 ) throw new Error("TODO: Implement shrinking");
			if( leftoverLength > 0 && totalGrow == 0 ) throw new Error("TODO: Handle case where totalGrow = 0");
			// TODO: deal with case where we need to shrink/expand but totalGrow / totalShrink is 0 by spreading it to everyone
			// TODO: Deal with 'have to shrink' case
			for( const child of row ) {
				const cBounds = child.component.bounds;
				const cWidth  = cBounds.x1 - cBounds.x0;
				const cHeight = cBounds.y1 - cBounds.y0;
				const cLength = horiz ? cWidth : cHeight;
				const filledLength = Math.round(cLength + leftoverLength * child.flexGrow / totalGrow);
				const cX = horiz ? along : across;
				const cY = horiz ? across : along;
				const cFilledWidth  = horiz ? filledLength : maxDepth;
				const cFilledHeight = horiz ? maxDepth : filledLength;
				
				// TODO: Watch out for rounding errors, lest we end up at along = not quite filledLength;
				// maybe recalculate based on actual remaining space as we iterate through the children.
				sizedChildren.push({
					bounds: {
						x0: cX, y0: cY,
						x1: cX + cFilledWidth,
						y1: cY + cFilledHeight,
					},
					component: child.component.fill({x0:0, y0:0, x1: cFilledWidth, y1: cFilledHeight})
				});
				along += filledLength;
			}
			
			// Hmm: Might want to expand/shrink the rows, too!
			across += maxDepth;
		}
		
		// TODO: Define this; at this point the 'flexing' is done,
		// so the result can be more generic.
		// return new CompoundSizedRasterable(box size, sizedChildren);
		throw new Error("TODO: Define CompoundSizedRasterable");
	}
}
export class AbstractFlexRasterable implements AbstractRasterable {
	readonly #children : FlexChild<AbstractRasterable>[];
	readonly #direction : FlexDirection;
	constructor(direction:FlexDirection, children:FlexChild<AbstractRasterable>[]) {
		this.#children = children;
		this.#direction = direction;
	}
	pack(): PackedRasterable {
		const packedChildren = this.#children.map(c => ({
			component: c.component.pack(),
			flexGrow: c.flexGrow,
			flexShrink: c.flexShrink,
		}));
		let totalWidth = 0;
		let totalHeight = 0;
		if( this.#direction == "rows" ) {
			for( const child of packedChildren ) {
				const bounds = child.component.bounds;
				totalWidth += bounds.x1 - bounds.x0;
				totalHeight = Math.max(totalHeight, bounds.y1 - bounds.y0);
			}
		} else {
			for( const child of packedChildren ) {
				const bounds = child.component.bounds;
				totalWidth  = Math.max(totalWidth, bounds.x1 - bounds.x0);
				totalHeight += bounds.y1 - bounds.y0;
			}
		}
		return new PackedFlexRasterable(this.#direction, {x0:0, y0:0, x1:totalWidth, y1:totalHeight}, packedChildren);
	}
}
