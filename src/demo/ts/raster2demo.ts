import { assert, assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import DrawCommand from "../../lib/ts/termdraw/DrawCommand.ts";
import TextRaster2 from "../../lib/ts/termdraw/TextRaster2.ts";
import { RESET_FORMATTING, RED_TEXT } from "../../lib/ts/termdraw/ansi.ts";

interface Vec2<T> {
	x : T;
	y : T;
}

interface AABB {
	x0 : number; y0 : number;
	x1 : number; y1 : number;
}

interface AbstractRastMan<T> {
	data : T;
	updatedRegions : AABB[];
}

function actualChangedRegions(rasterA:TextRaster2, rasterB:TextRaster2, regions:Iterable<AABB>) : Iterable<AABB> {
	// TODO: Check raster data, only emit sub-regions that actually differ
	return regions;
}

function clamp(n:number, min:number, max:number) {
	if(n < min) return min;
	if(n > max) return max;
	return n;
}

function* textRaster2ToDrawCommands(raster:TextRaster2, regions:Iterable<AABB>, offset:Vec2<number>) : Iterable<DrawCommand> {
	for( const reg of regions ) {
		const y0 = clamp(reg.y0, 0, raster.height);
		const x0 = clamp(reg.x0, 0, raster.width);
		const y1 = clamp(reg.y1, 0, raster.height);
		const x1 = clamp(reg.x1, 0, raster.width);
		let cursorY : number|undefined = undefined;
		let cursorX : number|undefined = undefined;
		let cursorStyle : string|undefined = undefined;
		for( let y=y0; y<y1; ++y ) {
			for( let x=x0; x<x1; ) {
				if( raster.chars[y][x] == "" ) {
					// Empty space; skip it and emit nothing without changing cursor!
					for( x=x+1; x<x1 && raster.chars[y][x] == ""; ++x ) {}
					continue;
				} else {
					const spanX0 = x;
					const spanStyle = raster.styles[y][x];
					for( x=x+1; x<x1 && raster.chars[y][x] != "" && raster.styles[y][x] == spanStyle; ++x ) {}
					const spanX1 = x;
					if( cursorX != spanX0 || cursorY != y ) {
						yield {
							classRef: "x:Move",
							x: cursorX = spanX0 + offset.x,
							y: cursorY = y      + offset.y
						};
					}
					const chars:string[] = [];
					for( x=spanX0; x<spanX1; ++x ) {
						chars.push(raster.chars[y][x]);
					}
					if( spanStyle != cursorStyle ) {
						yield {
							classRef: "x:EmitLiteral",
							sequence: cursorStyle = spanStyle
						};
					}
					yield {
						classRef: "x:EmitText",
						text: chars.join(''),
					};
					cursorX += chars.length;
				}
			}
		}
	}
}

// toChars will be important for translating x:EmitText to chars for a raster

const CHARS_REGEX = /(?:.(\u200D.)*)/gu;
function toChars(str:string) {
	return str.match(CHARS_REGEX);
}

//// Tests

const FAMILY_EMOJI = "\uD83D\uDC69\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66";

Deno.test("textRaster2ToDrawCommands 'foo'", () => {
	const style = RESET_FORMATTING;
	const theRaster : TextRaster2 = {
		width: 3,
		height: 1,
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
	width: 3,
	height: 3,
	chars: [["f","o","o"],["b","","r"],["{",FAMILY_EMOJI,"}"]],
	styles: [[s,s,s],[r,r,r],[s,s,s]],
}))(RESET_FORMATTING, RED_TEXT);

function textThreeByThreeRaster2ToDrawCommands(offset:Vec2<number>) {
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
