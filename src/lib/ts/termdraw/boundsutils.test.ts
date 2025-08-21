import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import { centeredExpandedBounds } from "./boundsutils.ts";

Deno.test("centeredExpandedBounds centered to same size", () => {
	assertEquals(
		centeredExpandedBounds({x0: -1, y0: -1, x1: 1, y1: 1}, {x: 2, y: 2}),
		{x0: -1, y0: -1, x1: 1, y1: 1}
	);
});
Deno.test("centeredExpandedBounds centered to larger", () => {
	assertEquals(
		centeredExpandedBounds({x0: -1, y0: -1, x1: 1, y1: 1}, {x: 4, y: 4}),
		{x0: -2, y0: -2, x1: 2, y1: 2}
	);
});
Deno.test("centeredExpandedBounds offset to larger", () => {
	assertEquals(
		centeredExpandedBounds({x0: 0, y0: 0, x1: 2, y1: 2}, {x: 4, y: 4}),
		{x0: -1, y0: -1, x1: 3, y1: 3}
	);
});
Deno.test("centeredExpandedBounds offset to smaller", () => {
	assertEquals(
		centeredExpandedBounds({x0: 0, y0: 0, x1: 4, y1: 2}, {x: 2, y: 2}),
		{x0: 1, y0: 0, x1: 3, y1: 2}
	);
});
