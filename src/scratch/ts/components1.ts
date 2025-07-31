import AABB2D from "../../lib/ts/termdraw/AABB2D.ts";
import { RESET_FORMATTING } from "../../lib/ts/termdraw/ansi.ts";
import TextRaster2 from "../../lib/ts/termdraw/TextRaster2.ts";
import { blitToRaster, createUniformRaster, drawTextToRaster, textToRaster } from "../../lib/ts/termdraw/textraster2utils.ts";
import Vec2D from "../../lib/ts/termdraw/Vec2D.ts";

// Hmm: Maybe resize should be separate from rendering
// so that sadlasdlasd can be cached?
// 
// Or another intermediate form that knows its exact size and content,
// and then *that* gets rasterized?
// 
// Or just have components be `Rasterable` in the tuidemo3 sense;
// actually I think that's the best idea, because it'd be easy to cache!
// But make sure that allows for whatever packing algorithmn you want to use.

interface RasterableComponent {
	/** Minimum size this thing would like to be */
	get packedSize() : Vec2D<number>;
	//calcSize(min:Vec2D<number>, max:Vec2D<number>) : Vec2D<number>;
	renderTo(bounds:AABB2D<number>, dest:TextRaster2) : TextRaster2;
}

function aabbSize(aabb:AABB2D<number>) {
	return {x: aabb.x1 - aabb.x0, y: aabb.y1 - aabb.y0};
}

class Text implements RasterableComponent {
	// TODO: Make immutable, pre-calculate text chars?
	// Maybe just wrap a Raster!
	textLines : string[] = [];
	style : string = RESET_FORMATTING;
	get packedSize() {
		return {
			x: this.textLines.map(l => l.length).reduce((a,b) => Math.max(a,b), 0), // TODO: Not quite!  Maybe don't have a 'Text'!
			y: this.textLines.length
		}
	}
	renderTo(bounds: AABB2D<number>, dest: TextRaster2): TextRaster2 {
		for( let i=0; i<this.textLines.length; ++i ) {
			dest = drawTextToRaster(dest, {x:bounds.x0, y:bounds.y0+i}, this.textLines[i], this.style);
		}
		return dest;
	}
}

class BorderBox implements RasterableComponent {
	#backgroundStyle: string;
	#borderWidth: number;
	#content: RasterableComponent;

	constructor(content: RasterableComponent, borderWidth: number = 1, backgroundStyle: string = RESET_FORMATTING) {
		this.#content = content;
		this.#borderWidth = borderWidth;
		this.#backgroundStyle = backgroundStyle;
	}

	get packedSize(): Vec2D<number> {
		const contentSize = this.#content.packedSize;
		return {
			x: contentSize.x + this.#borderWidth * 2,
			y: contentSize.y + this.#borderWidth * 2,
		}
	}
	
	toRaster(size:Vec2D<number>) : TextRaster2 {
		const rast = createUniformRaster(size, " ", this.#backgroundStyle);
		return this.#content.renderTo({
			x0:this.#borderWidth, y0:this.#borderWidth,
			x1:size.x - this.#borderWidth*2,
			y1:size.y - this.#borderWidth*2,
		}, rast);
	}
	
	renderTo(bounds: AABB2D<number>, dest: TextRaster2): TextRaster2 {
		const rast = this.toRaster(aabbSize(bounds));
		return blitToRaster(dest, {x:bounds.x0, y:bounds.y0}, rast);
	}
}

class VerticalStack implements RasterableComponent {
	children : RasterableComponent[] = [];
	
	get packedSize() {
		let width  = 0;
		let height = 0;
		for( const c of this.children ) {
			const childSize = c.packedSize;
			width  = Math.max(width , childSize.x);
			height = Math.max(height, childSize.y);
		}
		
		return {
			x: width ,
			y: height,
		}
	}
	
	renderTo(bounds: AABB2D<number>, dest: TextRaster2): TextRaster2 {
		const size = aabbSize(bounds);
		let y = bounds.y0;
		for( const child of this.children ) {
			const childSize = child.packedSize;
			dest = child.renderTo({
				x0: bounds.x0, y0: y,
				x1: Math.min(bounds.x1, bounds.x0 + childSize.x),
				y1: Math.min(bounds.y1, y + childSize.y)
			}, dest);
		}
		return dest;
	}
}
