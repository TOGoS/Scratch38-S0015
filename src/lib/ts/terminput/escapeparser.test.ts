import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import { toCharishes } from './escapeparser.ts';
import { toAsyncIterable, toList } from "../_util/asynciterableutil.ts";

Deno.test("read some regular charishes", async () => {
	const input = new TextEncoder().encode("abc123");
	const charishes = await toList(toCharishes(toAsyncIterable(input)));
	assertEquals([...input], charishes);
});
Deno.test("read a '[' escape sequence", async () => {
	const input = new TextEncoder().encode("\x1b[11~");
	const charishes = await toList(toCharishes(toAsyncIterable(input)));
	assertEquals([{type: "EscapeSequence", code1: "[", params: [11], code2: "~"}], charishes);
});
Deno.test("read a longer '[' escape sequence", async () => {
	const input = new TextEncoder().encode("\x1b[10;20H");
	const charishes = await toList(toCharishes(toAsyncIterable(input)));
	assertEquals([{type: "EscapeSequence", code1: "[", params: [10,20], code2: "H"}], charishes);
});
