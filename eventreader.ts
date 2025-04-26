
import { KeyPressEvent, MouseEvent, MousePressEvent, MouseScrollEvent } from "https://deno.land/x/tui@2.1.11/src/input_reader/types.ts";
import { toAsyncIterable, toList } from "./src/lib/ts/asynciterableutil.ts";
import { decodeBuffer } from 'https://deno.land/x/tui@2.1.11/mod.ts';
import { Charish, toCharishes } from './src/lib/ts/escapeparser.ts';

async function* toBytes(chunks : AsyncIterable<Uint8Array>) {
	for await( const chunk of chunks ) {
		for( const byte of chunk ) {
			yield byte;
		}
	}
}






type SpecialCharName = "escape"|"enter"; // etc

// Note: It may be useful to define KeyEvent in a way that is
// vaguely compatible with https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
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
				char         : String.fromCharCode(charish),
				lowercaseChar: String.fromCharCode(charish+96),
				shift  : true,
				control: true,
				meta   : metaDown,
			}
		} if( charish >= 32 && charish < 64 ) {
			return {
				type: "Key",
				char         : String.fromCharCode(charish),
				lowercaseChar: String.fromCharCode(charish+64),
				shift  : false,
				control: true,
				meta   : metaDown,
			}
		} else if( charish >= 64 && charish < 96 ) {
			return {
				type: "Key",
				char         : String.fromCharCode(charish),
				lowercaseChar: String.fromCharCode(charish+32),
				shift  : true,
				control: false,
				meta   : metaDown,
			}
		} else if( charish >= 96 && charish < 128 ) {
			return {
				type: "Key",
				char         : String.fromCharCode(charish),
				lowercaseChar: String.fromCharCode(charish),
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
