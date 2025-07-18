// Model a TUI app as (events:AsyncIterable<InputEvent>) => AsyncIterable<OutputEvent,R>
// which may or may not turn out to be useful.

import Vec2D from '../../lib/ts/termdraw/Vec2D.ts';
import DrawCommand from "../../lib/ts/termdraw/DrawCommand.ts";

import KeyEvent from '../../lib/ts/terminput/KeyEvent.ts';
import TextRaster2 from '../../lib/ts/termdraw/TextRaster2.ts';
import TUIRenderStateManager from '../../lib/ts/termdraw/TUIRenderStateManager.ts';
import { inputEvents } from '../../lib/ts/terminput/inputeventparser.ts';
import { blitToRaster, createUniformRaster, textRaster2ToDrawCommands } from '../../lib/ts/termdraw/textraster2utils.ts';
import { RED_TEXT, RESET_FORMATTING, toAnsi } from '../../lib/ts/termdraw/ansi.ts';
import { iterateAndReturn, mergeAsyncIterables } from '../../lib/ts/_util/asynciterableutil.ts';
import { Signal } from 'https://deno.land/x/tui@2.1.11/mod.ts';

interface ScreenResizeEvent {
	type: "terminalresize",
	width: number,
	height: number,
};

type AppInputEvent =
	| KeyEvent
	| ScreenResizeEvent
 // TODO: Or a line of text (if not yet in TUI mode), or a screen size change
type AppOutputEvent = {
	type: "print",
	text: string
} | {
	type: "enter-tui-mode",
} | {
	type: "exit-tui-mode",
} | {
	type: "set-screen-raster-generator",
	rasterGenerator: () => TextRaster2
};

type TUIApp<R> = (events:AsyncIterable<AppInputEvent>) => AsyncIterable<AppOutputEvent,R>;

function sleepMs(millis:number, abortSignal:AbortSignal) : Promise<void> {
	return new Promise((resolve,reject) => {
		const timeout = setTimeout(resolve, millis);
		abortSignal.addEventListener("abort", () => {
			clearTimeout(timeout);
			reject(abortSignal.reason);
		});
	});
}

interface WriterReader<T> {
	input:WritableStream<T>;
	output:ReadableStream<T>;
}

function writerReader<T>() : WriterReader<T> {
	const stream = new TransformStream();
	return {
		input: stream.writable,
		output: stream.readable,
	};
}

async function gemerateScreenResizeEvents(abortSignal:AbortSignal, dest:(evt:ScreenResizeEvent)=>unknown) : Promise<void> {
	let prevSize :{ columns: number, rows: number }|undefined = undefined;
	function poke() {
		const size = Deno.consoleSize();
		if( size == prevSize ) return;
		if( prevSize == undefined || size.columns != prevSize.columns || size.rows != prevSize.rows ) {
			prevSize = size;
			dest({
				type: "terminalresize",
				width: size.columns,
				height: size.rows,
			});
		}
	}
	
	try {
		Deno.addSignalListener("SIGWINCH", () => poke);
	} catch( e ) {
		console.error("Failed to addSignalListener('SIGWINCH'); oh well.");
	}
	
	while( !abortSignal.aborted ) {
		await poke();
		await sleepMs(5000, abortSignal);
	}
}

