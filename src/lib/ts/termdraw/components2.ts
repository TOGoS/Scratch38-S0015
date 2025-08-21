import AABB2D from "./AABB2D.ts";
import TextRaster2, { Style } from "./TextRaster2.ts";
import Vec2D from "./Vec2D.ts";
import { blitToRaster, createUniformRaster } from "./textraster2utils.ts";

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
// Hmm: I don't really want to force all implementations to implement SizedRasterGenerator;
// it is trivial enough to turn one of this into one of that.
// Maybe I'll replace that with a generic wrapper thing,
// which can also take care of memoization.
export interface AbstractRasterable extends SizedRasterGenerator {
	pack() : PackedRasterable;
}

export interface SizedRasterGenerator {
	rasterForSize(size : Vec2D<number>) : TextRaster2;
}

export interface RegionRasterableGenerator {
	/**
	 * Generate a SizedRasterable that fills the given space;
	 * result may be larger or smaller than the given region
	 * and positioned differently; area is just a suggestion.
	 */
	rasterableForRegion(area : AABB2D<number>) : BoundedRasterable
}

export interface SizedRasterableGenerator {
	/**
	 * Generate a SizedRasterable that fills the given space;
	 * result may be larger or smaller than the given region;
	 * it is a suggestion.
	 */
	rasterableForSize(size : Vec2D<number>) : BoundedRasterable
}

/**
 * Component that knows its 'natural minimum bounds'
 * but can still be asked to cram itself into
 * a differently-sized space
 * 
 * Hmm: Maybe the fill() function should be
 * extracted to a different type, which could
 * be used by things that have no inherent size,
 * but can generate boxes of any size you like.
 * In which case maybe the parameter should be bounds after all,
 * because those bounds are the region of the raster that should
 * be filled with content.
 */
export interface PackedRasterable extends SizedRasterableGenerator, BoundedRasterable {}

/** Conceptually infinite object that can be asked to rasterize some section of itself */
export interface RegionRasterable {
	regionToRaster(region:AABB2D<number>) : TextRaster2;
}

/**
 * A thing that is conceptually 'all layed out' internally
 * and can be queried for an image of part of itself
 */
export interface BoundedRasterable extends RegionRasterable {
	/**
	 * 'Natural' bounds of this object, for packing purposes.
	 * These bounds do not limit the area that can be queried for raster data!
	 * 
	 * Bounds are relative to this object's own origin,
	 * which is usually arbirary and unimportant
	 * (but maybe not always, which is why this isn't just a Vec2D
	 * with the origin implied to be in the top-left corner).
	 * i.e. the bounds oc a child element are *not*
	 * relative to any ancestors' coordinate system!
	 * Parents know where their children are, not the other way around.
	 */
	readonly bounds : AABB2D<number>;
}

export function boundsToSize(aabb:AABB2D<number>) : Vec2D<number> {
	return {x: aabb.x1 - aabb.x0, y: aabb.y1 - aabb.y0 };
}
/**
 * Convert size to bounds for cases where the position
 * of the bounding box doesn't matter (i.e. usually!)
 */
export function sizeToBounds(size:Vec2D<number>) : AABB2D<number> {
	return {x0: 0, y0: 0, x1: size.x, y1: size.y};
}

export function rasterToSize(raster:TextRaster2, targetSize:Vec2D<number>) : TextRaster2 {
	if( raster.size.x == targetSize.x && raster.size.y == targetSize.y ) return raster;
	
	const background = createUniformRaster(targetSize, "", ""); // Hmm.
	return blitToRaster(background, {
		x: Math.round((targetSize.x - raster.size.x)/2),
		y: Math.round((targetSize.y - raster.size.y)/2),
	}, raster);
}

export function rasterizeRasterableToSize(rasterable:BoundedRasterable, targetSize:Vec2D<number>) : TextRaster2 {
	const rcx : number = (rasterable.bounds.x0 + rasterable.bounds.x1) / 2;
	const rcy : number = (rasterable.bounds.y0 + rasterable.bounds.y1) / 2;
	const rast = rasterable.regionToRaster({
		x0: rcx - targetSize.x / 2,
		y0: rcy - targetSize.y / 2,
		x1: rcx + targetSize.x / 2,
		y1: rcy + targetSize.y / 2,
	})
	return rasterToSize(rast, targetSize);
}

export function rasterizePackedRasterableToSize(packrast:PackedRasterable, targetSize:Vec2D<number>) : TextRaster2 {
	return rasterizeRasterableToSize(packrast.rasterableForSize(targetSize), targetSize);
}

export function rasterizeAbstractRasterableToSize(abstrast:AbstractRasterable, targetSize:Vec2D<number>) : TextRaster2 {
	return rasterizePackedRasterableToSize(abstrast.pack(), targetSize);
}

