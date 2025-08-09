import { assert } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import AABB2D from "../../lib/ts/termdraw/AABB2D.ts";
import TextRaster2 from "../../lib/ts/termdraw/TextRaster2.ts";
import Vec2D from "../../lib/ts/termdraw/Vec2D.ts";

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
	fill(bounds : AABB2D<number>) : Rasterable
}

/**
 * A thing that is conceptually 'all layed out' and can be queried
 * for an image of part of itself
 */
export interface Rasterable {
	readonly bounds : AABB2D<number>;
	toRaster(region:AABB2D<number>) : TextRaster2;
}

export function rasterToSize(raster:TextRaster2, targetSize:Vec2D<number>) : TextRaster2 {
	// Hmm: Could take whatever it gives us and massage it to the target size,
	// but that's kind of what toRaster was supposed to do, so for now let's
	// just panic if it doesn't match:
	assert(raster.size.x == targetSize.x);
	assert(raster.size.y == targetSize.y);
	return raster;
}


export function rasterizeRasterableToSize(rasterable:Rasterable, targetSize:Vec2D<number>) : TextRaster2 {
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

/**
 * Rasterable that makes no effort to conform to any given size,
 * and packs to the size of the raster.
 */
export class FixedRasterable implements AbstractRasterable, PackedRasterable, Rasterable {
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
	fill(_bounds: AABB2D<number>): Rasterable {
		return this;
	}
	toRaster(_region: AABB2D<number>) : TextRaster2 {
		return this.#raster;
	}
}

// TODO: A 'border' rasterable, which wraps another rasterable and uses a callback to draw a fixed-width border around it
// (possibly omitting the border when there's no room for it)
// Could think of the border as a background and use the same type as the padding.

// TODO: A 'padding' rasterable, which packs to zero size and expands to whatever space you ask for,
// and generates a raster using a callback

// TODO: 'flex' rasterable, which lays children out in rows and/or columns,
// similar to HTML/CSS flexbox
