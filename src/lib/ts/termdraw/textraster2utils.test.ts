import { assertEquals, assertNotEquals, assertStrictEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import TextRaster2 from "./TextRaster2.ts";
import { RESET_FORMATTING, RED_TEXT } from "./ansi.ts";
import { textRaster2ToDrawCommands, createUniformRaster, blitToRaster } from './textraster2utils.ts';
import { toChars } from './textraster2utils.ts';
import AABB2D from './AABB2D.ts';
import Vec2D from './Vec2D.ts';

interface AbstractRastMan<T> {
	data : T;
	updatedRegions : AABB2D<number>[];
}

//// Tests

const FAMILY_EMOJI = "\uD83D\uDC69\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66";

Deno.test("textRaster2ToDrawCommands 'foo'", () => {
	const style = RESET_FORMATTING;
	const theRaster : TextRaster2 = {
		size: {x: 3, y: 1},
		chars: [["f","o","o"]],
		styles: [[style,style,style]],
	}
	const actualCommands = textRaster2ToDrawCommands(theRaster, [{x0:0,y0:0,x1:3,y1:1}], {x:0,y:0});
	assertEquals([...actualCommands], [
		{classRef:"x:Move", x:0, y:0},
		{classRef:"x:EmitLiteral", sequence:style},
		{classRef:"x:EmitText", text:"foo"},
	])
});

const THREEBYTHREE = ((s:string,r:string) => ({
	size: {x: 3, y: 3},
	chars: [["f","o","o"],["b","","r"],["{",FAMILY_EMOJI,"}"]],
	styles: [[s,s,s],[r,r,r],[s,s,s]],
}))(RESET_FORMATTING, RED_TEXT);

function textThreeByThreeRaster2ToDrawCommands(offset:Vec2D<number>) {
	const actualCommands = textRaster2ToDrawCommands(THREEBYTHREE, [{x0:0,y0:0,x1:3,y1:3}], offset);
	assertEquals([...actualCommands], [
		{classRef:"x:Move", x:offset.x+0, y:offset.y+0},
		{classRef:"x:EmitLiteral", sequence:RESET_FORMATTING},
		{classRef:"x:EmitText", text:"foo"},
		
		{classRef:"x:Move", x:offset.x+0, y:offset.y+1},
		{classRef:"x:EmitLiteral", sequence:RED_TEXT},
		{classRef:"x:EmitText", text:"b"},
		{classRef:"x:Move", x:offset.x+2, y:offset.y+1},
		// {classRef:"x:EmitLiteral", sequence:RED_TEXT},
		{classRef:"x:EmitText", text:"r"},
		
		{classRef:"x:Move", x:offset.x+0, y:offset.y+2},
		{classRef:"x:EmitLiteral", sequence:RESET_FORMATTING},
		{classRef:"x:EmitText", text:`{${FAMILY_EMOJI}}`},
	]);
}

Deno.test("textRaster2ToDrawCommands more complicated", () => textThreeByThreeRaster2ToDrawCommands({x:0,y:0}));

Deno.test("textRaster2ToDrawCommands more complicated and shifted", () => textThreeByThreeRaster2ToDrawCommands({x:5,y:-7}));

Deno.test("toChars on simple ascii", () => {
	assertEquals(toChars("foo bar"), ["f","o","o"," ","b","a","r"]);
});
Deno.test("toChars on a family", () => {
	assertEquals(toChars(`foo ${FAMILY_EMOJI} bar`), ["f","o","o"," ",FAMILY_EMOJI," ","b","a","r"]);
});

Deno.test("createUniformRaster", () => {
	const c0 = ";";
	const s0 = RED_TEXT;
	const actual = createUniformRaster({x: 3, y: 2}, c0, s0);
	const expected = {
		size: {x: 3, y: 2},
		chars : [[c0,c0,c0],[c0,c0,c0]],
		styles: [[s0,s0,s0],[s0,s0,s0]],
	};
	assertEquals(actual, expected);
})


Deno.test("blit nothing to canvas", () => {
	const canvas = createUniformRaster({x: 4, y:4}, ".", RESET_FORMATTING);
	const stamp  = createUniformRaster({x: 0, y:0}, ".", RED_TEXT);
	
	const result = blitToRaster(canvas, {x:2, y:1}, stamp, {x0:0, y0:0, x1:0, y1:0});
	assertStrictEquals(result, canvas, "Expected blitting zero-sized stamp to return original raster");
});

Deno.test("blit zero-sized slice of something to canvas", () => {
	const canvas = createUniformRaster({x: 4, y:4}, ".", RESET_FORMATTING);
	const stamp  = createUniformRaster({x: 2, y:2}, ".", RED_TEXT);
	
	const result = blitToRaster(canvas, {x:2, y:1}, stamp, {x0:0, y0:0, x1:0, y1:0});
	assertStrictEquals(result, canvas, "Expected blitting zero-sized slice of 2x2 stamp to return original raster");
});

Deno.test("blit 1x1 square to 1x1 canvas", () => {
	const c0 = ".";
	const c1 = ";";
	const s0 = RESET_FORMATTING;
	const s1 = RED_TEXT;
	
	const canvas = createUniformRaster({x: 1, y: 1}, c0, s0);
	const stamp  = createUniformRaster({x: 1, y: 1}, c1, s1);
	
	const result = blitToRaster(canvas, {x:0, y:0}, stamp, {x0:0, y0:0, x1:1, y1:1});
	
	const expectedResult : TextRaster2 = {
		size: {x: 1, y: 1},
		chars : [[c1]],
		styles: [[s1]],
	};
	
	assertEquals(result, expectedResult);
});

Deno.test("blit 1x1 square to 2x1 canvas at 0,0", () => {
	const c0 = ".";
	const c1 = ";";
	const s0 = RESET_FORMATTING;
	const s1 = RED_TEXT;
	
	const canvas = createUniformRaster({x: 2, y: 1}, c0, s0);
	const stamp  = createUniformRaster({x: 1, y: 1}, c1, s1);
	
	const result = blitToRaster(canvas, {x:0, y:0}, stamp, {x0:0, y0:0, x1:1, y1:1});
	
	const expectedResult : TextRaster2 = {
		size: {x: 2, y: 1},
		chars : [[c1, c0]],
		styles: [[s1, s0]],
	};
	
	assertEquals(result, expectedResult);
});

Deno.test("blit 1x1 square to 2x1 canvas at 0,1", () => {
	const c0 = ".";
	const c1 = ";";
	const s0 = RESET_FORMATTING;
	const s1 = RED_TEXT;
	
	const canvas = createUniformRaster({x: 2, y: 1}, c0, s0);
	const stamp  = createUniformRaster({x: 1, y: 1}, c1, s1);
	
	const result = blitToRaster(canvas, {x:1, y:0}, stamp, {x0:0, y0:0, x1:1, y1:1});
	
	const expectedResult : TextRaster2 = {
		size: {x: 2, y: 1},
		chars : [[c0, c1]],
		styles: [[s0, s1]],
	};
	
	assertEquals(result, expectedResult);
});


Deno.test("blit 2x2 square to 4x4 canvas at 2,2", () => {
	const c0 = ".";
	const c1 = ";";
	const s0 = RESET_FORMATTING;
	const s1 = RED_TEXT;
	
	const canvas = createUniformRaster({x: 4, y: 4}, c0, s0);
	const stamp  = createUniformRaster({x: 2, y: 2}, c1, s1);
	
	const result = blitToRaster(canvas, {x:2, y:1}, stamp, {x0:0, y0:0, x1:2, y1:2});
	
	const expectedResult : TextRaster2 = {
		size: {x: 4, y: 4},
		chars: [
			[c0,c0,c0,c0],
			[c0,c0,c1,c1],
			[c0,c0,c1,c1],
			[c0,c0,c0,c0],
		],
		styles: [
			[s0,s0,s0,s0],
			[s0,s0,s1,s1],
			[s0,s0,s1,s1],
			[s0,s0,s0,s0],
		],
	};
	
	assertEquals(result, expectedResult);
});

Deno.test("blit 2x2 square to 4x4 canvas at -1,-1", () => {
	const c0 = ".";
	const c1 = ";";
	const s0 = RESET_FORMATTING;
	const s1 = RED_TEXT;
	
	const canvas = createUniformRaster({x: 4, y: 4}, c0, s0);
	const stamp  = createUniformRaster({x: 2, y: 2}, c1, s1);
	
	const result = blitToRaster(canvas, {x:-1, y:-1}, stamp, {x0:0, y0:0, x1:2, y1:2});
	
	const expectedResult : TextRaster2 = {
		size: {x: 4, y: 4},
		chars: [
			[c1,c0,c0,c0],
			[c0,c0,c0,c0],
			[c0,c0,c0,c0],
			[c0,c0,c0,c0],
		],
		styles: [
			[s1,s0,s0,s0],
			[s0,s0,s0,s0],
			[s0,s0,s0,s0],
			[s0,s0,s0,s0],
		],
	};
	
	assertEquals(result, expectedResult);
});

Deno.test("blit 2x2 square to 4x4 canvas at 3,3", () => {
	const c0 = ".";
	const c1 = ";";
	const s0 = RESET_FORMATTING;
	const s1 = RED_TEXT;
	
	const canvas = createUniformRaster({x: 4, y: 4}, c0, s0);
	const stamp  = createUniformRaster({x: 2, y: 2}, c1, s1);
	
	const result = blitToRaster(canvas, {x:3, y:3}, stamp, {x0:0, y0:0, x1:2, y1:2});
	
	const expectedResult : TextRaster2 = {
		size: {x: 4, y: 4},
		chars: [
			[c0,c0,c0,c0],
			[c0,c0,c0,c0],
			[c0,c0,c0,c0],
			[c0,c0,c0,c1],
		],
		styles: [
			[s0,s0,s0,s0],
			[s0,s0,s0,s0],
			[s0,s0,s0,s0],
			[s0,s0,s0,s1],
		],
	};
	
	assertEquals(result, expectedResult);
});

Deno.test("blit 2x2 square to 4x4 canvas with no changes", () => {
	const c0 = ".";
	const c1 = c0;
	const s0 = RESET_FORMATTING;
	const s1 = s0;
	
	const canvas = createUniformRaster({x: 4, y: 4}, c0, s0);
	const stamp  = createUniformRaster({x: 2, y: 2}, c1, s1);
	
	const result = blitToRaster(canvas, {x:2, y:2}, stamp, {x0:0, y0:0, x1:2, y1:2});
	
	assertStrictEquals(result, canvas);
});
