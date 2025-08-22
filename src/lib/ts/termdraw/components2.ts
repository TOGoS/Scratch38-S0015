import AABB2D from "./AABB2D.ts";
import TextRaster2, { Style } from "./TextRaster2.ts";
import Vec2D from "./Vec2D.ts";
import { boundsAreEqual, boundsToSize, centeredExpandedBounds, sizeToBounds, validateSize } from "./boundsutils.ts";
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
export interface AbstractRasterable {
	pack() : PackedRasterable;
}

/**
 * Conceptually infinite object that can be asked to rasterize some section of itself.
 * 
 * Can also be implementedd by abstract rasterables as a shortcut
 * to indicate the bounds of the object and then generate a raster of the whole thing!
 * Which is actually quite different conceptually, and maybe shouldn't even be a thing.
 * It used to be named differently and maybe should be again.
 * 
 * Hmm:
 * - give me a raster of the given region of yourself
 * - inflate yourself to the given dimensions and give me a raster of that
 */
export interface RegionRasterable {
	rasterForRegion(region:AABB2D<number>) : TextRaster2;
}

/**
 * Similar to RegionRasterable but position-agnostic,
 * which means definitely 
 */
export interface SizedRasterable {
	rasterForSize(size : Vec2D<number>) : TextRaster2;
}

export interface RegionFillingRasterableGenerator {
	/**
	 * Generate a BoundedRasterable that fills the given space;
	 * result may be larger or smaller than the given region
	 * and positioned differently; area is just a suggestion.
	 */
	fillRegion(area : AABB2D<number>) : BoundedRasterable
}

export interface SizeFillingRasterableGenerator {
	/**
	 * Generate a BoundedRasterable that fills an area of the given size;
	 * result may be larger or smaller than the given region;
	 * it is a suggestion.
	 */
	fillSize(size : Vec2D<number>) : BoundedRasterable
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
export interface PackedRasterable extends SizeFillingRasterableGenerator {
	readonly bounds : AABB2D<number>;
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

export function assertRasterSize(raster:TextRaster2, targetSize:Vec2D<number>) : TextRaster2 {
	if( raster.size.x == targetSize.x && raster.size.y == targetSize.y ) return raster;
	
	throw new Error(`Expected raster of size ${targetSize.x}x${targetSize.y}; the one given is ${raster.size.x}x${raster.size.y}`);
}

export function rasterizeRasterableToSize(rasterable:BoundedRasterable, targetSize:Vec2D<number>) : TextRaster2 {
	const rast = rasterable.rasterForRegion(centeredExpandedBounds(rasterable.bounds, targetSize));
	return assertRasterSize(rast, targetSize);
}

export function rasterizePackedRasterableToSize(packrast:PackedRasterable, targetSize:Vec2D<number>) : TextRaster2 {
	return rasterizeRasterableToSize(packrast.fillSize(targetSize), targetSize);
}

export function rasterizeAbstractRasterableToSize(abstrast:AbstractRasterable, targetSize:Vec2D<number>) : TextRaster2 {
	return rasterizePackedRasterableToSize(abstrast.pack(), targetSize);
}

//// Utilioty functions

/**
 * Rasterable that makes no effort to conform to any given size,
 * and packs to the size of the raster.
 */
export class FixedRasterable implements AbstractRasterable, PackedRasterable, BoundedRasterable, RegionFillingRasterableGenerator {
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
	fillSize(_size: Vec2D<number>): BoundedRasterable {
		return this;
	}
	fillRegion(_area: AABB2D<number>): BoundedRasterable {
		return this;
	}
	rasterForRegion(region: AABB2D<number>) : TextRaster2 {
		if( boundsAreEqual(region, this.bounds) ) return this.#raster;
		
		return blitToRaster(
			createUniformRaster(boundsToSize(region), undefined, undefined),
			{ x: this.bounds.x0 - region.x0, y: this.bounds.y0 - region.y0 },
			this.#raster
		);
	}
	rasterForSize(size: Vec2D<number>) : TextRaster2 {
		return this.rasterForRegion(centeredExpandedBounds(this.bounds, size));
	}
}

export class AbstractBorderRasterable implements AbstractRasterable {
	readonly #inner: AbstractRasterable;
	readonly #borderWidth: number;
	readonly #backgroundGenerator: SizeFillingRasterableGenerator;
	
