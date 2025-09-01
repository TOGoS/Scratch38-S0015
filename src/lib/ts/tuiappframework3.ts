import Vec2D from '../../lib/ts/termdraw/Vec2D.ts';

import * as ansi from '../../lib/ts/termdraw/ansi.ts';
import { toAnsi } from '../../lib/ts/termdraw/ansi.ts';
import TextRaster2 from '../../lib/ts/termdraw/TextRaster2.ts';
import { createUniformRaster, textRaster2ToDrawCommands, textRaster2ToLines } from '../../lib/ts/termdraw/textraster2utils.ts';
import TUIRenderStateManager from '../../lib/ts/termdraw/TUIRenderStateManager.ts';
import { inputEvents } from '../../lib/ts/terminput/inputeventparser.ts';
import KeyEvent from '../../lib/ts/terminput/KeyEvent.ts';
import { AbstractRasterable, PackedRasterable, SizedRasterable } from './termdraw/components2.ts';
import { centeredExpandedBounds } from './termdraw/boundsutils.ts';
import WatchableVariable from './WatchableVariable.ts';

//// Some types that could be librarified if this all works

export interface InputHandler<InputEvent> {
	handleInput(input:InputEvent) : void;
}

/** Some running process that can be waited on to complete with a result */
export interface Waitable<R> {
	wait() : Promise<R>;
}

/** Conext that can be used to instantiate both TUI and not-quite-TUI apps */
export interface PossiblyTUIAppContext {
	// Hmm: Directly using Readable/WritableStreams might not be the most useful thing;
	// will try and find out later.
	stdin?   : ReadableStream<Uint8Array>;
	//stdout : WritableStream<Uint8Array>;
	//stderr : WritableStream<Uint8Array>;
	writeOut(text:string) : Promise<void>;
	/** Specify what should be drawn on the screen. */
	setScene(scene:SizedRasterable) : void;
}

export class AbstractWaitable<Result> implements Waitable<Result> {
	protected _resolve : (r:Result) => void = (res) => { throw new Error(`_resolve not yet initialized!`); };
	protected _reject : (e:any) => void = (res) => { throw new Error(`_reject not yet initialized!`); };
	protected _exited : boolean = false;
	#exited : Promise<Result>;
	
	/** Close any opened resources, etc */
	_cleanup() : Promise<void> {
		return Promise.resolve();
	}
	
	constructor() {
		this.#exited = new Promise<Result>((resolve,reject) => {
			this._reject = (e) => {
				if( this._exited ) {
					// Ignore it; only the first call counts.
					return;
				}
				this._exited = true;
				this._cleanup().finally(() => reject(e));
			}
			this._resolve = (result) => {
				if( this._exited ) {
					// Ignore it; only the first call counts.
					return;
				}
				this._exited = true;
				this._cleanup().finally(() => resolve(result));
			};
		});
	}
	
	wait(): Promise<Result> {
		return this.#exited;
	}
}

export type PossiblyTUIAppSpawner<Context,Instance,InputEvent> = {
	// Framework will push key events to the app 'asynchronously'
	inputMode: "push-key-events",
	spawn(context: Context) : Instance & InputHandler<InputEvent>;
/* Hmm, maybe something like:
} | {
	inputMode: "readable",
	spawn(context: Context & { stdin: ReadableStream<Uint8Array>; }) : Instance;
*/
} | {
	inputMode: "none",
	spawn(context: Context) : Instance;
};

export interface TUIAppRunOpts {
	outputMode: "screen"|"lines",
	// TODO: This should be part of ctx, not opts!
	screenSizeVar : WatchableVariable<Vec2D<number>>,
}

export interface DenoStdinLike {
	setRaw(raw:boolean) : void;
	readable : ReadableStream<Uint8Array>;
}

