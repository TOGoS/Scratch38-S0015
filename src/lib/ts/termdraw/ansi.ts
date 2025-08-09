import * as ansicodes from 'https://deno.land/x/tui@2.1.11/src/utils/ansi_codes.ts';
import DrawCommand from './DrawCommand.ts';

export const RESET_FORMATTING = "\x1b[0m";

/**
 * 'bright' and 'bold' may be effectively synonyms.
 * For simplicity, you might want to stick to the regular (unprefixed) and BRIGHT_
 * colors.
 * 
 * ALSO Maybe the bold and faint should just be separate styles.
 * Or: styles should be lists of numbers that then get ";"-joined
 * together to make the full escape sequence?  This would only work for basic ones;
 * once you get into 256color mode, positiion is important.
 * Need to study the rules further.
*/

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

export const BOLD_BLACK_TEXT           = "\x1b[1;30m";
export const BOLD_RED_TEXT             = "\x1b[1;31m";
export const BOLD_GREEN_TEXT           = "\x1b[1;32m";
export const BOLD_YELLOW_TEXT          = "\x1b[1;33m";
export const BOLD_BLUE_TEXT            = "\x1b[1;34m";
export const BOLD_MAGENTA_TEXT         = "\x1b[1;35m";
export const BOLD_CYAN_TEXT            = "\x1b[1;36m";
export const BOLD_WHITE_TEXT           = "\x1b[1;37m";
export const BOLD_BRIGHT_BLACK_TEXT    = "\x1b[1;90m";
export const BOLD_BRIGHT_RED_TEXT      = "\x1b[1;91m";
export const BOLD_BRIGHT_GREEN_TEXT    = "\x1b[1;92m";
export const BOLD_BRIGHT_YELLOW_TEXT   = "\x1b[1;93m";
export const BOLD_BRIGHT_BLUE_TEXT     = "\x1b[1;94m";
export const BOLD_BRIGHT_MAGENTA_TEXT  = "\x1b[1;95m";
export const BOLD_BRIGHT_CYAN_TEXT     = "\x1b[1;96m";
export const BOLD_BRIGHT_WHITE_TEXT    = "\x1b[1;97m";

export const FAINT_BLACK_TEXT          = "\x1b[2;30m";
export const FAINT_RED_TEXT            = "\x1b[2;31m";
export const FAINT_GREEN_TEXT          = "\x1b[2;32m";
export const FAINT_YELLOW_TEXT         = "\x1b[2;33m";
export const FAINT_BLUE_TEXT           = "\x1b[2;34m";
export const FAINT_MAGENTA_TEXT        = "\x1b[2;35m";
export const FAINT_CYAN_TEXT           = "\x1b[2;36m";
export const FAINT_WHITE_TEXT          = "\x1b[2;37m";
export const FAINT_BRIGHT_BLACK_TEXT   = "\x1b[2;90m";
export const FAINT_BRIGHT_RED_TEXT     = "\x1b[2;91m";
export const FAINT_BRIGHT_GREEN_TEXT   = "\x1b[2;92m";
export const FAINT_BRIGHT_YELLOW_TEXT  = "\x1b[2;93m";
export const FAINT_BRIGHT_BLUE_TEXT    = "\x1b[2;94m";
export const FAINT_BRIGHT_MAGENTA_TEXT = "\x1b[2;95m";
export const FAINT_BRIGHT_CYAN_TEXT    = "\x1b[2;96m";
export const FAINT_BRIGHT_WHITE_TEXT   = "\x1b[2;97m";

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

export const BOLD_BLACK_BACKGROUND           = "\x1b[1;40m";
export const BOLD_RED_BACKGROUND             = "\x1b[1;41m";
export const BOLD_GREEN_BACKGROUND           = "\x1b[1;42m";
export const BOLD_YELLOW_BACKGROUND          = "\x1b[1;43m";
export const BOLD_BLUE_BACKGROUND            = "\x1b[1;44m";
export const BOLD_MAGENTA_BACKGROUND         = "\x1b[1;45m";
export const BOLD_CYAN_BACKGROUND            = "\x1b[1;46m";
export const BOLD_WHITE_BACKGROUND           = "\x1b[1;47m";
export const BOLD_BRIGHT_BLACK_BACKGROUND    = "\x1b[1;100m";
export const BOLD_BRIGHT_RED_BACKGROUND      = "\x1b[1;101m";
export const BOLD_BRIGHT_GREEN_BACKGROUND    = "\x1b[1;102m";
export const BOLD_BRIGHT_YELLOW_BACKGROUND   = "\x1b[1;103m";
export const BOLD_BRIGHT_BLUE_BACKGROUND     = "\x1b[1;104m";
export const BOLD_BRIGHT_MAGENTA_BACKGROUND  = "\x1b[1;105m";
export const BOLD_BRIGHT_CYAN_BACKGROUND     = "\x1b[1;106m";
export const BOLD_BRIGHT_WHITE_BACKGROUND    = "\x1b[1;107m";

export const FAINT_BLACK_BACKGROUND          = "\x1b[2;40m";
export const FAINT_RED_BACKGROUND            = "\x1b[2;41m";
export const FAINT_GREEN_BACKGROUND          = "\x1b[2;42m";
export const FAINT_YELLOW_BACKGROUND         = "\x1b[2;43m";
export const FAINT_BLUE_BACKGROUND           = "\x1b[2;44m";
export const FAINT_MAGENTA_BACKGROUND        = "\x1b[2;45m";
export const FAINT_CYAN_BACKGROUND           = "\x1b[2;46m";
export const FAINT_WHITE_BACKGROUND          = "\x1b[2;47m";
export const FAINT_BRIGHT_BLACK_BACKGROUND   = "\x1b[2;100m";
export const FAINT_BRIGHT_RED_BACKGROUND     = "\x1b[2;101m";
export const FAINT_BRIGHT_GREEN_BACKGROUND   = "\x1b[2;102m";
export const FAINT_BRIGHT_YELLOW_BACKGROUND  = "\x1b[2;103m";
export const FAINT_BRIGHT_BLUE_BACKGROUND    = "\x1b[2;104m";
export const FAINT_BRIGHT_MAGENTA_BACKGROUND = "\x1b[2;105m";
export const FAINT_BRIGHT_CYAN_BACKGROUND    = "\x1b[2;106m";
export const FAINT_BRIGHT_WHITE_BACKGROUND   = "\x1b[2;107m";

//// Other style sequences

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
