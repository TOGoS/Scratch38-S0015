// import { decodeBuffer } from 'https://deno.land/x/tui@2.1.11/mod.ts';

import { toBytes } from '../_util/asynciterableutil.ts';
import { Charish, toCharishes } from './escapeparser.ts';

type SpecialCharName = "Escape"|"Enter"|"Backspace"|"Delete"|
	"F1"|"F2"|"F3"|"F4"|"F5"|"F6"|"F7"|"F8"|"F9"|"F10"|"F11"|"F12"|
	"Insert"|"Home"|"End"|"PagegUp"|"PageDown"|
	"Up"|"Down"|"Right"|"Left"; // etc

// Note: It may be useful to define KeyEvent in a way that is
// vaguely compatible with https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
interface KeyEvent {
	charish?: Charish, // The charish that encoded this event
	type: "Key",
	key: string|SpecialCharName, // e.g. "a", "A", "F1", "Right"; "Unidentified" if unknown (should be compatible with https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values)
	metaKey: boolean,
	shiftKey: boolean,
	ctrlKey: boolean,
}

function keyFromTildeCode(code:number) : string {
	switch( code ) {
	case 11: return "F1";
	case 12: return "F2";
	case 13: return "F3";
	case 14: return "F4";
	case 15: return "F5";
	case 17: return "F6";
	case 18: return "F7";
	case 19: return "F8";
	case 20: return "F9";
	case 21: return "F10";
	case 23: return "F11";
	case 24: return "F12";
	// Probably more of them!
	default: return "Unidentified";
	}
}

function keyFromLetterCode(code:string) : string {
	switch( code ) {
	case "A": return "Up";
	case "B": return "Down";
	case "C": return "Right";
	case "D": return "Left";
	default: return "Unidentified";
	}
}

function charishToInputEvent(charish:Charish, metaDown:boolean=false) : KeyEvent {
	if( typeof(charish) == 'number' ) {
		if( charish >=  0 && charish < 32 ) {
			return {
				charish,
				type: "Key",
				key       : String.fromCharCode(charish+96),
				shiftKey  : false,
				ctrlKey   : true,
				metaKey   : metaDown,
			}
		} else if( charish == 127 ) {
			return {
				charish,
				type: "Key",
				key       : "Backspace",
				shiftKey  : false,
				ctrlKey   : false,
				metaKey   : metaDown,
			}
		} else {
			// Everything else return as-is
			return {
				charish,
				type: "Key",
				key       : String.fromCharCode(charish),
				shiftKey  : true,
				ctrlKey   : false,
				metaKey   : metaDown,
			}
		}
	} else if( charish.code1 == "[" ) {
		if( charish.code2 == "~" ) {
			return {
				charish,
				type: "Key",
				metaKey: metaDown,
				shiftKey: false,
				ctrlKey: false,
				key: keyFromTildeCode(charish.params[0]),
			};
		} else if( charish.params.length == 0 && charish.code2 ) {
			return {
				charish,
				type: "Key",
				metaKey: metaDown,
				shiftKey: false,
				ctrlKey: false,
				key: keyFromLetterCode(charish.code2),
			};
		} else {
			return {
				charish,
				type: "Key",
				metaKey: metaDown,
				shiftKey: false,
				ctrlKey: false,
				key: "Unidentified",
			};
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
