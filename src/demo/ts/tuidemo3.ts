import Vec2D from '../../lib/ts/termdraw/Vec2D.ts';
import DrawCommand from "../../lib/ts/termdraw/DrawCommand.ts";

import KeyEvent from '../../lib/ts/terminput/KeyEvent.ts';
import TextRaster2 from '../../lib/ts/termdraw/TextRaster2.ts';
import TUIRenderStateManager from '../../lib/ts/termdraw/TUIRenderStateManager.ts';
import { inputEvents } from '../../lib/ts/terminput/inputeventparser.ts';
import { blitToRaster, createUniformRaster, drawTextToRaster, textRaster2ToDrawCommands } from '../../lib/ts/termdraw/textraster2utils.ts';
import { RED_TEXT, RESET_FORMATTING, toAnsi } from '../../lib/ts/termdraw/ansi.ts';
import { iterateAndReturn, mergeAsyncIterables } from '../../lib/ts/_util/asynciterableutil.ts';
import { Signal } from 'https://deno.land/x/tui@2.1.11/mod.ts';
import { reset } from 'https://deno.land/std@0.165.0/fmt/colors.ts';

//// Some types that could be librarified if this all works

interface Spawner<Context,Instance> {
	spawn(context:Context) : Instance;
}

// ProcessLike, but more abstract
interface Waitable<R> {
	wait() : Promise<R>;
}

interface TUIAppInstance<I,R> extends Waitable<R> {
	handleInput(input:I) : void;
}

interface Rasterable {
	toRaster(screenSize:Vec2D<number>) : TextRaster2;
}

type AppInputEvent = KeyEvent


class AbstractWaitable<Result> implements Waitable<Result> {
	protected _exit : (r:Result) => void = (res) => { throw new Error(`#exit not yet initialized!`); };
	#exited : Promise<Result>;
	
	constructor() {
		this.#exited = new Promise<Result>((resolve,reject) => {
			this._exit = resolve;
		});
	}
		
	wait(): Promise<Result> {
		return this.#exited;
	}
}

abstract class AbstractAppInstance<Input,Result> extends AbstractWaitable<Result> implements TUIAppInstance<Input,Result> {
	protected _outputHandler : (scene:Rasterable) => void;
	
	constructor(outputHandler:(scene:Rasterable)=>void) {
		super();
		this._outputHandler = outputHandler;
	}
	
	handleInput(_input: Input): void { }
}

//// Scene stuff?


////

class EchoAppInstance extends AbstractAppInstance<any,number> {
	#text : string;
	constructor(text:string, outputHandler:(scene:Rasterable)=>void) {
		super(outputHandler)
		this.#text = text;
		this.run();
	}
	
	protected run() {
		this._outputHandler({
			toRaster: (screenSize) => {
				let rast = createUniformRaster(screenSize, " ", RESET_FORMATTING);
				rast = drawTextToRaster(rast, {x:1, y:1}, this.#text, RESET_FORMATTING);
				rast = drawTextToRaster(rast, {x:1, y:2}, this.#text + " (again)", RESET_FORMATTING);
				return rast;
			}
		});
		setTimeout(() => this._exit(0), 1000);
	}
}

async function runTuiApp<Result>(spawner:Spawner<(r:Rasterable)=>void, TUIAppInstance<KeyEvent,Result>>, output:WritableStreamDefaultWriter) : Promise<Result> {
	const textEncoder = new TextEncoder();
	
	function getScreenSize() : Vec2D<number> {
		const cs = Deno.consoleSize();
		return { x: cs.columns, y: cs.rows };
	}
	
	let currentScene : Rasterable = {
		toRaster(size:Vec2D<number>) : TextRaster2 {
			return createUniformRaster(size, " ", RESET_FORMATTING);
		}
	}
	const renderStateMan = new TUIRenderStateManager(output, async (out) => {
		const raster = currentScene.toRaster(getScreenSize());
		for( const command of textRaster2ToDrawCommands(raster) ) {
			await out.write(textEncoder.encode(toAnsi(command)));
		}
	});
	
	try {
		await renderStateMan.enterTui();
		Deno.stdin.setRaw(true);
		
		const appInstance = spawner.spawn((scene) => {
			currentScene = scene;
			renderStateMan.requestRedraw();
		});
		
		// App is started!
		
		// TODO: Parse input, pass it to the app!
		
		const exitCode = await appInstance.wait();
		return exitCode;
	} finally {
		Deno.stdin.setRaw(false);
		await renderStateMan.exitTui();
	}
}

if( import.meta.main ) {
	const exitCode = await runTuiApp({
		spawn(rasterSink) {
			return new EchoAppInstance("Hello, world!", rasterSink);
		}
	}, Deno.stdout.writable.getWriter());
	Deno.exit(exitCode);
}