	constructor(
		inner: AbstractRasterable,
		borderWidth: number,
		backgroundGenerator: SizeFillingRasterableGenerator
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
}

class PackedBorderRasterable implements PackedRasterable {
	readonly bounds: AABB2D<number>;
	readonly #packedInner: SizeFillingRasterableGenerator;
	readonly #borderWidth: number;
	readonly #backgroundGenerator: SizeFillingRasterableGenerator;
	
	constructor(
		packedInner: SizeFillingRasterableGenerator,
		borderWidth: number,
		backgroundGenerator: SizeFillingRasterableGenerator,
		bounds: AABB2D<number>
	) {
		this.#packedInner = packedInner;
		this.#borderWidth = borderWidth;
		this.#backgroundGenerator = backgroundGenerator;
		this.bounds = bounds;
	}
	
	fillSize(size : Vec2D<number>): BoundedRasterable {
		// If no room for border, forget the border
		// (alternative is to fill the whole thing with border, or crash)
		const bx = size.x < this.#borderWidth*2 ? 0 : this.#borderWidth;
		const by = size.y < this.#borderWidth*2 ? 0 : this.#borderWidth;
		const bg = this.#backgroundGenerator.fillSize(size);
		const innerBounds = {
			x0: bg.bounds.x0 + bx,
			y0: bg.bounds.y0 + by,
			x1: bg.bounds.x1 - bx,
			y1: bg.bounds.y1 - by,
		};
		const filledInner = this.#packedInner.fillSize(boundsToSize(innerBounds));
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
}

interface CompoundChild<T> {
	component: T,
	// Hmm: If we want to be serious about bounds,
	// we need offset to child's center, and bounds relative to that.
	// Otherwise we just always center it within those bounds, or something.
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
	
