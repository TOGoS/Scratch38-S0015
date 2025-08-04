import Vec2D from '../../lib/ts/termdraw/Vec2D.ts';
import DrawCommand from "../../lib/ts/termdraw/DrawCommand.ts";

import KeyEvent from '../../lib/ts/terminput/KeyEvent.ts';
import TextRaster2, { Style } from '../../lib/ts/termdraw/TextRaster2.ts';
import TUIRenderStateManager from '../../lib/ts/termdraw/TUIRenderStateManager.ts';
import { inputEvents } from '../../lib/ts/terminput/inputeventparser.ts';
import { blitToRaster, createUniformRaster, drawTextToRaster, textRaster2ToDrawCommands, textRaster2ToLines } from '../../lib/ts/termdraw/textraster2utils.ts';
import { RED_TEXT, RED_BACKGROUND, RESET_FORMATTING, toAnsi } from '../../lib/ts/termdraw/ansi.ts';
import { iterateAndReturn, mergeAsyncIterables } from '../../lib/ts/_util/asynciterableutil.ts';
import { Signal } from 'https://deno.land/x/tui@2.1.11/mod.ts';
import { reset } from 'https://deno.land/std@0.165.0/fmt/colors.ts';

//// Some types that could be librarified if this all works

type PossiblyTUIAppSpawner<Context,Instance,InputEvent> = {
	// Framework will push key events to the app 'asynchronously'
	inputMode: "push-key-events",
	spawn(context: Context) : Instance & {handleInput(input:InputEvent) : void};
} | {
	inputMode: "none",
	spawn(context: Context) : Instance;
};

// ProcessLike, but more abstract
interface Waitable<R> {
	wait() : Promise<R>;
}

interface TUIAppInstance<I,R> extends Waitable<R> {
	handleInput(input:I) : void;
}

interface PossiblyTUIAppContext {
	// Hmm: Directly using Readable/WritableStreams might not be the most useful thing;
	// will try and find out later.
	stdin?   : ReadableStream<Uint8Array>;
	//stdout : WritableStream<Uint8Array>;
	//stderr : WritableStream<Uint8Array>;
	writeOut(text:string) : Promise<void>;
	setScene(scene:Rasterable) : void;
}

interface Rasterable {
	toRaster(minSize:Vec2D<number>, maxSize:Vec2D<number>) : TextRaster2;
}

type AppInputEvent = KeyEvent


class AbstractWaitable<Result> implements Waitable<Result> {
	protected _resolve : (r:Result) => void = (res) => { throw new Error(`_resolve not yet initialized!`); };
	protected _reject : (e:any) => void = (res) => { throw new Error(`_reject not yet initialized!`); };
	protected _exited : boolean = false;
	#exited : Promise<Result>;
	
	constructor() {
		this.#exited = new Promise<Result>((resolve,reject) => {
			this._reject = (e) => {
				if( this._exited ) {
					// Ignore it; only the first call counts.
					return;
				}
				this._exited = true;
				reject(e);
			}
			this._resolve = (result) => {
				if( this._exited ) {
					// Ignore it; only the first call counts.
					return;
				}
				this._exited = true;
				resolve(result);
			};
		});
	}
		
	wait(): Promise<Result> {
		return this.#exited;
	}
}

function sleep(ms:number) {
	return new Promise((resolve,_reject) => {
		setTimeout(resolve, ms);
	});
}

