import { inputEvents } from 'https://deno.land/x/scratch38s15@0.0.8/src/lib/ts/terminput/inputeventparser.ts';
import TOGTUICanvas from 'https://deno.land/x/scratch38s15@0.0.8/src/lib/ts/termdraw/TOGTUICanvas.ts';
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

const outWriter = Deno.stdout.writable.getWriter();
let needClear  = true;

//// A stab at making 'reactive' things.
// See also: That one SynthGen demo I made that one time,
// with the updatable nodes, that differentiated between
// inward and outward updates, and worked surprisingly well.

interface Thenable<T> {
	then<T1>(map:(x:T) => T1) : T1;
}
function isThenable<V>(v:V|Thenable<V>) : v is Thenable<V> {
	// deno-lint-ignore no-explicit-any
	return typeof(v) == 'object' && typeof((v as any)['then']) == 'function';
}
interface Reactor<T> {
	addUpdateListener(callback:(v:T)=>void ) : void;
	readonly value : T;
	map<T1>(map: (x: T) => T1) : Reactor<T1>;
	then<T1>(map: (x: T) => T1|Thenable<T1>, initialValue:T1) : Reactor<T1>;
}
class BasicReactor<T> implements Reactor<T> {
	#updateListeners : ((v:T)=>unknown)[] = [];
	#value : T;
	constructor(initialValue:T) {
		this.#value = initialValue;
	}
	update(v:T, force:boolean=false) {
		if( force || v != this.#value ) {
			this.#value = v;
			for( const l of this.#updateListeners ) l(v);
		}
	}
	get value() : T {
		return this.#value;
	}
	addUpdateListener(callback:(v:T)=>void ) : void {
		this.#updateListeners.push(callback);
		callback(this.value);
	}
	map<T1>(map: (x: T) => T1): Reactor<T1> {
		const reactor1 = new BasicReactor<T1>(map(this.value));
		// Ooh, return of map could be a Promise...
		// OR ANOTHER REACTOR!!!
		// Maybe this hints that I should just be using AsyncIterators everywhere idklol.
		this.addUpdateListener(v => {
			const v1Prom = map(v)
			if( isThenable(v1Prom) ) {
				v1Prom.then(v1 => reactor1.update(v1));
			} else {
				reactor1.update(v1Prom);
			}
		});
		return reactor1;
	}
	then<T1>(map: (x: T) => Thenable<T1>, initialValue:T1): Reactor<T1> {
		const reactor1 = new BasicReactor<T1>(initialValue);
		// Ooh, return of map could be a Promise...
		// OR ANOTHER REACTOR!!!
		// Maybe this hints that I should just be using AsyncIterators everywhere idklol.
		this.addUpdateListener(v => {
			const v1Prom = map(v)
			if( isThenable(v1Prom) ) {
				v1Prom.then(v1 => reactor1.update(v1));
			} else {
				reactor1.update(v1Prom);
			}
		});
		return reactor1;
	}
}

function toWidthHeight(consoleSize:{rows:number,columns:number}) : {width:number,height:number} {
	const {rows:height, columns:width} = consoleSize;
	return {width,height};
}

const rowsColsVar = new BasicReactor(Deno.consoleSize());
try {
	Deno.addSignalListener("SIGWINCH", () => rowsColsVar.update(Deno.consoleSize()));
} catch( e ) {
	console.warn(`Failed to register SIGWINCH handler: ${e}`);
}
const screenSizeVar = rowsColsVar.map(toWidthHeight);

const screenSizeFormattedVar = screenSizeVar.then(s => s == undefined ? 'undefined' : `${s.width} x ${s.height}`, 'undefined');

// Thought: Instead of all that stuff, could just iterate over 'app state' or something?

const textEncoder = new TextEncoder();

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
			needClear = false;
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
		await writeLine(screenSizeFormattedVar.value);
		for( const m of messages ) {
			await writeLine(m);
		}	
	}
);

screenSizeFormattedVar.addUpdateListener(_f => {
	needClear = true;
	canv.requestRedraw();
});

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

try {
	for await(const evt of inputEvents(input)) {
		log(`Read event: ${JSON.stringify(evt)}`);
		if( evt.key == "\x03" || evt.key == "q" ) {
			await quit();
		} else if( evt.key == "r" ) { // 'r' for redraw
			needClear = true;
			rowsColsVar.update(Deno.consoleSize())
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

// TODO: Get screen size

// Note: If debugging in the 'debug console' of Visual Studio Code, you'll get console.whatever,
// but not things written to Deno.stdout!  Bah!
