import Peekerator from './src/lib/ts/Peekerator.ts';
import { KeyPressEvent, MouseEvent, MousePressEvent, MouseScrollEvent } from "https://deno.land/x/tui@2.1.11/src/input_reader/types.ts";
import { toAsyncIterable, toList } from "./src/lib/ts/asynciterableutil.ts";
import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import { decodeBuffer } from 'https://deno.land/x/tui@2.1.11/mod.ts';

async function* toBytes(chunks : AsyncIterable<Uint8Array>) {
	for await( const chunk of chunks ) {
		for( const byte of chunk ) {
			yield byte;
		}
	}
}

interface EscapeSequence {
	type: "EscapeSequence",
	code1 : string; // The character directly following the escape
	params : number[];
	code2? : string; // The character following the parameters, if any
}
type Charish = number | EscapeSequence;

const EMPTY_PARAMS : number[] = [];

//// Peekable iterable

const CHAR_0 = '0'.charCodeAt(0);
const CHAR_9 = '9'.charCodeAt(0);
const CHAR_SEMICOLON = ';'.charCodeAt(0);

async function readNum(byteStream:Peekerator<number>) : Promise<number|undefined> {
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

async function readCharish(byteStream:Peekerator<number>) : Promise<Charish|null> {
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
	} else {
		// TODO: Parse properly.  Until then, these are just 'alt key down'
		return {
			type: "EscapeSequence",
			code1: charCodeToString(code1.value),
			params: EMPTY_PARAMS,
		}
	}
}

async function* toCharishes(byteStream:AsyncIterable<number>, includeEof:boolean=false) : AsyncIterable<Charish> {
	const iter = new Peekerator(byteStream[Symbol.asyncIterator]());
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




type SpecialCharName = "escape"|"enter"; // etc

interface KeyEvent {
	charish?: Charish, // The charish that encoded this event
	type: "Key",
	char: string, // e.g. "A"
	lowercaseChar: string, // e.g. "a"
	special?: SpecialCharName, // Name of special key
	meta: boolean,
	shift: boolean,
	control: boolean,
}

const seeAlso = decodeBuffer; // Here so you can ctrl+click it in VS code for inspiration

function charishToInputEvent(charish:Charish, metaDown:boolean=false) : KeyEvent {
	if( typeof(charish) == 'number' ) {
		if( charish >=  0 && charish < 32 ) {
			return {
				type: "Key",
				char         : charCodeToString(charish),
				lowercaseChar: charCodeToString(charish+96),
				shift  : true,
				control: true,
				meta   : metaDown,
			}
		} if( charish >= 32 && charish < 64 ) {
			return {
				type: "Key",
				char         : charCodeToString(charish),
				lowercaseChar: charCodeToString(charish+64),
				shift  : false,
				control: true,
				meta   : metaDown,
			}
		} else if( charish >= 64 && charish < 96 ) {
			return {
				type: "Key",
				char         : charCodeToString(charish),
				lowercaseChar: charCodeToString(charish+32),
				shift  : true,
				control: false,
				meta   : metaDown,
			}
		} else if( charish >= 96 && charish < 128 ) {
			return {
				type: "Key",
				char         : charCodeToString(charish),
				lowercaseChar: charCodeToString(charish),
				shift  : false,
				control: false,
				meta   : metaDown,
			}
		}
	} else {
		// TODO: Deal with codes properly.  Until then, assume code1 = character typed with 'alt' down.
		return charishToInputEvent(charish.code1.charCodeAt(0), true);
	}
	
	return {
		type: "Key",
		char: "idklol",
		lowercaseChar: "idklol",
		meta: false,
		shift: false,
		control: false	
	}
}

async function* inputEvents(chunks : AsyncIterable<Uint8Array>) : AsyncIterable<KeyEvent> {
	const bytes = toBytes(chunks);
	for await( const charish of toCharishes(bytes) ) {
		yield charishToInputEvent(charish);
	}
}

Deno.test("read some regular key events", () => {
	
});

Deno.stdin.setRaw(true);
console.log(`pid ${Deno.pid}`);
try {
	for await( const inputEvent of inputEvents(Deno.stdin.readable) ) {
		console.log(`charish ${JSON.stringify(inputEvent.charish)}   ->  ${JSON.stringify(inputEvent)}`);
		if( inputEvent.char == "q" ) {
			console.log("# Goodbye!");
			break;
		} else if( inputEvent.lowercaseChar == "c" && inputEvent.control ) {
			console.log("# See ya!");
			break;		
		}
	}
} finally {
	Deno.stdin.setRaw(false);
}