//// Utilioty functions

function validateSize(size:Vec2D<number>) {
	if( size.x < 0 || !isFinite(size.x) || size.y < 0 || !isFinite(size.y) ) throw new Error(`Invalid size: ${JSON.stringify(size)}`);
	return size;
}

//// Some building blocks

/**
 * Implement regionToRaster for PackedRasterables that
 * don't know how to do that themselves.
 */
export function thisPackedRasterableRegionToRaster(this:PackedRasterable, bounds:AABB2D<number>) {
	const inflated = this.rasterableForSize(boundsToSize(this.bounds));
	// Hopefully inflated.bounds = this.bounds!
	return inflated.regionToRaster(bounds);
}

export function thisAbstractRasterableToRasterForSize(this:AbstractRasterable, size:Vec2D<number>) {
	return rasterizeAbstractRasterableToSize(this, size);
}

/**
 * Rasterable that makes no effort to conform to any given size,
 * and packs to the size of the raster.
 */
export class FixedRasterable implements AbstractRasterable, PackedRasterable, BoundedRasterable, RegionRasterableGenerator {
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
	rasterableForSize(_size: Vec2D<number>): BoundedRasterable {
		return this;
	}
	rasterableForRegion(_area: AABB2D<number>): BoundedRasterable {
		return this;
	}
	regionToRaster(_region: AABB2D<number>) : TextRaster2 {
		return this.#raster;
	}
	rasterForSize = thisAbstractRasterableToRasterForSize;
}

export class AbstractBorderRasterable implements AbstractRasterable {
	readonly #inner: AbstractRasterable;
	readonly #borderWidth: number;
	readonly #backgroundGenerator: SizedRasterableGenerator;
	
	constructor(
		inner: AbstractRasterable,
		borderWidth: number,
		backgroundGenerator: SizedRasterableGenerator
	) {
		this.#inner = inner;
		this.#borderWidth = borderWidth;
		this.#backgroundGenerator = backgroundGenerator;
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
			this.#backgroundGenerator,
			bounds
		);
	}
	
	rasterForSize = thisAbstractRasterableToRasterForSize;
}

class PackedBorderRasterable implements PackedRasterable {
	readonly bounds: AABB2D<number>;
	readonly #packedInner: PackedRasterable;
	readonly #borderWidth: number;
	readonly #backgroundGenerator: SizedRasterableGenerator;
	
	constructor(
		packedInner: PackedRasterable,
		borderWidth: number,
		backgroundGenerator: SizedRasterableGenerator,
		bounds: AABB2D<number>
	) {
		this.#packedInner = packedInner;
		this.#borderWidth = borderWidth;
		this.#backgroundGenerator = backgroundGenerator;
		this.bounds = bounds;
	}
	
	rasterableForSize(size : Vec2D<number>): BoundedRasterable {
		const b = this.#borderWidth;
		const bg = this.#backgroundGenerator.rasterableForSize(size);
		const innerBounds = {
			x0: bg.bounds.x0 + b,
			y0: bg.bounds.y0 + b,
			x1: bg.bounds.x1 - b,
			y1: bg.bounds.y1 - b,
		};
		const filledInner = this.#packedInner.rasterableForSize(boundsToSize(innerBounds));
		return new SizedCompoundRasterable(
			bg,
			[
				{
					bounds: innerBounds,
					component: filledInner
				}
			]
		);
	}
	
	regionToRaster = thisPackedRasterableRegionToRaster;
	rasterForSize = thisAbstractRasterableToRasterForSize;
}

interface CompoundChild<T> {
	component: T,
	bounds: AABB2D<number>,
}

export class SizedCompoundRasterable implements BoundedRasterable {
	readonly #background : BoundedRasterable;
	readonly #children : CompoundChild<BoundedRasterable>[];
	
	constructor(background:BoundedRasterable, children:CompoundChild<BoundedRasterable>[]) {
		this.#background = background;
		this.#children = children;
	}
	
