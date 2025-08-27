import { assertEquals } from 'https://deno.land/std@0.165.0/testing/asserts.ts';
import * as ansi from './ansi.ts';
import { AbstractRasterable, FixedRasterable, makeFlex, makeSolidGenerator } from "./components2.ts";
import { createUniformRaster } from "./textraster2utils.ts";
import { boundsToSize } from './boundsutils.ts';

Deno.test("FixedRasterable is fixed", () => {
	const c0 = undefined;
	const s0 = undefined;
	const c1 = "X";
	const s1 = ansi.RED_TEXT;
	
	const abstract : AbstractRasterable = new FixedRasterable(createUniformRaster({x:3,y:2},c1,s1));
	const packed = abstract.pack({x:80, y:20});
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

Deno.test("flex grow/shrink flexible item", () => {
	const abstractFlex = makeFlex("down", makeSolidGenerator(" ", ""), [
		{
			component: new FixedRasterable(createUniformRaster({x:10,y:1},"fixed1","")),
			flexGrowAlong: 0,
			flexGrowAcross: 1,
			flexShrinkAlong: 0,
			flexShrinkAcross: 1,
		},
		{
			component: new FixedRasterable(createUniformRaster({x:10,y:1},"fixed2","")),
			flexGrowAlong: 0,
			flexGrowAcross: 1,
			flexShrinkAlong: 0,
			flexShrinkAcross: 1,
		},
		{
			component: makeSolidGenerator("flexy","",{x0:0,x1:10,y0:0,y1:0}),
			flexGrowAlong: 1,
			flexGrowAcross: 1,
			flexShrinkAlong: 1,
			flexShrinkAcross: 1,
		},
	]);
	const packedFlex = abstractFlex.pack({x:80, y:40});
	const packedSize = boundsToSize(packedFlex.bounds);
	assertEquals(packedSize, {x:10, y:2});
	
	for( const targetWidth of [12] ) {
		for( let targetHeight=2; targetHeight<6; ++targetHeight ) {
			const expanded = packedFlex.fillSize({x: targetWidth, y:targetHeight});
			const expandedSize = boundsToSize(expanded.bounds);
			assertEquals(expandedSize.x, targetWidth);
			assertEquals(expandedSize.y, targetHeight);
		}
	}
});

Deno.test("flex grow/shrink less flexible item", () => {
	const abstractFlex = makeFlex("down", makeSolidGenerator(" ", ""), [
		{
			component: new FixedRasterable(createUniformRaster({x:10,y:1},"fixed1","")),
			flexGrowAlong: 0,
			flexGrowAcross: 1,
			flexShrinkAlong: 0,
			flexShrinkAcross: 1,
		},
		{
			component: new FixedRasterable(createUniformRaster({x:10,y:1},"fixed2","")),
			flexGrowAlong: 0,
			flexGrowAcross: 1,
			flexShrinkAlong: 0,
			flexShrinkAcross: 1,
		},
		{
			// Fixed, but with flex{Grow|Shrink}Along = 1,
			// so parent should still squish it, I guess?
			// Actually I'm not sure what this should do.
			// Need an 'overflow' property on the parent I guess yukyuk
			component: new FixedRasterable(createUniformRaster({x:10,y:2},"semi-fixed","")),
			flexGrowAlong: 1,
			flexGrowAcross: 1,
			flexShrinkAlong: 1,
			flexShrinkAcross: 1,
		},
	]);
	const packedFlex = abstractFlex.pack({x:100, y:100});
	const packedSize = boundsToSize(packedFlex.bounds);
	assertEquals(packedSize, {x:10, y:4});
	
	for( const targetWidth of [12] ) {
		for( let targetHeight=4; targetHeight<6; ++targetHeight ) {
			const expanded = packedFlex.fillSize({x: targetWidth, y:targetHeight});
			const expandedSize = boundsToSize(expanded.bounds);
			assertEquals(expandedSize.x, targetWidth);
			//assertEquals(expandedSize.y, targetHeight);
		}
	}
});
