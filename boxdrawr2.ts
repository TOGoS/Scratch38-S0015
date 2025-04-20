const bdchars : (string|undefined)[] = [];

import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";

import { BDC_PROP_MASK, BDC_PROP_VALUES, BDC_PROP_SHIFTS, BOX_DRAWING_CHAR_PROPS } from './boxcharprops.ts';
import { RemainingLengthError } from "https://jsr.io/@ymjacky/mqtt5/0.0.19/lib/mqtt_utils/error.ts";

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

export class BoxDrawr {
	#width : number;
	#height : number;
	#data : Uint8Array;
	constructor(width:number, height:number) {
		this.#width = width;
		this.#height = height;
		this.#data = new Uint8Array(new ArrayBuffer(height * width * 4));
	}
	charAt(x:number, y:number) : string {
		
	}
}
