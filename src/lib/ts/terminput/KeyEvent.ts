import { Charish } from './escapeparser.ts';

type SpecialCharName = "Escape"|"Enter"|"Backspace"|"Delete"|
	"F1"|"F2"|"F3"|"F4"|"F5"|"F6"|"F7"|"F8"|"F9"|"F10"|"F11"|"F12"|
	"Insert"|"Home"|"End"|"PagegUp"|"PageDown"|
	"Up"|"Down"|"Right"|"Left"; // etc

// Note: It may be useful to define KeyEvent in a way that is
// vaguely compatible with https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
export default interface KeyEvent {
	charish?: Charish, // The charish that encoded this event
	type: "keypress",
	key: string|SpecialCharName, // e.g. "a", "A", "F1", "Right"; "Unidentified" if unknown (should be compatible with https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values)
	metaKey: boolean,
	shiftKey: boolean,
	ctrlKey: boolean,
}
