import { assertEquals } from 'https://deno.land/std@0.165.0/testing/asserts.ts';
import { toChunkIterator } from '../../../../../SG-P28/src/main/ts/streamiter.ts';
import { toChunks, toList } from '../_util/asynciterableutil.ts';
import { inputEvents } from './inputeventparser.ts';

Deno.test("read some regular key events in the 32-65 range", () => {
	// e.g. make sure '#' isn't read as control+C lmao
});
Deno.test("read some regular key events", () => {
	// TODO!
});
Deno.test("read some funky key events", () => {
	// TODO!
});
Deno.test("read enter", async () => {
	const actualEvents = await toList(inputEvents(toChunks("\x0D")));
	assertEquals(actualEvents, [{
		charish: 13,
		type: 'keypress',
		key: "Enter",
		shiftKey: false,
		metaKey: false,
		ctrlKey: false,
	}]);
});

Deno.test("read arrow up", async () => {
	const actualEvents = await toList(inputEvents(toChunks("\x1b[A")));
	assertEquals(actualEvents, [{
		charish: { type: 'EscapeSequence', code1: '[', params:[], code2: 'A' },
		type: 'keypress',
		key: "ArrowUp",
		shiftKey: false,
		metaKey: false,
		ctrlKey: false,
	}]);
});

Deno.test("read a backspace", async () => {
	const actualEvents = await toList(inputEvents(toChunks("\x7f")));
	assertEquals(actualEvents, [{
		charish: 127,
		type: 'keypress',
		key: "Backspace",
		shiftKey: false,
		metaKey: false,
		ctrlKey: false,
	}]);
});
Deno.test("read an F1", async () => {
	const actualEvents = await toList(inputEvents(toChunks("\x1b[11~")));
	assertEquals(actualEvents, [{
		charish: {
			type: 'EscapeSequence',
			code1: "[",
			params: [11],
			code2: "~",
		},
		type: 'keypress',
		key: "F1",
		shiftKey: false,
		metaKey: false,
		ctrlKey: false,
	}]);
});

Deno.test("read an F8", async () => {
	const actualEvents = await toList(inputEvents(toChunks("\x1b[19~")));
	assertEquals(actualEvents, [{
		charish: {
			type: 'EscapeSequence',
			code1: "[",
			params: [19],
			code2: "~",
		},
		type: 'keypress',
		key: "F8",
		shiftKey: false,
		metaKey: false,
		ctrlKey: false,
	}]);
});
