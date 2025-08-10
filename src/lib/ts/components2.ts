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
	readonly bounds : AABB2D<number>;
	/**
	 * Inflate as desired to fill the given space;
	 * result may be larger or smaller than the given region;
	 * it is a suggestion.
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
	private inner: AbstractRasterable;
	private borderWidth: number;
	private background: RegionRasterable;
	
	constructor(
		inner: AbstractRasterable,
		borderWidth: number,
		background: RegionRasterable
	) {
		this.inner = inner;
		this.borderWidth = borderWidth;
		this.background = background;
	}
	
	pack(): PackedRasterable {
		const packedInner = this.inner.pack();
		const b = this.borderWidth;
		const bounds = {
			x0: packedInner.bounds.x0 - b,
			y0: packedInner.bounds.y0 - b,
			x1: packedInner.bounds.x1 + b,
			y1: packedInner.bounds.y1 + b,
		};
		return new PackedBorderRasterable(
			packedInner,
			this.borderWidth,
			this.background,
			bounds
		);
	}
}

class PackedBorderRasterable implements PackedRasterable {
	readonly bounds: AABB2D<number>;
	private packedInner: PackedRasterable;
	private borderWidth: number;
	private background: RegionRasterable;
	
	constructor(
		packedInner: PackedRasterable,
		borderWidth: number,
		background: RegionRasterable,
		bounds: AABB2D<number>
	) {
		this.packedInner = packedInner;
		this.borderWidth = borderWidth;
		this.background = background;
		this.bounds = bounds;
	}
	
	fill(bounds: AABB2D<number>): SizedRasterable {
		const b = this.borderWidth;
		const innerBounds = {
			x0: bounds.x0 + b,
			y0: bounds.y0 + b,
			x1: bounds.x1 - b,
			y1: bounds.y1 - b,
		};
		const filledInner = this.packedInner.fill(innerBounds);
		return new BorderedRasterable(
			filledInner,
			bounds,
			this.borderWidth,
			this.background
		);
	}
}

class BorderedRasterable implements SizedRasterable {
	readonly bounds: AABB2D<number>;
	private inner: SizedRasterable;
	private borderWidth: number;
	private background : RegionRasterable;

	constructor(
		inner: SizedRasterable,
		bounds: AABB2D<number>,
		borderWidth: number,
		background: RegionRasterable
	) {
		this.inner = inner;
		this.bounds = bounds;
		this.borderWidth = borderWidth;
		this.background = background;
	}

	toRaster(region: AABB2D<number>): TextRaster2 {
		const background = this.background.toRaster(region);
		const innerBounds = this.inner.bounds;
		const innerW = innerBounds.x1 - innerBounds.x0;
		const innerH = innerBounds.y1 - innerBounds.y0;
		const iX = Math.round((this.bounds.x0 + this.bounds.x1 - innerW) / 2);
		const iY = Math.round((this.bounds.y0 + this.bounds.y1 - innerH) / 2);
		const innerRegion = {
			x0: iX, y0: iX,
			x1: iX + innerW,
			y1: iY + innerH,
		};
		const inner = this.inner.toRaster(innerRegion);
		return blitToRaster(background, {x: iX - region.x0, y: iY - region.y0}, inner);
	}
}

const ZERO_BOUNDS = {x0:0, y0:0, x1:0, y1: 0};

export class PaddingRasterable implements AbstractRasterable, PackedRasterable {
	private background: RegionRasterable;

	constructor(background: RegionRasterable) {
		this.background = background;
	}
	get bounds() { return ZERO_BOUNDS; }
	pack(): PackedRasterable {
		return this;
	}
	fill(bounds: AABB2D<number>): SizedRasterable {
		return {
			bounds,
			toRaster: this.background.toRaster.bind(this.background),
		};
	}
}

// 'flex' rasterable, which lays children out in rows and/or columns,
// similar to HTML/CSS flexbox

// TODO: Review/fix, or remove for now.  Copilot generated this

/*
export type FlexDirection = "row" | "column";

export interface FlexChild {
	component: AbstractRasterable;
	flex: number; // 0 = fixed size, >0 = flexible
}

export class FlexRasterable implements AbstractRasterable {
	private direction: FlexDirection;
	private children: FlexChild[];

	constructor(direction: FlexDirection, children: FlexChild[]) {
		this.direction = direction;
		this.children = children;
	}

	pack(): PackedRasterable {
		const packedChildren = this.children.map(child => ({
			packed: child.component.pack(),
			flex: child.flex,
		}));

		// Calculate total fixed size and number of flex children
		let totalFixed = 0;
		let totalFlex = 0;
		for (const { packed, flex } of packedChildren) {
			if (flex === 0) {
				if (this.direction === "row") {
					totalFixed += packed.bounds.x1 - packed.bounds.x0;
				} else {
					totalFixed += packed.bounds.y1 - packed.bounds.y0;
				}
			} else {
				totalFlex += flex;
			}
		}

		// Compute natural size (sum of fixed + min size of flex children)
		let totalSize = totalFixed;
		for (const { packed, flex } of packedChildren) {
			if (flex > 0) {
				if (this.direction === "row") {
					totalSize += packed.bounds.x1 - packed.bounds.x0;
				} else {
					totalSize += packed.bounds.y1 - packed.bounds.y0;
				}
			}
		}

		const bounds: AABB2D<number> = this.direction === "row"
			? { x0: 0, y0: 0, x1: totalSize, y1: Math.max(...packedChildren.map(c => c.packed.bounds.y1 - c.packed.bounds.y0)) }
			: { x0: 0, y0: 0, x1: Math.max(...packedChildren.map(c => c.packed.bounds.x1 - c.packed.bounds.x0)), y1: totalSize };

		return new PackedFlexRasterable(this.direction, packedChildren, bounds);
	}
}

class PackedFlexRasterable implements PackedRasterable {
	readonly bounds: AABB2D<number>;
	private direction: FlexDirection;
	private packedChildren: { packed: PackedRasterable; flex: number }[];

	constructor(
		direction: FlexDirection,
		packedChildren: { packed: PackedRasterable; flex: number }[],
		bounds: AABB2D<number>
	) {
		this.direction = direction;
		this.packedChildren = packedChildren;
		this.bounds = bounds;
	}

	fill(bounds: AABB2D<number>): SizedRasterable {
		const totalSpace = this.direction === "row"
			? bounds.x1 - bounds.x0
			: bounds.y1 - bounds.y0;

		// Calculate fixed and flex sizes
		let totalFixed = 0;
		let totalFlex = 0;
		const minSizes = this.packedChildren.map(({ packed, flex }) => {
			const size = this.direction === "row"
				? packed.bounds.x1 - packed.bounds.x0
				: packed.bounds.y1 - packed.bounds.y0;
			if (flex === 0) totalFixed += size;
			else totalFlex += flex;
			return size;
		});

		const flexSpace = Math.max(0, totalSpace - totalFixed);
		let offset = this.direction === "row" ? bounds.x0 : bounds.y0;
		const childRegions: AABB2D<number>[] = [];

		for (let i = 0; i < this.packedChildren.length; ++i) {
			const { packed, flex } = this.packedChildren[i];
			let size = minSizes[i];
			if (flex > 0 && totalFlex > 0) {
				size = Math.floor(flexSpace * (flex / totalFlex));
			}
			let region: AABB2D<number>;
			if (this.direction === "row") {
				region = {
					x0: offset,
					y0: bounds.y0,
					x1: offset + size,
					y1: bounds.y1,
				};
				offset += size;
			} else {
				region = {
					x0: bounds.x0,
					y0: offset,
					x1: bounds.x1,
					y1: offset + size,
				};
				offset += size;
			}
			childRegions.push(region);
		}

		const filledChildren = this.packedChildren.map((c, i) =>
			c.packed.fill(childRegions[i])
		);

		return new FlexFilledRasterable(this.direction, filledChildren, bounds, childRegions);
	}
}

class FlexFilledRasterable implements SizedRasterable {
	readonly bounds: AABB2D<number>;
	private direction: FlexDirection;
	private children: SizedRasterable[];
	private childRegions: AABB2D<number>[];

	constructor(
		direction: FlexDirection,
		children: SizedRasterable[],
		bounds: AABB2D<number>,
		childRegions: AABB2D<number>[]
	) {
		this.direction = direction;
		this.children = children;
		this.bounds = bounds;
		this.childRegions = childRegions;
	}

	toRaster(region: AABB2D<number>): TextRaster2 {
		const size = {
			x: region.x1 - region.x0,
			y: region.y1 - region.y0,
		};
		
		const raster = new TextRaster2(size.x, size.y);

		for (let i = 0; i < this.children.length; ++i) {
			const child = this.children[i];
			const childRegion = this.childRegions[i];
			const relRegion = {
				x0: childRegion.x0 - this.bounds.x0,
				y0: childRegion.y0 - this.bounds.y0,
				x1: childRegion.x1 - this.bounds.x0,
				y1: childRegion.y1 - this.bounds.y0,
			};
			const childRaster = child.toRaster({
				x0: child.bounds.x0,
				y0: child.bounds.y0,
				x1: child.bounds.x1,
				y1: child.bounds.y1,
			});
			raster.blit(childRaster, relRegion.x0, relRegion.y0);
		}
		return raster;
	}
}
*/

// (possibly omitting the border when there's no room for it)
// Could think of the border as a background and use the same type as the padding.

// TODO: A 'padding' rasterable, which packs to zero size and expands to whatever space you ask for,
// and generates a raster using a callback

// TODO: 'flex' rasterable, which lays children out in rows and/or columns,
// similar to HTML/CSS flexbox
