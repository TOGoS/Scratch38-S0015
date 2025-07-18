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

type AppInputEvent = KeyEvent // TODO: Or a line of text (if not yet in TUI mode), or a screen size change
type AppOutputEvent = {
	type: "print",
	text: string
} | {
	type: "enter-tui-mode",
} | {
	type: "exit-tui-mode",
} | {
	type: "set-screen-raster",
	raster: TextRaster2
};

type TUIApp<R> = (events:AsyncIterable<AppInputEvent>) => AsyncIterable<AppOutputEvent,R>;

async function iterateAndReturn<I,R>(iterable:AsyncIterable<I,R>, itemCallback: (item:I) => unknown) : Promise<R> {
	const iterator = iterable[Symbol.asyncIterator]();
	let entry = await iterator.next();
	while( !entry.done ) {
		await itemCallback(entry.value);
		entry = await iterator.next();
	}
	return entry.value;
}

async function runTuiApp<R>(stdin:AsyncIterable<Uint8Array>, app:TUIApp<R>, stdout:WritableStreamDefaultWriter) : Promise<R> {
	const textEncoder = new TextEncoder();
	let raster : TextRaster2|undefined;
	const tuiRenderStateMan = new TUIRenderStateManager(stdout, writer => {
		// TUIRenderStateManager 
		writer.write(textEncoder.encode(toAnsi({classRef:'x:ClearScreen'})));
		if( raster != undefined ) for( const dc of textRaster2ToDrawCommands(raster, [{x0:0, y0:0, x1:raster.width, y1:raster.height}], {x:0, y:0}) ) {
			writer.write(textEncoder.encode(toAnsi(dc)));
		}
		return Promise.resolve();
	});
	const outputEvents = app(inputEvents(stdin));
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
		case 'set-screen-raster':
			raster = outputEvent.raster;
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
	const app : TUIApp<number> = async function*(inputEvents) {
		yield {
			type: "print",
			text: "Hi there!  Type 'x' or 'q' to quit.\n"
		};
		for await( const inputEvent of inputEvents ) {
			if( inputEvent.key == "x" && inputEvent.ctrlKey == false && inputEvent.metaKey == false ) {
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
					type: 'set-screen-raster',
					raster: {
						chars: [["a","b","c"]],
						styles: [["","",""]],
						height: 1,
						width: 3
					}
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
