import { KeyPressEvent, MouseEvent, MousePressEvent, MouseScrollEvent } from "https://deno.land/x/tui@2.1.11/src/input_reader/types.ts";
import { toAsyncIterable, toList } from "./src/lib/ts/asynciterableutil.ts";
import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import { textEncoder } from "../SG-P28/wbbconnector.ts";

async function* toBytes(chunks : Iterable<Uint8Array>) {
	for await( const chunk of chunks ) {
		for( const byte of chunk ) {
			yield byte;
		}
	}
}

interface KeyEvent {
	type: "Key",
	text: string,
	char: string,
	shift: boolean,
	control: boolean,
}


interface EscapeSequence {
	type: "EscapeSequence",
	code1 : string; // The character directly following the escape
	params : number[];
	code2? : string; // The character following the parameters, if any
}
type Charish = number | EscapeSequence | null;

const EMPTY_PARAMS : number[] = [];

//// Peekable iterable

class Peekeratable<T, TReturn=any, TNext=any> implements AsyncIterator<T, TReturn, TNext> {
	#queued : T[] = [];
	#wrapped : AsyncIterator<T>;
	constructor(wrapped:AsyncIterator<T>) {
		this.#wrapped = wrapped;
	}
	
	unshift(item:T) {
		this.#queued.unshift(item);
	}
	next(...whatever: [] | [TNext]): Promise<IteratorResult<T, TReturn>> {
		const shifted = this.#queued.shift();
		if( shifted != undefined ) {
			return Promise.resolve({done: false, value: shifted});
		} else {
			return this.#wrapped.next(...whatever);
		}
	}
}

const CHAR_0 = '0'.charCodeAt(0);
const CHAR_9 = '9'.charCodeAt(0);
const CHAR_SEMICOLON = ';'.charCodeAt(0);

async function readNum(byteStream:Peekeratable<number>) : Promise<number|undefined> {
	let value : number|undefined = undefined;
	while( true ) {
		const dig = await byteStream.next();
		if( dig.done ) {
			return value;
		} else if( dig.value < CHAR_0 || dig.value > CHAR_9 ) {
			byteStream.unshift(dig.value);
			return value;
		} else {
			if( value == undefined ) value = 0;
			value = value*10 + dig.value - CHAR_0;
		}
	}
}

const textDecoder = new TextDecoder();

function charCodeToString(byte:number) : string {
	return textDecoder.decode(new Uint8Array([byte]));
}

async function readCharish(byteStream:Peekeratable<number>) : Promise<Charish> {
	const esc = await byteStream.next();
	if( esc.done ) {
		return null;
	} else if( esc.value != 0x1b ) {
		return esc.value;
	}
	const code1 = await byteStream.next();
	if( code1.done ) {
		return null;
	} else if( code1.value == 91 ) { // '['
		const params : number[] = [];
		while( true ) {
			const paramValue = await readNum(byteStream);
			if( paramValue != undefined ) {
				params.push(paramValue);
			} else {
				const next = await byteStream.next();
				if( next.done ) {
					throw new Error("Found EOF while trying to read escape sequence");
				} else if( next.value == CHAR_SEMICOLON ) {
					continue;
				} else {
					return {
						type: "EscapeSequence",
						code1: "[",
						params,
						code2: charCodeToString(next.value),
					}
				}
			}
		}
	}
	throw new Error(`TODO: readEscapeSequence for char ${charCodeToString(code1.value)}`);
}

async function* toCharishes(byteStream:AsyncIterable<number>, includeEof:boolean=false) : AsyncIterable<Charish> {
	const iter = new Peekeratable(byteStream[Symbol.asyncIterator]());
	while( true ) {
		const charish = await readCharish(iter);
		if( charish == null ) {
			return;
		} else {
			yield(charish);
		}
	}
}

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


function charishToInputEvent(charish:Charish) : KeyEvent {
	throw new Error("TODO: charishToInputEvent");
}

async function* inputEvents(chunks : Iterable<Uint8Array>) : AsyncIterable<KeyEvent> {
	const bytes = toBytes(chunks);
	for await( const charish of toCharishes(bytes) ) {
		yield charishToInputEvent(charish);
	}
}

Deno.test("read some regular key events", () => {
	
});
