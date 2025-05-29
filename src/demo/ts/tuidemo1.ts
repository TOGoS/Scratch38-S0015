import { inputEvents } from '../../lib/ts/terminput/inputeventparser.ts';
import TOGTUICanvas from '../../lib/ts/termdraw/TUIRenderStateManager.ts';
// import * as ansicodes from 'https://deno.land/x/tui@2.1.11/src/utils/ansi_codes.ts';
import SpanMan from '../../lib/ts/termdraw/SpanMan.ts';
import { toAnsi } from '../../lib/ts/termdraw/ansi.ts';
import PSTextSpan from '../../lib/ts/termdraw/PSTextSpan.ts';

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
	set value(v:T) {
		this.update(v, false);
	}
	get value() : T {
		return this.#value;
	}
	updateBy(map: (x:T)=>T) : void {
		this.update(map(this.#value));
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

let helloX = 4;
const topSpanId = 2;
const botSpanId = 3;
const helloSpanId = 4;
const boingSpanId = 5;
const DEFAULT_STYLE = '\x1b[0m';
function makeHelloSpan(helloX:number) : PSTextSpan {
	return {
		classRef: 'x:PSTextSpan',
		x: helloX, y: 2, z: 3,
		style: DEFAULT_STYLE,
		text: "Hello!",
		width: 6,
	};
}
function makeRuleSpan(x:number, y:number, width:number) : PSTextSpan {
	return {
		classRef: 'x:PSTextSpan',
		x, y, z: 0,
		width,
		style: DEFAULT_STYLE,
		text: "#".repeat(width)
	}
}
const spanManVar = new BasicReactor(new SpanMan(new Map([
	[1, {
		classRef: 'x:PSTextSpan',
		x: 0, y: 0, z: 0,
		style: colors[colorIndex],
		text: "Foo",
		width: 3,
	}],
	[helloSpanId, makeHelloSpan(helloX)],
]), {
	worldX: 0, worldY: 0,
	screenX: 2, screenY: 2,
	width: 20, height: 20
}));

rowsColsVar.addUpdateListener(size =>
	spanManVar.updateBy(spanMan => {
		const margin = {x:2, y:1}; // Just to show that position on screen does not have to = position in virtual 'world'
		const oldVr = spanMan.viewRect;
		const newVr = oldVr.width == size.columns && oldVr.height == size.rows ? oldVr : {
			worldX : oldVr. worldX,  worldY: oldVr. worldY,
			screenX: 0+margin.x, screenY: margin.y,
			width  :  size.columns - margin.x*2,  height:  size.rows - margin.y*2  ,
		};
		spanMan = spanMan.update(new Map([
			[topSpanId, makeRuleSpan(newVr.worldX, newVr.worldY, newVr.width)],
			[botSpanId, makeRuleSpan(newVr.worldX, newVr.worldY + newVr.height-1, newVr.width)],
		]));
		return spanMan.withViewRect(newVr);
	})
);

const canv = new TOGTUICanvas(
	outWriter,
	async (out) => {
		++drawCount;
		
		function write(thing:string) : Promise<void> {
			return out.write(textEncoder.encode(thing));
		}
		function writeLine(thing:string) : Promise<void> {
			return write(thing+"\n");
		}
		
		const {newState, output} = spanManVar.value.render();
		for( const out of output ) {
			await write(toAnsi(out));
		}
		// Hmm, this might trigger a loop:
		spanManVar.value = newState;
		
		/*
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
		*/
	}
);

spanManVar.addUpdateListener(_f => canv.requestRedraw());

screenSizeFormattedVar.addUpdateListener(_f => {
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

function updateScene() {
	helloX += 1;
	if( helloX >= screenSizeVar.value.width - 4 ) helloX = -6;
	spanManVar.updateBy(spanMan => {
		return spanMan.update(new Map([
			[helloSpanId, makeHelloSpan(helloX)]
		]));
	});
	colorIndex = (colorIndex + 1) % colors.length;
	// canv.requestRedraw();
}

let boingX = -10;
const boingVX = 10;
let boingY = 0;
let boingVY = 10;
const boingAY = -5;
const boingFps = 100;

function updateBoing() {
	boingX += boingVX/boingFps;
	boingY += boingVY/boingFps;
	boingVY += boingAY/boingFps;
	const vw = screenSizeVar.value.width - 4;
	const vh = screenSizeVar.value.height - 4;
	if( boingY < 0 ) {
		boingY = -boingY;
		boingVY = -boingVY * 0.9;
	}
	if( boingY > vh-1 ) {
		boingY = vh-1 - (vh-1-boingY);
		boingVY = -boingVY;
	}
	if( boingX > vw ) boingX = -10;
	spanManVar.updateBy(spanMan => {
		return spanMan.update(new Map([
			[boingSpanId, {
				classRef: 'x:PSTextSpan',
				x: Math.round(boingX),
				y: screenSizeVar.value.height - 3 - Math.round(boingY),
				z: 3,
				style: DEFAULT_STYLE,
				text: "Boing!",
				width: 6,
			}]
		]));
	});
}

Deno.stdin.setRaw(true);
await canv.enterTui();
const sceneUpdateInterval = setInterval(updateScene, 500);
const boingUpdateInterval = setInterval(updateBoing, 1/boingFps);

const input = Deno.stdin.readable;

async function quit() {
	await canv.exitTui();
	Deno.stdin.setRaw(false);
	Deno.stdin.close();
	clearInterval(sceneUpdateInterval);
	clearInterval(boingUpdateInterval);
}

try {
	for await(const evt of inputEvents(input)) {
		log(`Read event: ${JSON.stringify(evt)}`);
		if( evt.key == "\x03" || evt.key == "q" ) {
			await quit();
		} else if( evt.key == "r" ) { // 'r' for redraw
			rowsColsVar.update(Deno.consoleSize())
			spanManVar.updateBy(spanMan => spanMan.withFullRedrawRequested());
		} else if( evt.key == " " ) {
			boingVY += 20;
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
