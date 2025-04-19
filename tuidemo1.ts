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

function padLeft(template:string, content:string) : string {
	if( content.length > template.length ) return content.substring(content.length-template.length);
	return template.substring(0, template.length-content.length) + content;
}

let messages : string[] = [];
let drawCount = 0;

type TOGTUIRenderer = (writer:WritableStreamDefaultWriter) => Promise<unknown>;

const textEncoder = new TextEncoder();

class TOGTUICanvas {
	#redrawTimeout : number|undefined = undefined;
	#out : WritableStreamDefaultWriter;
	#writeProm : Promise<unknown> = Promise.resolve();
	#renderer : TOGTUIRenderer;
	#state : "off"|"starting"|"on"|"stopping" = "off";
	
	constructor(
		out:WritableStreamDefaultWriter,
		renderer: TOGTUIRenderer
	) {
		this.#state = "off";
		this.#out = out;
		this.#renderer = renderer;
	}
	
	get state() {
		return this.#state;
	}
	
	#write(stuff:string|Uint8Array) : Promise<unknown> {
		if( typeof(stuff) == "string" ) {
			stuff = textEncoder.encode(stuff);
		}
		return this.#writeProm = this.#writeProm.then(
			() => this.#out.write(stuff)
		);
	}
	
	async draw() {
		if( this.#state != "on" ) return;
		await this.#out;
		await this.#renderer(this.#out);
	}
	
	async enterTui() {
		if( this.#state != "off" ) throw new Error(`Can't start canvas; state = ${this.#state}`);
		this.#state = "starting";
		await this.#write(ansicodes.USE_SECONDARY_BUFFER + ansicodes.HIDE_CURSOR);
		this.#state = "on";
		this.requestRedraw();
	}
	async exitTui() {
		if( this.#redrawTimeout ) clearTimeout(this.#redrawTimeout);
		if( this.#state != "on" ) throw new Error(`Can't exit canvas; state = ${this.#state}`);
		this.#state = "starting";
		await this.#write(ansicodes.USE_PRIMARY_BUFFER + ansicodes.SHOW_CURSOR);
		this.#state = "on";
	}
	
	requestRedraw() {
		if( this.#redrawTimeout != undefined ) return;
		this.#redrawTimeout = setTimeout(async () => {
			try {
				await this.draw();
			} finally {
				this.#redrawTimeout = undefined;
			}
		}, 5); // Or 0, but 5 for extra debounciness
	}
}

const outWriter = Deno.stdout.writable.getWriter();
let needClear  = false;

const canv = new TOGTUICanvas(
	outWriter,
	async (out) => {
		++drawCount;
		
		function write(thing:string) {
			return out.write(textEncoder.encode(thing));
		}
		function writeLine(thing:string) {
			return write(thing+"\n");
		}
		
		if( needClear ) {
			await write(ansicodes.CLEAR_SCREEN);
		}
		await write(ansicodes.moveCursor(0,0));
		
		const nocolor = '\x1b[0m';
		const color = colors[colorIndex];
		// See https://en.wikipedia.org/wiki/Box-drawing_characters
		await writeLine(`┌───────────────┐`);
		await writeLine(`│    ${color}Hello TUI!${nocolor} │`);
		await writeLine(`├───────────────┤`);
		await writeLine(`│ Draws: \x1b[34m${padLeft("      ", ""+drawCount)}${nocolor} │`);
		await writeLine(`└───────────────┘`);
		for( const m of messages ) {
			await writeLine(m);
		}	
	}
);

function log(message:string) {
	// TODO: Just have a logger variable that can be switched out when exiting
	if( canv.state == "starting" || canv.state == "on" ) {
		messages.push(message);
		messages = messages.slice(Math.max(0,messages.length - 10));
		canv.requestRedraw();
	} else {
		console.log(message);
	}
}

function updateColor() {
	colorIndex = (colorIndex + 1) % colors.length;
	canv.requestRedraw();
}

Deno.stdin.setRaw(true);
await canv.enterTui();
const colorUpdateInterval = setInterval(updateColor, 1000);

const input = Deno.stdin.readable;

async function quit() {
	await canv.exitTui();
	Deno.stdin.setRaw(false);
	Deno.stdin.close();
	clearInterval(colorUpdateInterval);
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
		} else if( evt.key == "c" ) {
			needClear = true;
			canv.requestRedraw();
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
