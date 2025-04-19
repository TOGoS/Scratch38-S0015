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

function moveToTop() : Promise<unknown> {
	return Deno.stdout.write(textEncoder.encode('\x1b[1;1H'));
}
function printLine(str:string) : Promise<unknown> {
	return Deno.stdout.write(textEncoder.encode(str+"\n"));
}

function padLeft(template:string, content:string) : string {
	if( content.length > template.length ) return content.substring(content.length-template.length);
	return template.substring(0, template.length-content.length) + content;
}

let state : "default"|"entering-tui"|"tui"|"exiting-tui" = "default";
let messages : string[] = [];
let redrawRequested = false;
let drawCount = 0;

// TODO: Less asynchronicity; one 'thread' (i.e. promise chain) for all output changes and writing

async function draw() {
	if( state != "tui" ) return;
	
	++drawCount;
	
	await moveToTop();
	
	const nocolor = '\x1b[0m';
	const color = colors[colorIndex];
	// See https://en.wikipedia.org/wiki/Box-drawing_characters
	await printLine(`┌───────────────┐`);
	await printLine(`│    ${color}Hello TUI!${nocolor} │`);
	await printLine(`├───────────────┤`);
	await printLine(`│ Draws: \x1b[34m${padLeft("      ", ""+drawCount)}${nocolor} │`);
	await printLine(`└───────────────┘`);
	for( const m of messages ) {
		printLine(m);
	}
}

function requestRedraw() {
	if( redrawRequested ) return;
	
	redrawRequested = true;
	setTimeout(async () => {
		await draw();
		redrawRequested = false;
	}, 0);
}

function log(message:string) {
	// TODO: Just have a logger variable that can be switched out when exiting
	if( state == "entering-tui" || state == "tui" ) {
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
	state = "entering-tui";
	await Deno.stdout.write(textEncoder.encode(ansicodes.USE_SECONDARY_BUFFER + ansicodes.HIDE_CURSOR));
	await Deno.stdout.write(textEncoder.encode(ansicodes.CLEAR_SCREEN));
	await Deno.stdin.setRaw(true);
	state = "tui";
}

async function exitTui() {
	state = "exiting-tui";
	await Deno.stdin.setRaw(false);
	await Deno.stdout.write(textEncoder.encode(ansicodes.USE_PRIMARY_BUFFER + ansicodes.SHOW_CURSOR));
	state = "default";
}

await enterTui();
printLine("Lawg!");
draw();
const interval = setInterval(updateColor, 1000);

const input = Deno.stdin.readable;

async function quit() {
	await exitTui();
	Deno.stdin.close();
	clearInterval(interval);
}

async function* inputEvents(stdin : ReadableStream) {
	for await( const chunk of stdin ) {
		// TODO: Roll own decoding; this one merges multiple keystrokes into one;
		// typing "escape" really fast is indistinguishable from the event
		// representation of the "escape" key!
		for (const event of decodeBuffer(chunk)) {
			yield {key: event.key, ctrl: event.ctrl, meta: event.meta, shift: event.shift};
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

// Note: If debugging in the 'debug console' of Visual Studio Code, you'll get console.whatever,
// but not things written to Deno.stdout!  Bah!