async function runTuiApp<R>(stdin:AsyncIterable<Uint8Array>, app:TUIApp<R>, stdout:WritableStreamDefaultWriter) : Promise<R> {
	const textEncoder = new TextEncoder();
	let rasterGenerator : (() => TextRaster2) = () => ({width:0, height:0, chars:[], styles:[]});
	const tuiRenderStateMan = new TUIRenderStateManager(stdout, writer => {
		writer.write(textEncoder.encode(toAnsi({classRef:'x:ClearScreen'})));
		if( rasterGenerator ) {
			const raster = rasterGenerator();
			for( const dc of textRaster2ToDrawCommands(raster, [{x0:0, y0:0, x1:raster.width, y1:raster.height}], {x:0, y:0}) ) {
				writer.write(textEncoder.encode(toAnsi(dc)));
			}
		}
		return Promise.resolve();
	});
	
	const abortController = new AbortController();
	
	const screenResizeStream : WriterReader<ScreenResizeEvent> = writerReader();
	const screenResizeWriter = screenResizeStream.input.getWriter();
	gemerateScreenResizeEvents(abortController.signal, evt => screenResizeWriter.write(evt)).then(_void => screenResizeWriter.close());
	
	const allInputEvents : AsyncIterable<AppInputEvent> = mergeAsyncIterables<AppInputEvent>([inputEvents(stdin), screenResizeStream.output]);
	const outputEvents = app(allInputEvents);
	const retVal = await iterateAndReturn(outputEvents, outputEvent => {
		switch( outputEvent.type ) {
		case 'print':
			return stdout.write(textEncoder.encode(outputEvent.text));
		case 'enter-tui-mode':
			Deno.stdin.setRaw(true);
			return tuiRenderStateMan.enterTui();
		case 'exit-tui-mode':
			Deno.stdin.setRaw(false);
			return tuiRenderStateMan.exitTui();
		case 'set-screen-raster-generator':
			rasterGenerator = outputEvent.rasterGenerator;
			tuiRenderStateMan.requestRedraw();
		}
	});
	if( tuiRenderStateMan.state == "on" ) {
		Deno.stdin.setRaw(false);
		await tuiRenderStateMan.exitTui();
	}
	return retVal;
}

if( import.meta.main ) {
	const app : TUIApp<number> = async function*(inputEvents : AsyncIterable<AppInputEvent>) {
		yield {
			type: "print",
			text: "Hi there!  Type 'x' or 'q' to quit.\nType 't' to enter TUI mode yukyuk.\n",
		};
		
		let inTui = false;
		let data : string[] = ["abc","123"];
		let screenSize : Vec2D<number> = {x:10, y:10};
		const redSquare = createUniformRaster({x:2, y:2}, "K", RED_TEXT);
		function generateRaster() {
			let rast = createUniformRaster(screenSize, " ", RESET_FORMATTING);
			rast = blitToRaster(rast, {x:screenSize.x - 3, y:screenSize.y-3}, redSquare, {x0:0, y0:0, x1:2, y1:2});
			return rast;
		}
		
		for await( const inputEvent of inputEvents ) {
			if( inputEvent.type == "terminalresize" ) {
				screenSize = {x: inputEvent.width, y: inputEvent.height };
				if( !inTui ) yield {
					type: "print",
					text: `Ooh, a screen resize event: ${JSON.stringify(inputEvent)}\n`
				}
				yield {
					type: 'set-screen-raster-generator',
					rasterGenerator: generateRaster
				};
			} else if( inputEvent.key == "x" && inputEvent.ctrlKey == false && inputEvent.metaKey == false ) {
				if( !inTui ) yield {
					type: "print",
					text: "Exiting with status 1!\n"
				}
				return 1;
			} else if( inputEvent.key == "q" && inputEvent.ctrlKey == false && inputEvent.metaKey == false ) {
				if( !inTui )yield {
					type: "print",
					text: "Exiting with status 0!\n"
				}
				return 0;
			} else if( inputEvent.key == "t" ) {
				yield { type: "enter-tui-mode" };
				inTui = true;
				yield {
					type: 'set-screen-raster-generator',
					rasterGenerator: generateRaster
				};
			} else {
				if( !inTui )yield {
					type: "print",
					text: `Ooh, an input event: ${JSON.stringify(inputEvent)}\n`
				}
			}
		}
		return 0;
	};
	const exitCode = await runTuiApp(Deno.stdin.readable, app, Deno.stdout.writable.getWriter());
	Deno.exit(exitCode);
}
