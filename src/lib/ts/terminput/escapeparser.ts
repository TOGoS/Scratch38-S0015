export interface EscapeSequence {
	type: "EscapeSequence",
	// Hmm: Maybe code1/code2 should just be numbers instead of strings?
	code1 : string; // The character directly following the escape
	params : number[];
	code2? : string; // The character following the parameters, if any
}
export type Charish = number | EscapeSequence;

const EMPTY_PARAMS : number[] = [];

import Peekerator from '../_util/Peekerator.ts';

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
						code2: String.fromCharCode(next.value),
					}
				}
			}
		}
	} else {
		// TODO: Parse properly.  Until then, these are just 'alt key down'
		return {
			type: "EscapeSequence",
			code1: String.fromCharCode(code1.value),
			params: EMPTY_PARAMS,
		}
	}
}

export async function* toCharishes(byteStream:AsyncIterable<number>) : AsyncIterable<Charish> {
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
