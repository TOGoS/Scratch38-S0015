import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import BoxDrawr from './BoxDrawr.ts';
import { BDC_PROP_MASK, BDC_PROP_VALUES, BDC_PROP_SHIFTS, BOX_DRAWING_CHAR_PROPS } from './boxcharprops.ts';

Deno.test("Vertical line", () => {
	const boxdrawr = new BoxDrawr(3, 3);
	boxdrawr.addLine(1,0,1,2,BDC_PROP_VALUES.LIGHT);
	assertEquals(
		boxdrawr.contentToString(),
		" ╷ \n"+
		" │ \n"+
		" ╵ \n"
	)
});
Deno.test("3x3 box", () => {
	const boxdrawr = new BoxDrawr(3, 3);
	boxdrawr.addLine(2,2,2,0,BDC_PROP_VALUES.LIGHT);
	boxdrawr.addLine(2,0,0,0,BDC_PROP_VALUES.LIGHT);
	boxdrawr.addLine(0,0,0,2,BDC_PROP_VALUES.LIGHT);
	boxdrawr.addLine(0,2,2,2,BDC_PROP_VALUES.LIGHT);
	assertEquals(
		boxdrawr.contentToString(),
		"┌─┐\n"+
		"│ │\n"+
		"└─┘\n"
	)
});
Deno.test("3x3 box w/ cross", () => {
	const boxdrawr = new BoxDrawr(3, 3);
	boxdrawr.addLine(2,2,2,0,BDC_PROP_VALUES.LIGHT);
	boxdrawr.addLine(2,0,0,0,BDC_PROP_VALUES.LIGHT);
	boxdrawr.addLine(0,0,0,2,BDC_PROP_VALUES.LIGHT);
	boxdrawr.addLine(0,2,2,2,BDC_PROP_VALUES.LIGHT);
	boxdrawr.addLine(0,1,2,1,BDC_PROP_VALUES.LIGHT);
	boxdrawr.addLine(1,0,1,2,BDC_PROP_VALUES.LIGHT);
	assertEquals(
		boxdrawr.contentToString(),
		"┌┬┐\n"+
		"├┼┤\n"+
		"└┴┘\n"
	)
});
Deno.test("3x3 double box w/ cross", () => {
	const boxdrawr = new BoxDrawr(3, 3);
	boxdrawr.addLine(2,2,2,0,BDC_PROP_VALUES.DOUBLE);
	boxdrawr.addLine(1,0,1,2,BDC_PROP_VALUES.DOUBLE);
	boxdrawr.addLine(2,0,0,0,BDC_PROP_VALUES.DOUBLE);
	boxdrawr.addLine(0,0,0,2,BDC_PROP_VALUES.DOUBLE);
	boxdrawr.addLine(0,2,2,2,BDC_PROP_VALUES.DOUBLE);
	boxdrawr.addLine(0,1,2,1,BDC_PROP_VALUES.DOUBLE);
	assertEquals(
		boxdrawr.contentToString(),
		"╔╦╗\n"+
		"╠╬╣\n"+
		"╚╩╝\n"
	)
});
