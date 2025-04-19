import { decodeBuffer } from 'https://deno.land/x/tui@2.1.11/mod.ts';
import * as ansicodes from 'https://deno.land/x/tui@2.1.11/src/utils/ansi_codes.ts';

// tuidemo1.ts
const colors = [
	"\x1b[31m", // Red
	"\x1b[32m", // Green
	"\x1b[33m", // Yellow
	"\x1b[34m", // Blue
	"\x1b[35m", // Magenta
	"\x1b[36m", // Cyan
];

let colorIndex = 0;

const textEncoder = new TextEncoder();

function clear() : Promise<unknown> {
	return Deno.stdout.write(textEncoder.encode('\x1b[0J'));
}
function moveToTop() : Promise<unknown> {
	return Deno.stdout.write(textEncoder.encode('\x1b[1;1H'));
}
function drawLog(str:string) : Promise<unknown> {
	return Deno.stdout.write(textEncoder.encode(str+"\n"));
}

let inTui : boolean = false;
let messages : string[] = [];

async function drawBox() {
	await moveToTop();
	
	const nocolor = '\x1b[0m';
	const color = colors[colorIndex];
	await drawLog(`┌────────────┐`);
	await drawLog(`│ ${color}Hello TUI!${nocolor} │`);
	await drawLog(`└────────────┘`);
	for( const m of messages ) {
		drawLog(m);
	}
}

function requestRedraw() {
	drawBox();
}

function log(message:string) {
	if( inTui ) {
		messages.push(message);
		messages = messages.slice(Math.max(0,messages.length - 10));
		requestRedraw();
	} else {
		console.log(message);
	}
}

function updateColor() {
	colorIndex = (colorIndex + 1) % colors.length;
	requestRedraw();
}

async function enterTui() {
	inTui = true;
	await Deno.stdin.setRaw(true);
	await Deno.stdout.write(textEncoder.encode(ansicodes.USE_SECONDARY_BUFFER + ansicodes.HIDE_CURSOR));
}

async function exitTui() {
	await Deno.stdin.setRaw(false);
	await Deno.stdout.write(textEncoder.encode(ansicodes.USE_PRIMARY_BUFFER + ansicodes.SHOW_CURSOR));
	inTui = false;
}

await enterTui();
drawLog("Lawg!");
drawBox();
const interval = setInterval(updateColor, 1000);

const input = Deno.stdin.readable;

async function quit() {
	await exitTui();
	Deno.stdin.close();
	clearInterval(interval);
}

async function* inputEvents(stdin : ReadableStream) {
	for await( const chunk of stdin ) {
		for (const event of decodeBuffer(chunk)) {
			yield event;
		}
	}
}

try {
	for await(const evt of inputEvents(input)) {
		log(`Read event: ${JSON.stringify(evt)}`);
		if( evt.key == "q" ) {
			await quit();
		}
	}
} catch( e ) {
	if( e instanceof Error && e.name == 'BadResource' ) {
		// Presumably from closing the input stream;
		log(`Ignoring error: ${e}`)
	} else {
		throw e;
	}
}

// See tui/src/input_reader/mod.ts for hints on handling input
/*
for await( const buf of Deno.stdin.readable ) {
	for( const byte of buf ) {
		if( byte == 113 ) { // 'q'
			console.log(`# Bye bye!`);
			quit();
		} else {
			exitTui();
			console.log(`# You said ${byte}; Goodbye!`);
			Deno.exit(0);
		}
	}
}
*/
	

// Note: If debugging in the 'debug console' of Visual Studio Code, you'll get console.whatever,
// but not things written to Deno.stdout!  Bah!
