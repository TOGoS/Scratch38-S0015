import * as ansicodes from 'https://deno.land/x/tui@2.1.11/src/utils/ansi_codes.ts';
import DrawCommand from './DrawCommand.ts';

export const RESET_FORMATTING = "\x1b[0m";
export const RED_TEXT = "\x1b[31m";

export function ansiEscape(text:string) : string {
	return text.replaceAll("\x1b", "\u241B");
}

export function moveToXy(x:number, y:number): string {
	return `\x1b[${y + 1};${x + 1}H`;
 } 

export function toAnsi(dc:DrawCommand) : string {
	switch(dc.classRef) {
		case "x:ClearScreen": {
			return ansicodes.CLEAR_SCREEN;
		}
		case "x:PSTextSpan": {
			return (
				moveToXy(dc.x, dc.y) +
				dc.style +
				ansiEscape(dc.text)
			);
		}
		case "x:Move": {
			return moveToXy(dc.x, dc.y);
		}
		case "x:EmitText": {
			return ansiEscape(dc.text);
		}
		case "x:EmitLiteral": {
			return dc.sequence;
		}
	}
}