export async function runTuiApp<Result>(
	spawner: PossiblyTUIAppSpawner<PossiblyTUIAppContext, Waitable<Result>, KeyEvent>,
	ctx:{
		stdin  : DenoStdinLike,
		stdout : WritableStreamDefaultWriter
	},
	opts: TUIAppRunOpts
) : Promise<Result> {
	const textEncoder = new TextEncoder();
	
	// Output manager provides a common interface to manage terminal output,
	// whether in screen or lines mode.
	const outMan : {
		enter() : Promise<void>;
		exit() : Promise<void>;
		writeOut(text:string) : Promise<void>;
		setScreenSize(screenSize:Vec2D<number>) : void;
		setScene(scene:SizedRasterable) : void;
	} = opts.outputMode == "lines" ? (() => {
		let outProm = Promise.resolve();
		let screenSize : Vec2D<number> = {x: 20, y: 10};
		
		return {
			enter() { return outProm; },
			exit() { return outProm; },
			writeOut(text:string) {
				return outProm.then(() => ctx.stdout.write(textEncoder.encode(text)));
			},
			setScreenSize(newScreenSize:Vec2D<number>) {
				screenSize = newScreenSize;
			},
			setScene(scene:SizedRasterable) {
				const outCommands = textRaster2ToLines(scene.rasterForSize(screenSize));
				for( const command of outCommands ) {
					outProm = outProm.then(() => ctx.stdout.write(textEncoder.encode(toAnsi(command))));
				}
				// outProm = outProm.then(() => ctx.stdout.write(textEncoder.encode(RESET_FORMATTING)));
			}
		}
	})() : (() => {
		let currentScene : SizedRasterable = {
			rasterForSize(size:Vec2D<number>) : TextRaster2 {
				return createUniformRaster(size, " ", ansi.DEFAULT_STYLE);
			}
		}
		let screenSize : Vec2D<number> = {x: 20, y: 10};
		let outProm = Promise.resolve();
		let inTui = false; // At whatever point in time outProm represents
		
		const renderStateMan = new TUIRenderStateManager(ctx.stdout, async (out) => {
			await outProm;
			const raster = currentScene.rasterForSize(screenSize);
			const outCommands = textRaster2ToDrawCommands(raster);
			for( const command of outCommands ) {
				await out.write(textEncoder.encode(toAnsi(command)));
			}
			// await ctx.stdout.write(textEncoder.encode(RESET_FORMATTING));
		});
		
		function setMode(newInTui:boolean) : Promise<void> {
			outProm =
				newInTui == inTui ? outProm :
				newInTui ? outProm.then(() => renderStateMan.enterTui()) :
							  outProm.then(() => renderStateMan.exitTui());
			inTui = newInTui;
			return outProm;
		}
		
		return {
			enter: () => outProm,
			exit : () => setMode(false),
			async writeOut(text:string) {
				await setMode(false);
				await ctx.stdout.write(textEncoder.encode(text));
			},
			setScreenSize(newScreenSize:Vec2D<number>) {
				if( newScreenSize.x == screenSize.x && newScreenSize.y == screenSize.y ) return;
				
				screenSize = newScreenSize;
				if( inTui ) renderStateMan.requestRedraw();
			},
			setScene(scene:SizedRasterable) {
				currentScene = scene;
				setMode(true);
				renderStateMan.requestRedraw();
			}
		};
	})();

	let rawModeSet = false;
	let outManActive = false;
	
	const screenSizeChangeListener = function(this:WatchableVariable<Vec2D<number>>) {
		outMan.setScreenSize(this.value);
	};
	
	async function cleanup() {
		if( rawModeSet ) {
			ctx.stdin.setRaw(false);
			rawModeSet = false;
		}
		if( outManActive ) {
			await outMan.exit();
			outManActive = false;
		}
		opts.screenSizeVar.removeEventListener("change", screenSizeChangeListener);
	}
	
	// Finally block is not run when the Deno process is killed with Ctrl+c
	// (i.e. not in 'raw input' mode, in which case the program handles it).
	// But this signal handler does seem to be run.
	// 
	// I have not figured out how to clean up
	// when Ctrl+C is pressed while the process
	// is reading from stdin.
	// TODO: Put a function on ctx to avoid being tied to Deno
	Deno.addSignalListener("SIGINT", cleanup);
	
	try {
		await outMan.enter();
		outManActive = true;
		
		let stdin : ReadableStream<Uint8Array>|undefined;
		if( spawner.inputMode == "push-key-events" ) {
			ctx.stdin.setRaw(true);
			rawModeSet = true;
			stdin = undefined;
		} else {
			stdin = ctx.stdin.readable;
		}
		
		opts.screenSizeVar.addEventListener("change", screenSizeChangeListener, {immediate:true});
		
		const appInstance = spawner.spawn({
			stdin   : stdin,
			writeOut: outMan.writeOut,
			setScene: outMan.setScene,
		});
		
		// App is started!
		
		if( spawner.inputMode == "push-key-events" ) {
			const reader = async () => {
				const inputHandler = appInstance as unknown as {handleInput(evt:KeyEvent):void};
				for await( const inputEvent of inputEvents(ctx.stdin.readable) ) {
					inputHandler.handleInput(inputEvent);
				}
			};
			reader(); // TODO: Cancel somehow when app exits
		}
		
		const exitCode = await appInstance.wait();
		return exitCode;
	} finally {
		await cleanup();
	}
}

export abstract class AbstractAppInstance<Input,Result> extends AbstractWaitable<Result> implements Waitable<Result>, InputHandler<Input> {
	protected _ctx : PossiblyTUIAppContext;
	
	constructor(ctx:PossiblyTUIAppContext) {
		super();
		this._ctx = ctx;
	}
	
	_handleRunResult(prom:Promise<Result>) {
		prom.then(this._resolve, this._reject);
	}
	
	handleInput(_rejectinput: Input): void {}
}