async function runTuiApp<Result>(
	spawner: PossiblyTUIAppSpawner<PossiblyTUIAppContext, Waitable<Result>, KeyEvent>,
	ctx:{
		stdin  : typeof Deno.stdin,
		stdout : WritableStreamDefaultWriter
	},
	opts: {
		outputMode: "screen"|"lines"
	}
) : Promise<Result> {
	const textEncoder = new TextEncoder();
	
	function getScreenSize() : Vec2D<number> {
		const cs = Deno.consoleSize();
		return { x: cs.columns, y: cs.rows };
	}
	
	const outMan : {
		enter() : Promise<void>;
		exit() : Promise<void>;
		writeOut(text:string) : Promise<void>;
		setScene(scene:Rasterable) : void;
	} = opts.outputMode == "lines" ? (() => {
		let outProm = Promise.resolve();
		
		return {
			enter() { return outProm; },
			exit() { return outProm; },
			writeOut(text:string) {
				return outProm.then(() => ctx.stdout.write(textEncoder.encode(text)));
			},
			setScene(scene:Rasterable) {
				const outCommands = textRaster2ToLines(scene.toRaster({x:0,y:0}, getScreenSize()));
				for( const command of outCommands ) {
					outProm = outProm.then(() => ctx.stdout.write(textEncoder.encode(toAnsi(command))));
				}
				// outProm = outProm.then(() => ctx.stdout.write(textEncoder.encode(RESET_FORMATTING)));
			}
		}
	})() : (() => {
		let currentScene : Rasterable = {
			toRaster(size:Vec2D<number>) : TextRaster2 {
				return createUniformRaster(size, " ", RESET_FORMATTING);
			}
		}
		let outProm = Promise.resolve();
		let inTui = false; // At whatever point in time outProm represents
		
		const renderStateMan = new TUIRenderStateManager(ctx.stdout, async (out) => {
			await outProm;
			const screenSize = getScreenSize();
			const raster = currentScene.toRaster(screenSize, screenSize);
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
			setScene(scene:Rasterable) {
				currentScene = scene;
				setMode(true);
				renderStateMan.requestRedraw();
			}
		};
	})();

	let rawModeSet = false;
	try {
		await outMan.enter();
		if( spawner.inputMode == "push-key-events" ) {
			ctx.stdin.setRaw(true);
			rawModeSet = true;
		}
		
		const appInstance = spawner.spawn({
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
		if( rawModeSet ) {
			ctx.stdin.setRaw(false);
			rawModeSet = false;
		}
		await outMan.exit();
	}
}

//// Apps!

abstract class AbstractAppInstance<Input,Result> extends AbstractWaitable<Result> implements TUIAppInstance<Input,Result> {
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

function clamp(val:number, min:number, max:number) : number {
	return val < min ? min : val > max ? max : val;
}

function clampSize(val:Vec2D<number>, min:Vec2D<number>, max:Vec2D<number>) : Vec2D<number> {
	return {
		x: clamp(val.x, min.x, max.x),
		y: clamp(val.y, min.y, max.y),
	};
}

class DemoAppInstance extends AbstractAppInstance<KeyEvent,number> {
	_requestCleanExit() {
		// could be overridden to say goodbye first or use a signal or something idk
		this._resolve(0);
	}
	_abort(reason:any) {
		this._reject(reason);
	}
	
	override handleInput(input:KeyEvent) {
		if( input.key == "q" ) {
			this._requestCleanExit();
		}
		if(input.key == "c" && input.ctrlKey) {
			this._abort(new Error("Aborted by user"));
		}
	}
}

class EchoAppInstance extends DemoAppInstance {
	#textLines : string[];
	constructor(textLines:string[], ctx:PossiblyTUIAppContext) {
		super(ctx)
		this.#textLines = textLines;
		this._handleRunResult(this._run());
	}
	
	protected async _run() : Promise<number> {
		await this._ctx.writeOut("Hello.  I will echo some stuff shortly.\n");
		await sleep(500);
		this._ctx.setScene({
			toRaster: (minSize, maxSize) => {
				// TODO: Make a component framework or something lol
				const idealSize = {
					x: this.#textLines.map(l => l.length).reduce((a,b) => Math.max(a,b), 0) + 4,
					y: this.#textLines.length + 2,
				}
				let rast = createUniformRaster(clampSize(idealSize, minSize, maxSize), " ", RED_BACKGROUND);
				for( let i=0; i<this.#textLines.length; ++i ) {
					rast = drawTextToRaster(rast, {x:2, y:i+1}, this.#textLines[i], RED_BACKGROUND);
				}
				return rast;
			}
		});
		await sleep(1000);
		await this._ctx.writeOut("Now we're back to regular output.\n");
		return 0;
	}
}

class ClockAppInstance extends DemoAppInstance {
	_inputKeyMessage : string;
	
	constructor(ctx:PossiblyTUIAppContext) {
		super(ctx);
		this._inputKeyMessage = "";
		this._handleRunResult(this._run());
	}
	
	override handleInput(input: KeyEvent): void {
		this._inputKeyMessage = "Key pressed: " + JSON.stringify(input);
		super.handleInput(input);
		this._redraw();
	}
	
	_redraw() : void {
		const now = new Date();
		const textLines : string[] = [
			now.toString(),
			this._inputKeyMessage,
		];
		this._ctx.setScene({
			toRaster: (minSize, maxSize) => {
				const idealSize = {
					x: textLines.map(l => l.length).reduce((a,b) => Math.max(a,b), 0) + 4,
					y: textLines.length + 2,
				}
				let rast = createUniformRaster(clampSize(idealSize, minSize, maxSize), " ", RED_BACKGROUND);
				for( let i=0; i<textLines.length; ++i ) {
					rast = drawTextToRaster(rast, {x:1, y:i+1}, textLines[i], RED_BACKGROUND);
				}
				return rast;
			}
		});
	}
	
	async _run() : Promise<number> {
		let i = 0;
		while(i < 10 && !this._exited) {
			// Hmm: Could use an abort signal or something.
			this._redraw();
			await sleep(1000);
			++i;
		}
		return 0;
	}
}


//// Over-engineered process spawning stuff

const HELP_TEXT_LINES = [
	"Usage: tuidemo3 [--capture-input] [--output-mode={screen|lines}] <appname>",
	"",
	"A few simple apps to demonstrate a TUI app framework",
	"",
	"Options:",
	"  --capture-input ; Use 'raw mode'; application will parse key events",
	"  --output-mode=<mode>> ; Request the app operate with the given output mode",
	"                        ; (some apps will ignore this)",
	"",
	"Output modes (maybe badly named):",
	"  screen ; 'fullscreen'; app to use terminal as 2D canvas",
	"  lines  ; Output one line at a time, like a teletype",
	"",
	"Apps:",
	"  help   ; print this help text and exit",
	"  hello  ; Print some text, sleep a while, exit",
	"  clock  ; Show a clock, updated every second",
];

interface TopArgs {
	appName : string;
	appArgs : string[];
}

function parseTopArgs(args:string[]) : TopArgs {
	let appArgs : string[] = [];
	let appName : string = "no-app-specified";
	for( let i=0; i<args.length; ++i ) {
		if( args[i] == '--help' ) {
			appName = 'help';
		} else if( args[i].startsWith("-") ) {
			appArgs.push(args[i]);
		} else {
			appName = args[i];
			appArgs = appArgs.concat(args.slice(i+1));
		}
	}
	return { appName, appArgs };
}

interface ProcLikeSpawnContext {
	stdin  : typeof Deno.stdin;
	stdout : typeof Deno.stdout;
	stderr : typeof Deno.stderr;
}

interface Spawner<C,R> {
	spawn(ctx:C) : R;
}

function tuiAppToProcLike<R>(
	app:PossiblyTUIAppSpawner<PossiblyTUIAppContext, Waitable<R>, KeyEvent>,
	outputMode : "screen"|"lines"
) : Spawner<ProcLikeSpawnContext, Waitable<R>> {
	return {
		spawn(ctx:ProcLikeSpawnContext) : Waitable<R> {
			const exitCodePromise = runTuiApp(app, {
				stdin: ctx.stdin,
				stdout: ctx.stdout.writable.getWriter()
			}, {
				outputMode
			});
			return {
				wait() { return exitCodePromise }
			};
		}
	}
}

function echoAndExitApp(toStdout:string[], toStderr:string[], exitCode:number) : Spawner<ProcLikeSpawnContext,Waitable<number>> {
	const textEncoder = new TextEncoder();
	return {
		spawn(ctx:ProcLikeSpawnContext) : Waitable<number> {
			async function run() : Promise<number> {
				if( toStdout.length > 0 ) {
					const writer = ctx.stdout.writable.getWriter();
					for( const line of toStdout ) {
						await writer.write(textEncoder.encode(line+"\n"));
					}
				}
				if( toStderr.length > 0 ) {
					const writer = ctx.stderr.writable.getWriter();
					for( const line of toStderr ) {
						await writer.write(textEncoder.encode(line+"\n"));
					}
				}
				return exitCode;
			}
			const prom = run();
			return { wait: () => prom }
		}
	}
}

function parseMain(args:string[]) : Spawner<ProcLikeSpawnContext,Waitable<number>> {
	const topArgs = parseTopArgs(args);
	
	let outputMode : "screen"|"lines" = "screen";
	let requestedInputMode : "none"|"push-key-events" = "none";
	for( const arg of topArgs.appArgs ) {
		let m : RegExpExecArray|null;
		if( arg == '--capture-input' ) {
			requestedInputMode = "push-key-events";
		} else if( (m = /^--output-mode=(screen|lines)$/.exec(arg)) != null ) {
			outputMode = m[1] as "screen"|"lines";
		} else {
			throw new Error(`Unrecognized argument: '${arg}'`);
		}
	}

	if( topArgs.appName == "help" ) {
		return echoAndExitApp([], HELP_TEXT_LINES, 0);
	} else if( topArgs.appName == "clock" ) {
		return tuiAppToProcLike({
			inputMode: requestedInputMode,
			spawn: (ctx:PossiblyTUIAppContext)  => new ClockAppInstance(ctx),
		}, outputMode);
	} else if( topArgs.appName == "hello" ) {
		return tuiAppToProcLike({
			inputMode: requestedInputMode,
			spawn: (ctx:PossiblyTUIAppContext) => new EchoAppInstance([
				"Hello, world!",
				"How's it going?"
			], ctx),
		}, outputMode);
	} else if( topArgs.appName == "no-app-specified" ) {
		return echoAndExitApp([], ["No app specified; try 'help'"], 1);
	} else {
		return echoAndExitApp([], [`Unrecognized command '${topArgs.appName}'`], 1);
	}
}

// TODO: Demo an app that reads from stdin
//   - Does C-c still work to kill it, if input was piped?
// TODO: Demo an app that handles input events

if( import.meta.main ) {
	Deno.exit(await parseMain(Deno.args).spawn(Deno).wait())
}
