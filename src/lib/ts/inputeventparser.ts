// import { decodeBuffer } from 'https://deno.land/x/tui@2.1.11/mod.ts';

import { toBytes } from './asynciterableutil.ts';
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

export async function* inputEvents(chunks : AsyncIterable<Uint8Array>) : AsyncIterable<KeyEvent> {
	const bytes = toBytes(chunks);
	for await( const charish of toCharishes(bytes) ) {
		yield charishToInputEvent(charish);
	}
}
