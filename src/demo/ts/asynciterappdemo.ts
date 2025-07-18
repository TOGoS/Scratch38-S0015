// Model a TUI app as (events:AsyncIterable<InputEvent>) => AsyncIterable<OutputEvent,R>
// which may or may not turn out to be useful.

import Vec2D from '../../lib/ts/termdraw/Vec2D.ts';
import DrawCommand from "../../lib/ts/termdraw/DrawCommand.ts";

import KeyEvent from '../../lib/ts/terminput/KeyEvent.ts';
import TextRaster2 from '../../lib/ts/termdraw/TextRaster2.ts';
import TUIRenderStateManager from '../../lib/ts/termdraw/TUIRenderStateManager.ts';
import { inputEvents } from '../../lib/ts/terminput/inputeventparser.ts';
import { textRaster2ToDrawCommands } from '../../lib/ts/termdraw/textraster2utils.ts';
import { toAnsi } from '../../lib/ts/termdraw/ansi.ts';
import { iterateAndReturn, mergeAsyncIterables } from '../../lib/ts/_util/asynciterableutil.ts';

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

async function* generateAsyncIterator<T>(generator:() => T, delayMs : number, abortSignal:AbortSignal) : AsyncIterable<T> {
	while( !abortSignal.aborted ) {
		yield generator();
		await sleepMs(delayMs, abortSignal);
	}
}

function screenResizeEvents(abortSignal:AbortSignal) : AsyncIterable<ScreenResizeEvent> {
	// TODO: Don't send event when size hasn't changed
	// TODO: Try to update whenever Deno.addSignalListener("SIGWINCH", () => ...));
	// I think I need a generic way to create AsyncIterables that I can 'push' stuff into.
	// I guess streams do that.
	return generateAsyncIterator(() => {
		const size = Deno.consoleSize();
		return {
			type: 'terminalresize',
			width: size.columns,
			height: size.rows,
		}
	}, 5000, abortSignal);
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
	const allInputEvents : AsyncIterable<AppInputEvent> = mergeAsyncIterables<AppInputEvent>([inputEvents(stdin), screenResizeEvents(abortController.signal)]);
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
		
		let data : string[] = ["abc","123"];
		function generateRaster() {
			// TODO: Draw app state (`data` and screen size, for now) into raster
			return {
				chars: [["a","b","c"]],
				styles: [["","",""]],
				height: 1,
				width: 3
			};
		}
		
		for await( const inputEvent of inputEvents ) {
			if( inputEvent.type == "terminalresize" ) {
				yield {
					type: "print",
					text: `Ooh, a screen resize event: ${JSON.stringify(inputEvent)}\n`
				}
				yield {
					type: 'set-screen-raster-generator',
					rasterGenerator: generateRaster
				};
			} else if( inputEvent.key == "x" && inputEvent.ctrlKey == false && inputEvent.metaKey == false ) {
				yield {
					type: "print",
					text: "Exiting with status 1!\n"
				}
				return 1;
			} else if( inputEvent.key == "q" && inputEvent.ctrlKey == false && inputEvent.metaKey == false ) {
				yield {
					type: "print",
					text: "Exiting with status 0!\n"
				}
				return 0;
			} else if( inputEvent.key == "t" ) {
				yield { type: "enter-tui-mode" };
				yield {
					type: 'set-screen-raster-generator',
					rasterGenerator: generateRaster
				};
			} else {
				yield {
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
