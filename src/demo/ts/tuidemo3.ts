import Vec2D from '../../lib/ts/termdraw/Vec2D.ts';
import DrawCommand from "../../lib/ts/termdraw/DrawCommand.ts";

import KeyEvent from '../../lib/ts/terminput/KeyEvent.ts';
import TextRaster2 from '../../lib/ts/termdraw/TextRaster2.ts';
import TUIRenderStateManager from '../../lib/ts/termdraw/TUIRenderStateManager.ts';
import { inputEvents } from '../../lib/ts/terminput/inputeventparser.ts';
import { blitToRaster, createUniformRaster, drawTextToRaster, textRaster2ToDrawCommands, textRaster2ToLines } from '../../lib/ts/termdraw/textraster2utils.ts';
import { RED_TEXT, RESET_FORMATTING, toAnsi } from '../../lib/ts/termdraw/ansi.ts';
import { iterateAndReturn, mergeAsyncIterables } from '../../lib/ts/_util/asynciterableutil.ts';
import { Signal } from 'https://deno.land/x/tui@2.1.11/mod.ts';
import { reset } from 'https://deno.land/std@0.165.0/fmt/colors.ts';

//// Some types that could be librarified if this all works

type TerminalAppSpawner<Context,Instance,InputEvent> = {
	usesRawInput: true,
	spawn(context: Context) : Instance & {handleInput(input:InputEvent) : void};
} | {
	usesRawInput: false,
	spawn(context: Context) : Instance;
};
interface AppSpawnOptions {
	outputMode: "screen"|"lines";
}

// ProcessLike, but more abstract
interface Waitable<R> {
	wait() : Promise<R>;
}

interface TUIAppInstance<I,R> extends Waitable<R> {
	handleInput(input:I) : void;
}

interface TerminalAppContext {
	// Hmm: Directly using Readable/WritableStreams might not be the most useful thing;
	// will try and find out later.
	stdin?   : ReadableStream<Uint8Array>;
	//stdout : WritableStream<Uint8Array>;
	//stderr : WritableStream<Uint8Array>;
	viewSink : (r:Rasterable)=>void;
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
	#textLines : string[];
	constructor(textLines:string[], outputHandler:(scene:Rasterable)=>void) {
		super(outputHandler)
		this.#textLines = textLines;
		this.run();
	}
	
	protected run() {
		this._outputHandler({
			toRaster: (screenSize) => {
				let rast = createUniformRaster({x:screenSize.x, y:this.#textLines.length+2}, " ", RESET_FORMATTING);
				for( let i=0; i<this.#textLines.length; ++i ) {
					rast = drawTextToRaster(rast, {x:1, y:i+1}, this.#textLines[i], RESET_FORMATTING);
				}
				return rast;
			}
		});
		setTimeout(() => this._exit(0), 1000);
	}
}

async function runTuiApp<Result>(
	spawner: TerminalAppSpawner<TerminalAppContext, Waitable<Result>, KeyEvent>,
	ctx:{
		stdin  : typeof Deno.stdin,
		stdout : WritableStreamDefaultWriter
	},
	opts: AppSpawnOptions,
) : Promise<Result> {
	const textEncoder = new TextEncoder();
	
	function getScreenSize() : Vec2D<number> {
		const cs = Deno.consoleSize();
		return { x: cs.columns, y: cs.rows };
	}
	
	const outMan : {
		enter() : Promise<void>;
		exit() : Promise<void>;
		update(scene:Rasterable) : void;
	} = opts.outputMode == "lines" ? (() => {
		let outProm = Promise.resolve();
		
		return {
			enter() { return outProm; },
			exit() { return outProm; },
			update(scene:Rasterable) {
				const outCommands = textRaster2ToLines(scene.toRaster(getScreenSize()));
				for( const command of outCommands ) {
					outProm = outProm.then(() => ctx.stdout.write(textEncoder.encode(toAnsi(command))));
				}
			}
		}
	})() : (() => {
		let currentScene : Rasterable = {
			toRaster(size:Vec2D<number>) : TextRaster2 {
				return createUniformRaster(size, " ", RESET_FORMATTING);
			}
		}
		
		const renderStateMan = new TUIRenderStateManager(ctx.stdout, async (out) => {
			const raster = currentScene.toRaster(getScreenSize());
			const outCommands = textRaster2ToDrawCommands(raster);
			for( const command of outCommands ) {
				await out.write(textEncoder.encode(toAnsi(command)));
			}
		});
		
		return {
			enter: () => renderStateMan.enterTui(),
			exit : () => renderStateMan.exitTui(),
			update(scene:Rasterable) {
				currentScene = scene;
				renderStateMan.requestRedraw();
			}
		};
	})();
	
	try {
		await outMan.enter();
		if( spawner.usesRawInput ) ctx.stdin.setRaw(true);
		
		const appInstance = spawner.spawn({
			viewSink: outMan.update
		});
		
		// App is started!
		
		if( spawner.usesRawInput ) {
		// TODO: Parse input, pass it to the app!
		}
		
		const exitCode = await appInstance.wait();
		return exitCode;
	} finally {
		if( spawner.usesRawInput ) ctx.stdin.setRaw(false);
		await outMan.exit();
	}
}

//// Over-engineered process spawning stuff

interface TopArgs {
	appName : string;
	appArgs : string[];
}

function parseTopArgs(args:string[]) : TopArgs {
	let appArgs : string[] = [];
	let appName : string = "no-app-specified";
	for( let i=0; i<args.length; ++i ) {
		if( args[i].startsWith("-") ) {
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
	app:TerminalAppSpawner<TerminalAppContext, Waitable<R>, KeyEvent>,
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
	for( const arg of topArgs.appArgs ) {
		let m : RegExpExecArray|null;
		if( (m = /^--output-mode=(screen|lines)$/.exec(arg)) != null ) {
			outputMode = m[1] as "screen"|"lines";
		} else {
			throw new Error(`Unrecognized argument: '${arg}'`);
		}
	}
		
	if( topArgs.appName == "hello" ) {
		return tuiAppToProcLike({
			usesRawInput: false,
			spawn({viewSink}) {
				return new EchoAppInstance([
					"Hello, world!",
					"How's it going?"
				], viewSink);
			}
		}, outputMode);
	} else if( topArgs.appName == "no-app-specified" ) {
		return echoAndExitApp([], ["No app specified; try 'hello'"], 1);
	} else {
		return echoAndExitApp([], [`Unrecognized command '${topArgs.appName}'`], 1);
	}
}

if( import.meta.main ) {
	Deno.exit(await parseMain(Deno.args).spawn(Deno).wait())
}
