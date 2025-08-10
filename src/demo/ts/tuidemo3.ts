import Vec2D from '../../lib/ts/termdraw/Vec2D.ts';

import KeyEvent from '../../lib/ts/terminput/KeyEvent.ts';
import { Style } from '../../lib/ts/termdraw/TextRaster2.ts';
import { createUniformRaster, drawTextToRaster } from '../../lib/ts/termdraw/textraster2utils.ts';
import * as ansi from '../../lib/ts/termdraw/ansi.ts';
import { AbstractAppInstance, PossiblyTUIAppContext, PossiblyTUIAppSpawner, runTuiApp, Waitable } from '../../lib/ts/tuiappframework3.ts';

//// Misc helper functions

function sleep(ms:number) {
	return new Promise((resolve,_reject) => {
		setTimeout(resolve, ms);
	});
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
	_requestCleanExit(result:number) {
		// could be overridden to say goodbye first or use a signal or something idk
		this._resolve(result);
	}
	// deno-lint-ignore no-explicit-any
	_abort(reason:any) {
		this._reject(reason);
	}
	
	override handleInput(input:KeyEvent) {
		if( input.key == "q" ) {
			this._requestCleanExit(0);
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
				let rast = createUniformRaster(clampSize(idealSize, minSize, maxSize), " ", ansi.RED_BACKGROUND);
				for( let i=0; i<this.#textLines.length; ++i ) {
					rast = drawTextToRaster(rast, {x:2, y:i+1}, this.#textLines[i], ansi.RED_BACKGROUND);
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
				let rast = createUniformRaster(clampSize(idealSize, minSize, maxSize), " ", ansi.RED_BACKGROUND);
				for( let i=0; i<textLines.length; ++i ) {
					rast = drawTextToRaster(rast, {x:1, y:i+1}, textLines[i], ansi.RED_BACKGROUND);
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

/**
 * App that demonstrates reading from stdin
 * 
 * TODO: Use TBD component system to lay out/render
 */

interface WCAppState {
	currentInputName : string|undefined;
	byteCount : number;
	lineCount : number;
	status : "unstarted"|"reading"|"done";
}

class WCAppInstance extends DemoAppInstance {
	#stdin : ReadableStream<Uint8Array>|undefined;
	#inputNames : string[];
	constructor(ctx:PossiblyTUIAppContext, inputNames:string[]) {
		super(ctx);
		this.#stdin = ctx.stdin;
		this.#inputNames = inputNames;
		this._handleRunResult(this._run());
	}
	
	override _cleanup() : Promise<void> {
		if( typeof this._refreshTimer == 'number' ) {
			clearInterval(this._refreshTimer);
			this._refreshTimer = undefined;
		}
		// this.#reader.cancel("WCAppInstance#_cleanup()");
		return Promise.resolve();
	}
	
	_appState : WCAppState = {
		status: "unstarted",
		currentInputName: undefined,
		byteCount: 0,
		lineCount: 0,
	};
	
	_refreshTimer : number|undefined;
	
	_updateView() {
		this._ctx.setScene({
			toRaster: (minSize, maxSize) => {
				const now = new Date();
				
				const currentInputLine : [string,Style] =
					this._appState.status == "done" ? ['Reached end of input!', ansi.BRIGHT_GREEN_TEXT] :
					this._appState.status == "unstarted" ? ['', ansi.YELLOW_TEXT] :
					[`Reading ${this._appState.currentInputName}`, ansi.YELLOW_TEXT];
				
				const textLines : [string,Style][] = [
					[now.toString()                    ,ansi.UNDERLINED + ansi.BRIGHT_WHITE_TEXT + ansi.RED_BACKGROUND], // For demonstration's sake
					currentInputLine,
					[`Read ${this._appState.byteCount} bytes`   ,ansi.FAINT + ansi.BLUE_TEXT  ],
					[`Read ${this._appState.lineCount} lines`   ,ansi.BOLD  + ansi.BLUE_TEXT  ],
				];
				const idealSize = {
					x: textLines.map(l => l.length).reduce((a,b) => Math.max(a,b), 0) + 4,
					y: textLines.length + 2,
				}
				let rast = createUniformRaster(clampSize(idealSize, minSize, maxSize), " ", ansi.RED_BACKGROUND);
				for( let i=0; i<textLines.length; ++i ) {
					rast = drawTextToRaster(rast, {x:1, y:i+1}, textLines[i][0], textLines[i][1]);
				}
				return rast;
			}
		});
	}
	
	_patchState(patch : Partial<WCAppState>) {
		this._appState = {
			...this._appState,
			...patch
		};
		this._updateView();
	}
	
	async _run() : Promise<number> {
		this._refreshTimer = setInterval(this._updateView.bind(this), 1000);
		this._updateView();
		
		for( const inputName of this.#inputNames ) {
			const readable : ReadableStream<Uint8Array>|undefined = await (inputName == '-' ? Promise.resolve(this.#stdin) : (Deno.open(inputName, {read:true})).then(f => f.readable));
			if( readable == undefined ) {
				this._ctx.writeOut(`Failed to open '${inputName}'`);
				return 1;
			}
			this._patchState({
				status: "reading",
				currentInputName: inputName,
			});
			await sleep(500);
			try {
				for await( const chunk of readable ) {
					const byteCount = this._appState.byteCount + chunk.length;
					let lineCount = this._appState.lineCount;
					for( const byte of chunk ) {
						if( byte == 0x0A ) ++lineCount;
					}
					this._patchState({
						lineCount,
						byteCount
					});
					await sleep(500);
				}
			} finally {
				readable.cancel();
			}
		}
		await sleep(1000);
		this._patchState({
			currentInputName: undefined,
			status: "done"
		})
		await sleep(1000);
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
	"                  ; (use 'q' to quit)",
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
	"  wc     ; Read from stdin, print counts of bytes/lines read",
];

interface TopArgs {
	appName : string;
	outputMode? : "screen"|"lines";
	inputMode? : "none"|"push-key-events";
	appArgs : string[];
}

function parseTopArgs(args:string[]) : TopArgs {
	let appArgs : string[] = [];
	let appName : string = "no-app-specified";
	let outputMode : undefined|"screen"|"lines"         = undefined;
	let inputMode  : undefined|"none"|"push-key-events" = undefined;
	let m : RegExpExecArray|null;
	for( let i=0; i<args.length; ++i ) {
		if( args[i] == '--help' ) {
			appName = 'help';
		} else if( args[i] == '--capture-input' ) {
			inputMode = "push-key-events";
		} else if( (m = /^--output-mode=(screen|lines)$/.exec(args[i])) != null ) {
			outputMode = m[1] as "screen"|"lines";
		} else if( args[i].startsWith("-") ) {
			appArgs.push(args[i]);
		} else {
			appName = args[i];
			appArgs = appArgs.concat(args.slice(i+1));
			break;
		}
	}
	return { appName, outputMode, inputMode, appArgs };
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
	
	if( topArgs.appName == "help" ) {
		return echoAndExitApp([], HELP_TEXT_LINES, 0);
	} else if( topArgs.appName == "clock" ) {
		return tuiAppToProcLike({
			inputMode: topArgs.inputMode ?? "none",
			spawn: (ctx:PossiblyTUIAppContext)  => new ClockAppInstance(ctx),
		}, topArgs.outputMode ?? "screen");
	} else if( topArgs.appName == "hello" ) {
		return tuiAppToProcLike({
			inputMode: topArgs.inputMode ?? "none",
			spawn: (ctx:PossiblyTUIAppContext) => new EchoAppInstance([
				"Hello, world!",
				"How's it going?"
			], ctx),
		}, topArgs.outputMode ?? "screen");
	} else if( topArgs.appName == "wc" ) {
		const inputFiles : string[] = [];
			for( const arg of topArgs.appArgs ) {
				if( arg == '-' || !arg.startsWith("-") ) {
					inputFiles.push(arg);
					// Means 'wc should read from stdin'.
					// TODO: Allow apps to deal with their own arguments.
				} else {
					throw new Error(`Unrecognized argument to 'wc': '${arg}'`);
				}
			}
			return tuiAppToProcLike({
				inputMode: 'none',
				spawn: (ctx:PossiblyTUIAppContext) => new WCAppInstance(ctx, inputFiles),
			}, topArgs.outputMode ?? "screen");
	} else if( topArgs.appName == "no-app-specified" ) {
		return echoAndExitApp([], ["No app specified; try 'help'"], 1);
	} else {
		return echoAndExitApp([], [`Unrecognized command '${topArgs.appName}'`], 1);
	}
}

// TODO: Some kind of component library that
//   automatically lays things out, can draw boxes, tables, etc

if( import.meta.main ) {
	Deno.exit(await parseMain(Deno.args).spawn(Deno).wait())
}
