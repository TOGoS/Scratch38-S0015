import { assertEquals } from 'https://deno.land/std@0.165.0/testing/asserts.ts';
import { mergeSpans } from './spanmerge.ts';

Deno.test("mergeSpans(empty, empty)", () => {
	assertEquals([...mergeSpans([], [])], []);
});

Deno.test("mergeSpans(empty, non-empty)", () => {
	assertEquals([...mergeSpans([], [{x0:0, x1:5}])], [{x0:0, x1:5}]);
});

Deno.test("mergeSpans(non-empty, non-empty) non-overlapping", () => {
	assertEquals([...mergeSpans([{x0:0, x1:5}], [{x0:10, x1:15}])], [{x0:0, x1:5}, {x0:10, x1:15}]);
});

Deno.test("mergeSpans(non-empty, non-empty) overlapping", () => {
	assertEquals([...mergeSpans([{x0:0, x1:5}], [{x0:5, x1:10}])], [{x0:0, x1:10}]);
});

Deno.test("mergeSpans(non-empty, non-empty) overlapping (different order)", () => {
	assertEquals([...mergeSpans([{x0:5, x1:10}], [{x0:0, x1:5}])], [{x0:0, x1:10}]);
});

Deno.test("mergeSpans complex case", () => {
	assertEquals([...mergeSpans(
		[{x0: 5, x1:15},                             {x0:30, x1:40}],
		[      {x0:10, x1:20}, {x0:21,x1:22}, {x0:25, x1:35}       ]
	)],
		[{x0:5,        x1:20}, {x0:21,x1:22}, {x0:25,        x1:40}]
	);
});
