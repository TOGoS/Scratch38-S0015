import { assertEquals } from 'https://deno.land/std@0.165.0/testing/asserts.ts';
import * as ansi from './ansi.ts';
import { AbstractRasterable, FixedRasterable } from "./components2.ts";
import { createUniformRaster } from "./textraster2utils.ts";
import { boundsToSize } from './boundsutils.ts';

Deno.test("FixedRasterable is fixed", () => {
	const c0 = "";
	const s0 = "";
	const c1 = "X";
	const s1 = ansi.RED_TEXT;
	
	const abstract : AbstractRasterable = new FixedRasterable(createUniformRaster({x:3,y:2},c1,s1));
	const packed = abstract.pack();
	assertEquals(packed.bounds, {x0:0, y0:0, x1:3, y1:2});
	
	const inflated = packed.fillSize({x: 6, y: 5});
	assertEquals(inflated.bounds, {x0:0, y0:0, x1:3, y1:2});
	
	const largeCenteredRaster = inflated.rasterForRegion({
		x0: packed.bounds.x0-2,
		y0: packed.bounds.y0-1,
		x1: packed.bounds.x1+1,
		y1: packed.bounds.y1+2,
	});
	
	assertEquals(largeCenteredRaster.size, {x: 6, y: 5});
	
	assertEquals(largeCenteredRaster, {
		size: {x: 6, y: 5},
		chars: [
			[c0,c0,c0,c0,c0,c0],
			[c0,c0,c1,c1,c1,c0],
			[c0,c0,c1,c1,c1,c0],
			[c0,c0,c0,c0,c0,c0],
			[c0,c0,c0,c0,c0,c0],
		],
		styles: [
			[s0,s0,s0,s0,s0,s0],
			[s0,s0,s1,s1,s1,s0],
			[s0,s0,s1,s1,s1,s0],
			[s0,s0,s0,s0,s0,s0],
			[s0,s0,s0,s0,s0,s0],
		],
	});
});
