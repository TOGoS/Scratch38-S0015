import * as ansicodes from 'https://deno.land/x/tui@2.1.11/src/utils/ansi_codes.ts';
import DrawCommand from './DrawCommand.ts';

export const RESET_FORMATTING = "\x1b[0m";

//// Foreground colors

export const BLACK_TEXT                = "\x1b[30m";
export const RED_TEXT                  = "\x1b[31m";
export const GREEN_TEXT                = "\x1b[32m";
export const YELLOW_TEXT               = "\x1b[33m";
export const BLUE_TEXT                 = "\x1b[34m";
export const MAGENTA_TEXT              = "\x1b[35m";
export const CYAN_TEXT                 = "\x1b[36m";
export const WHITE_TEXT                = "\x1b[37m";
export const BRIGHT_BLACK_TEXT         = "\x1b[90m";
export const BRIGHT_RED_TEXT           = "\x1b[91m";
export const BRIGHT_GREEN_TEXT         = "\x1b[92m";
export const BRIGHT_YELLOW_TEXT        = "\x1b[93m";
export const BRIGHT_BLUE_TEXT          = "\x1b[94m";
export const BRIGHT_MAGENTA_TEXT       = "\x1b[95m";
export const BRIGHT_CYAN_TEXT          = "\x1b[96m";
export const BRIGHT_WHITE_TEXT         = "\x1b[97m";

//// Background colors

export const BLACK_BACKGROUND                = "\x1b[40m";
export const RED_BACKGROUND                  = "\x1b[41m";
export const GREEN_BACKGROUND                = "\x1b[42m";
export const YELLOW_BACKGROUND               = "\x1b[43m";
export const BLUE_BACKGROUND                 = "\x1b[44m";
export const MAGENTA_BACKGROUND              = "\x1b[45m";
export const CYAN_BACKGROUND                 = "\x1b[46m";
export const WHITE_BACKGROUND                = "\x1b[47m";
export const BRIGHT_BLACK_BACKGROUND         = "\x1b[100m";
export const BRIGHT_RED_BACKGROUND           = "\x1b[101m";
export const BRIGHT_GREEN_BACKGROUND         = "\x1b[102m";
export const BRIGHT_YELLOW_BACKGROUND        = "\x1b[103m";
export const BRIGHT_BLUE_BACKGROUND          = "\x1b[104m";
export const BRIGHT_MAGENTA_BACKGROUND       = "\x1b[105m";
export const BRIGHT_CYAN_BACKGROUND          = "\x1b[106m";
export const BRIGHT_WHITE_BACKGROUND         = "\x1b[107m";

//// Other style sequences

export const BOLD = "\x1b[1m";
export const FAINT = "\x1b[2m";
export const BLINK = "\x1b[5m";
export const RAPID_BLINK = "\x1b[6m";
export const UNDERLINED = "\x1b[4m";
export const DOUBLE_UNDERLINED = "\x1b[21m";

//// Other control sequences

export const SHOW_CURSOR = `\x1b[?25h`;
export const HIDE_CURSOR = `\x1b[?25l`;
export const CLEAR_SCREEN = `\x1b[2J`;
export const USE_SECONDARY_BUFFER = "\x1b[?1049h";
export const USE_PRIMARY_BUFFER = "\x1b[?1049l";


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
		case "x:EmitStyleChange": {
			return RESET_FORMATTING + dc.sequence;
		}
	}
}
