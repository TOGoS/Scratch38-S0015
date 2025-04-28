// import { decodeBuffer } from 'https://deno.land/x/tui@2.1.11/mod.ts';

import { toBytes } from '../_util/asynciterableutil.ts';
import { Charish, toCharishes } from './escapeparser.ts';

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

function charishToInputEvent(charish:Charish, metaDown:boolean=false) : KeyEvent {
	if( typeof(charish) == 'number' ) {
		const char = String.fromCharCode(charish);
		if( charish >=  0 && charish < 32 ) {
			return {
				charish,
				type: "Key",
				char         : char,
				lowercaseChar: String.fromCharCode(charish+96),
				shift  : false,
				control: true,
				meta   : metaDown,
			}
		} else if( charish >= 64 && charish < 91 ) {
			// Uppercase letters
			return {
				charish,
				type: "Key",
				char         : char,
				lowercaseChar: String.fromCharCode(charish+32),
				shift  : true,
				control: false,
				meta   : metaDown,
			}
		} else {
			// Everything else return as-is
			return {
				charish,
				type: "Key",
				char         : char,
				lowercaseChar: char,
				shift  : true,
				control: false,
				meta   : metaDown,
			}
		}
	} else {
		// TODO: Deal with codes properly.  Until then, assume code1 = character typed with 'alt' down.
		return charishToInputEvent(charish.code1.charCodeAt(0), true);
	}
}

export async function* inputEvents(chunks : AsyncIterable<Uint8Array>) : AsyncIterable<KeyEvent> {
	const bytes = toBytes(chunks);
	for await( const charish of toCharishes(bytes) ) {
		yield charishToInputEvent(charish);
	}
}
