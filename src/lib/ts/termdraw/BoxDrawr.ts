const bdchars : (string|undefined)[] = [];

import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";

import { BDC_PROP_MASK, BDC_PROP_VALUES, BDC_PROP_SHIFTS, BOX_DRAWING_CHAR_PROPS } from './boxcharprops.ts';
import TextRaster2 from "./TextRaster2.ts";

for( const k in BOX_DRAWING_CHAR_PROPS ) {
	const props = BOX_DRAWING_CHAR_PROPS[k];
	bdchars[props] = k;
}

Deno.test("vertical light", () => {
	const { UP, DOWN, RIGHT } = BDC_PROP_SHIFTS;
	const { LIGHT } = BDC_PROP_VALUES;
	
	assertEquals(bdchars[(LIGHT << UP) | (LIGHT << DOWN)], "│");
	assertEquals(bdchars[(LIGHT << UP) | (LIGHT << RIGHT)], "└");
});

export default class BoxDrawr {
	#width : number;
	#height : number;
	#data : Uint32Array;
	constructor(width:number, height:number) {
		this.#width = width;
		this.#height = height;
		this.#data = new Uint32Array(new ArrayBuffer(height * width * 4));
	}
	setAt(x:number, y:number, keepMask:number, dat:number) {
		const index = x + y*this.#width;
		this.#data[index] = (this.#data[index] & keepMask) | dat;
	}
	charAt(x:number, y:number) : string {
		const index = x + y*this.#width;
		const dat = this.#data[index];
		const char = bdchars[dat];
		return char ?? "?";
	}
	contentToRaster(style:string) : TextRaster2 {
		const charLines = [];
		const styleLines = [];
		
		const styleLine = [];
		for( let x=0; x<this.#width; ++x ) {
			styleLine.push(style);
		}
		
		for( let y=0; y<this.#height; ++y ) {
			const charLine = [];
			for( let x=0; x<this.#width; ++x ) {
				charLine.push(this.charAt(x,y));
			}
			charLines.push(charLine);
			styleLines.push(styleLine);
		}
		
		return {
			size: {x: this.#width, y:this.#height},
			chars: charLines,
			styles: styleLines,
		}
	}
	contentToString() : string {
		let i=0;
		const zow = [];
		for( let y=0; y<this.#height; ++y ) {
			for( let x=0; x<this.#width; ++x, ++i ) {
				zow.push(bdchars[this.#data[i]] ?? "?");
			}
			zow.push("\n");
		}
		return zow.join("");
	}
	addLine(x0:number, y0:number, x1:number, y1:number, type:number) {
		if( x0 == x1 ) {
			if( y0 == y1 ) return;
			
			if( y0 > y1 ) [y0, y1] = [y1, y0];
			
			const lowerDat      = type << BDC_PROP_SHIFTS.DOWN;
			const lowerKeepMask = ~(BDC_PROP_MASK << BDC_PROP_SHIFTS.DOWN);
			const upperDat      = type << BDC_PROP_SHIFTS.UP;
			const upperKeepMask = ~(BDC_PROP_MASK << BDC_PROP_SHIFTS.UP);
			
			for( let y=y0+1; y<=y1; ++y ) {
				this.setAt(x0, y-1, lowerKeepMask, lowerDat);
				this.setAt(x0, y  , upperKeepMask, upperDat);
			}
		} else if( y0 == y1 ) {
			if( x0 > x1 ) [x0, x1] = [x1, x0];
			
			const leftDat       = type << BDC_PROP_SHIFTS.LEFT;
			const leftKeepMask  = ~(BDC_PROP_MASK & BDC_PROP_SHIFTS.LEFT);
			const rightDat      = type << BDC_PROP_SHIFTS.RIGHT;
			const rightKeepMask = ~(BDC_PROP_MASK & BDC_PROP_SHIFTS.RIGHT);
			
			for( let x=x0+1; x<=x1; ++x ) {
				this.setAt(x-1, y0, rightKeepMask, rightDat);
				this.setAt(x  , y0, leftKeepMask , leftDat );
			}			
		} else {
			throw new Error(`Can't line from ${x0},${y0} to ${x1},${y1}; Non axis-aligned lines not yet supported`);
		}
	}	
}