	get bounds() { return this.#background.bounds; }
	
	regionToRaster(region: AABB2D<number>): TextRaster2 {
		let rast = this.#background.regionToRaster(region);
		const bgx0 = this.#background.bounds.x0;
		const bgy0 = this.#background.bounds.y0;
		for( const child of this.#children ) {
			const childRast = child.component.regionToRaster(child.component.bounds);
			const childRastClipped = rasterToSize(childRast, boundsToSize(child.bounds));
			rast = blitToRaster(rast, {x: child.bounds.x0 - bgx0, y: child.bounds.y0 - bgy0}, childRastClipped);
		}
		return rast;
	}
	
	rasterForSize = thisAbstractRasterableToRasterForSize;
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
	rasterableForSize(size: Vec2D<number>): BoundedRasterable {
		return {
			bounds: {x0:0, y0: 0, x1: size.x, y1: size.y},
			regionToRaster: this.#background.regionToRaster.bind(this.#background),
		};
	}
	regionToRaster = thisPackedRasterableRegionToRaster;
	rasterForSize = thisAbstractRasterableToRasterForSize;
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
	readonly #background : RegionRasterable;
	constructor(direction:FlexDirection, bounds:AABB2D<number>, background:RegionRasterable, children:FlexChild<PackedRasterable>[]) {
		this.bounds = bounds;
		this.#direction = direction;
		this.#background = background;
		this.#children = children;
	}
	
	rasterableForSize(size: Vec2D<number>): BoundedRasterable {
		validateSize(size);
		const horiz = this.#direction == "rows";
		
		const rows = [];
		const boxWidth  = size.x;
		const boxHeight = size.y;
		const boxLength = horiz ? boxWidth : boxHeight;
		const boxDepth  = horiz ? boxHeight : boxWidth;

		if( this.#children.length > 0 ) {
			let currentRowLength = 0;
			let currentRow : FlexChild<PackedRasterable>[] = [];
			rows.push(currentRow);
			
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
		
		// Hmm: Maybe the thing to do is to turn each row into
		// a component, then pack/expand the rows.
		
		const sizedChildren : CompoundChild<BoundedRasterable>[] = [];
		
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
			// if( leftoverLength < 0 ) throw new Error("TODO: Implement shrinking");
			if( totalGrow == 0 ) totalGrow = 1; // If nothing wants to grow, fine.
			// TODO: Deal with 'have to shrink' case
			for( let c=0; c<row.length; ++c ) {
				const child = row[c];
				const cBounds = child.component.bounds;
				const cWidth  = cBounds.x1 - cBounds.x0;
				const cHeight = cBounds.y1 - cBounds.y0;
				const cLength = horiz ? cWidth : cHeight;
				const filledLength =
					c == row.length - 1 ? boxLength - along :
					Math.min(Math.round(cLength + leftoverLength * child.flexGrow / totalGrow));
				const cX = horiz ? along : across;
				const cY = horiz ? across : along;
				const cFilledWidth  = horiz ? filledLength : maxDepth;
				const cFilledHeight = horiz ? maxDepth : filledLength;
				
				sizedChildren.push({
					bounds: {
						x0: cX, y0: cY,
						x1: cX + cFilledWidth,
						y1: cY + cFilledHeight,
					},
					component: child.component.rasterableForSize({x: cFilledWidth, y: cFilledHeight})
				});
				along += filledLength;
			}
			
			// Hmm: Might want to expand/shrink the rows, too!
			across += maxDepth;
		}
		
		return new SizedCompoundRasterable(
			// Hmm: Maybe ought to lazily generate the background raster
			// but maybe that doesn't matter
			new FixedRasterable(this.#background.regionToRaster({x0:0, y0:0, x1:size.x, y1:size.y})),
			sizedChildren
		);
	}
	
	regionToRaster = thisPackedRasterableRegionToRaster;
}
export class AbstractFlexRasterable implements AbstractRasterable {
	readonly #direction  : FlexDirection;
	readonly #background : RegionRasterable;
	readonly #children   : FlexChild<AbstractRasterable>[];
	
	constructor(direction:FlexDirection, background:RegionRasterable, children:FlexChild<AbstractRasterable>[]) {
		this.#children   = children  ;
		this.#background = background;
		this.#direction  = direction ;
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
		return new PackedFlexRasterable(this.#direction, {x0:0, y0:0, x1:totalWidth, y1:totalHeight}, this.#background, packedChildren);
	}
	
	rasterForSize = thisAbstractRasterableToRasterForSize;
}

export function makeSolidGenerator(char:string, style:Style) : AbstractRasterable&PackedRasterable&SizedRasterableGenerator&RegionRasterable {
	// Lots of opportunities for memoization, here
	return {
		bounds: {x0:0, y0:0, x1:0, y1:0},
		pack() { return this; },
		rasterableForSize(size:Vec2D<number>) {
			return {
				bounds: {x0: 0, y0: 0, x1: size.x, y1: size.y},
				regionToRaster(region:AABB2D<number>) {
					return createUniformRaster(boundsToSize(region), char, style);
				}
			}
		},
		regionToRaster(region:AABB2D<number>) {
			return createUniformRaster(boundsToSize(region), char, style);
		},
		rasterForSize: thisAbstractRasterableToRasterForSize
	};
}

export function makeBorderedAbstractRasterable(borderDrawer:SizedRasterableGenerator, borderWidth:number, interior:AbstractRasterable) {
	return new AbstractBorderRasterable(interior, borderWidth, borderDrawer);
}
