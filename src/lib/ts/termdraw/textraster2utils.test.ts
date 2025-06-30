import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import TextRaster2 from "./TextRaster2.ts";
import { RESET_FORMATTING, RED_TEXT } from "./ansi.ts";
import { textRaster2ToDrawCommands } from './textraster2utils.ts';
import { toChars } from './textraster2utils.ts';
import AABB2D from './AABB2D.ts';
import Vec2D from './Vec2D.ts';

interface AbstractRastMan<T> {
	data : T;
	updatedRegions : AABB2D[];
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