	rasterForRegion(region: AABB2D<number>): TextRaster2 {
		let rast = this.#background.rasterForRegion(region);
		const bgx0 = this.#background.bounds.x0;
		const bgy0 = this.#background.bounds.y0;
		for( const child of this.#children ) {
			const fillSize     = boundsToSize(child.bounds);
			const adjustedInternalBounds = centeredExpandedBounds(child.component.bounds, fillSize);
			
			// There are different ways this could be done
			// * Ask child component to generate a raster that will fill the full region,
			//   even if that region is larger/smaller than the child
			// - Let child generate its bounds, then center it
			const childRast = child.component.rasterForRegion(adjustedInternalBounds);
			const childRastClipped = assertRasterSize(childRast, fillSize);
			rast = blitToRaster(rast, {x: child.bounds.x0 - bgx0, y: child.bounds.y0 - bgy0}, childRastClipped);
		}
		return rast;
	}
}

const ZERO_BOUNDS = {x0:0, y0:0, x1:0, y1: 0};

export class PaddingRasterable implements AbstractRasterable, PackedRasterable, RegionRasterable, SizedRasterable {
	readonly #bounds: AABB2D<number>;
	readonly #background: RegionRasterable;
	constructor(bounds:AABB2D<number>, background: RegionRasterable) {
		this.#bounds = bounds;
		this.#background = background;
	}
	get bounds() { return this.#bounds; }
	pack(): PackedRasterable {
		return this;
	}
	fillSize(size: Vec2D<number>): BoundedRasterable {
		return new PaddingRasterable(sizeToBounds(size), this.#background);
	}
	rasterForRegion(region:AABB2D<number>) {
		return this.#background.rasterForRegion(region);
	}
	rasterForSize(size:Vec2D<number>) {
		return this.#background.rasterForRegion(sizeToBounds(size));
	}
}

// TODO: right/left/up/down
export type FlexDirection = "right"|"down";
export interface FlexChild<T> {
	component       : T;
	flexGrowAlong   : number;
	flexGrowAcross  : number;
	flexShrinkAlong : number;
	flexShrinkAcross: number;
}

/*
 * Hmm: Maybe the FlexRasterable itself should add borders
 * between rows and columns, since the constructor can't
 * know where the between-rows borders will end up!
 */
export class PackedFlexRasterable implements PackedRasterable {
	readonly bounds : AABB2D<number>;
	readonly #children : FlexChild<PackedRasterable>[];
	readonly #along : FlexDirection;
	readonly #background : RegionFillingRasterableGenerator;
	constructor(along:FlexDirection, bounds:AABB2D<number>, background:RegionFillingRasterableGenerator, children:FlexChild<PackedRasterable>[]) {
		this.bounds = bounds;
		this.#along = along;
		this.#background = background;
		this.#children = children;
	}
	
	fillSize(size: Vec2D<number>): BoundedRasterable {
		validateSize(size);
		const horiz = this.#along == "right";
		
		const rows : FlexChild<PackedRasterable>[][] = [];
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
		const rowInfos = [];
		
		let totalDepth = 0;
		let totalGrowAcross = 0;
		let totalShrinkAcross = 0;
		// TODO: Calculate row packed widths, then distribute
		// remaining space across them (ignoring flexGrow, I guess)
		for( let r=0; r<rows.length; ++r ) {
			const row = rows[r];
			let rowMaxDepth = 0;
			let rowTotalLength = 0;
			let rowTotalShrinkAlong = 0;
			let rowTotalGrowAlong = 0;
			let rowTotalGrowAcross = 0;
			let rowTotalShrinkAcross = 0;
			let rowMinGrowAcross = 1000;
			
			for( const child of row ) {
				const cBounds = child.component.bounds;
				const cWidth  = cBounds.x1 - cBounds.x0;
				const cHeight = cBounds.y1 - cBounds.y0;
				const cLength = horiz ? cWidth : cHeight;
				const cDepth  = horiz ? cHeight : cWidth;
				rowTotalLength += cLength;
				rowMaxDepth = Math.max(rowMaxDepth, cDepth);
				rowTotalShrinkAlong  += child.flexShrinkAlong;
				rowTotalGrowAlong    += child.flexGrowAlong;
				rowTotalShrinkAlong  += child.flexShrinkAlong;
				rowTotalGrowAcross   += child.flexGrowAcross;
				rowTotalShrinkAcross += child.flexShrinkAcross;
				rowMinGrowAcross = Math.min(child.flexGrowAcross, rowMinGrowAcross);
			}
			totalDepth += rowMaxDepth; // TODO: Add border width, if borders between rows
			const rowGrowAcross   = rowMinGrowAcross; // rowTotalGrowAcross   / row.length;
			const rowShrinkAcross = rowTotalShrinkAcross / row.length;
			totalGrowAcross += rowGrowAcross;
			totalShrinkAcross += rowShrinkAcross;
			rowInfos.push({
				totalLength: rowTotalLength,
				maxDepth: rowMaxDepth,
				totalGrowAlong: rowTotalGrowAlong,
				flexGrowAcross: rowGrowAcross,
				totalShrinkAlong: rowTotalShrinkAlong,
				flexShrinkAcross: rowShrinkAcross
			});
		}
		const leftoverDepth = boxDepth - totalDepth;
		
		const totalGrowAcrossish = Math.max(1, totalGrowAcross);
		
		let maxRowLength = 0;
		let across = 0;
		for( let r=0; r<rows.length; ++r ) {
			const row = rows[r];
			let along = 0;
			const rowInfo = rowInfos[r];
			const remainingDepth = boxDepth - across;
			const rowFlexAcross = leftoverDepth > 0 ? rowInfo.flexGrowAcross : rowInfo.flexShrinkAcross;
			const rowDepth = Math.max(0,
				rowFlexAcross > 0 && r == rows.length - 1 ? remainingDepth :
				Math.min(remainingDepth, Math.round(rowInfo.maxDepth + leftoverDepth * rowFlexAcross / totalGrowAcrossish)),
			)
			
			const leftoverLength = boxLength - rowInfo.totalLength;
			const totalGrowish = Math.max(1, rowInfo.totalGrowAlong); // To avoid dividing by zero
			
			for( let c=0; c<row.length; ++c ) {
				const child = row[c];
				const cBounds = child.component.bounds;
				const cWidth  = cBounds.x1 - cBounds.x0;
				const cHeight = cBounds.y1 - cBounds.y0;
				const cLength = horiz ? cWidth : cHeight;
				const remainingLength = boxLength - along;
				const cFlexAlong = leftoverLength > 0 ? child.flexGrowAlong : child.flexShrinkAlong;
				const filledLength = Math.max(0,
					cFlexAlong > 0 && c == row.length - 1 ? remainingLength :
					Math.min(remainingLength, Math.round(cLength + leftoverLength * cFlexAlong / totalGrowish))
				);
				const cX = horiz ? along : across;
				const cY = horiz ? across : along;
				const cFilledWidth  = horiz ? filledLength : rowDepth;
				const cFilledHeight = horiz ? rowDepth : filledLength;
				
				sizedChildren.push({
					bounds: {
						x0: cX, y0: cY,
						x1: cX + cFilledWidth,
						y1: cY + cFilledHeight,
					},
					component: child.component.fillSize({x: cFilledWidth, y: cFilledHeight})
				});
				along += filledLength;
			}
			
			across += rowDepth;
			maxRowLength = Math.max(maxRowLength, along);
		}
		
		const bounds = {
			x0: 0, y0: 0,
			x1: horiz ? maxRowLength : across,
			y1: horiz ? across : maxRowLength,
		};
		
		// TODO: Remove this "X" that's here for debugging
		sizedChildren.push({
			bounds: {
				x0: bounds.x1, y0: bounds.y0,
				x1: bounds.x1+1, y1: bounds.y0+1,
			},
			component: makeSolidGenerator("X","")
		});
		
		return new SizedCompoundRasterable(
			this.#background.fillRegion(bounds),
			sizedChildren
		);
	}
}

// TODO: Replace with function FlexParent (an options/properties object) -> AbstractRasterable
export class AbstractFlexRasterable implements AbstractRasterable {
	// TODO: Replace with along and across directions
	readonly #along      : FlexDirection;
	// For now, #across is implicitly "right" or "down"
	readonly #background : RegionFillingRasterableGenerator;
	readonly #children   : FlexChild<AbstractRasterable>[];
	
	constructor(along:FlexDirection, background:RegionFillingRasterableGenerator, children:FlexChild<AbstractRasterable>[]) {
		this.#children   = children  ;
		this.#background = background;
		this.#along      = along ;
	}
	pack(): PackedRasterable {
		const packedChildren = this.#children.map(c => ({
			component: c.component.pack(),
			flexGrowAlong: c.flexGrowAlong,
			flexGrowAcross: c.flexGrowAcross,
			flexShrinkAlong: c.flexShrinkAlong,
			flexShrinkAcross: c.flexShrinkAcross,
		}));
		let totalWidth = 0;
		let totalHeight = 0;
		if( this.#along == "right" ) {
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
		return new PackedFlexRasterable(this.#along, {x0:0, y0:0, x1:totalWidth, y1:totalHeight}, this.#background, packedChildren);
	}
}

function* addSep<T>(sep:T, items:Iterable<T>) : Iterable<T> {
	let first = true;
	for( const item of items ) {
		if( !first ) yield sep;
		yield item;
		first = false;
	}
}

export function makeSeparatedFlex(along:FlexDirection, background:RegionFillingRasterableGenerator, separator:FlexChild<AbstractRasterable>, children:Iterable<FlexChild<AbstractRasterable>>) {
	return new AbstractFlexRasterable(along, background, [...addSep(separator, children)]);
}

export function makeSolidGenerator(char:string, style:Style) : AbstractRasterable&PackedRasterable&SizeFillingRasterableGenerator&RegionFillingRasterableGenerator&RegionRasterable {
	const rasterForRegion = (region:AABB2D<number>) => {
		return createUniformRaster(boundsToSize(region), char, style);
	};
	
	// Lots of opportunities for memoization, here
	return {
		bounds: ZERO_BOUNDS,
		pack() { return this; },
		fillSize(size:Vec2D<number>) {
			return {
				bounds: {x0: 0, y0: 0, x1: size.x, y1: size.y},
				rasterForRegion,
			}
		},
		fillRegion(region:AABB2D<number>) {
			return {
				bounds: region,
				rasterForRegion,
			}
		},
		rasterForRegion,
	};
}

export function makeBorderedAbstractRasterable(borderDrawer:SizeFillingRasterableGenerator, borderWidth:number, interior:AbstractRasterable) {
	return new AbstractBorderRasterable(interior, borderWidth, borderDrawer);
}

export class AbstractComponentWrapper implements AbstractRasterable, SizedRasterable {
	readonly #wrapped : AbstractRasterable;
	constructor(wrapped:AbstractRasterable) {
		this.#wrapped = wrapped;
	}
	pack(): PackedRasterable {
		// TODO: Memoize shit here
		return this.#wrapped.pack();
	}
	rasterForSize(size: Vec2D<number>): TextRaster2 {
		const expanded = this.pack().fillSize(size);
		// TODO: Memoize this shit, too
		return expanded.rasterForRegion(centeredExpandedBounds(expanded.bounds, size));
	}
}
