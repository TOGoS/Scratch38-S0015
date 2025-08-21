import AABB2D from '../../lib/ts/termdraw/AABB2D.ts';
import Vec2D from '../../lib/ts/termdraw/Vec2D.ts';

import * as ansi from '../../lib/ts/termdraw/ansi.ts';
import { AbstractFlexRasterable, AbstractRasterable, BoundedRasterable, boundsToSize, FixedRasterable, FlexChild, makeBorderedAbstractRasterable, makeSolidGenerator, PackedRasterable, RegionRasterable, RegionFillingRasterableGenerator, SizedRasterable, sizeToBounds, thisAbstractRasterableToRasterForSize, thisPackedRasterableRegionToRaster, PaddingRasterable } from '../../lib/ts/termdraw/components2.ts';
import TextRaster2, { Style } from '../../lib/ts/termdraw/TextRaster2.ts';
import { createUniformRaster, drawTextToRaster, textToRaster } from '../../lib/ts/termdraw/textraster2utils.ts';
import KeyEvent from '../../lib/ts/terminput/KeyEvent.ts';
import { AbstractAppInstance, PossiblyTUIAppContext, PossiblyTUIAppSpawner, runTuiApp, TUIAppRunOpts, Waitable } from '../../lib/ts/tuiappframework3.ts';

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
			rasterForSize: size => {
				// TODO: Make a component framework or something lol
				const idealSize = {
					x: this.#textLines.map(l => l.length).reduce((a,b) => Math.max(a,b), 0) + 4,
					y: this.#textLines.length + 2,
				}
				let rast = createUniformRaster(clampSize(idealSize, {x:0, y:0}, size), " ", ansi.RED_BACKGROUND);
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
			rasterForSize: (size) => {
				const idealSize = {
					x: textLines.map(l => l.length).reduce((a,b) => Math.max(a,b), 0) + 4,
					y: textLines.length + 2,
				}
				let rast = createUniformRaster(clampSize(idealSize, {x:0,y:0}, size), " ", ansi.RED_BACKGROUND);
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

class WCAppInstance extends DemoAppInstance implements SizedRasterable {
	#stdin : ReadableStream<Uint8Array>|undefined;
	#inputNames : string[];
	#sceneCache : AbstractRasterable|undefined;
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
	
	_generateScene() : AbstractRasterable {
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
			x: textLines.map(l => l[0].length).reduce((a,b) => Math.max(a,b), 0),
			y: textLines.length + 2,
		}
		let rast = createUniformRaster(idealSize, " ", ansi.RESET_FORMATTING);
		for( let i=0; i<textLines.length; ++i ) {
			rast = drawTextToRaster(rast, {x:0, y:i}, textLines[i][0], textLines[i][1]);
		}
		const border = makeSolidGenerator(" ", ansi.RED_BACKGROUND);
		const content = new FixedRasterable(rast);
		const bordered = makeBorderedAbstractRasterable(border, 1, content);
		
		return bordered;
	}
	
	get _scene() : AbstractRasterable {
		if( this.#sceneCache == undefined ) {
			this.#sceneCache = this._generateScene();
		}
		return this.#sceneCache;
	}
	
	rasterForSize(size: Vec2D<number>): TextRaster2 {
		return this._scene.rasterForSize(size);
	}
	
	_updateView() {
		this.#sceneCache = undefined;
		// Could cache the scene and invalidate it at this point.
		this._ctx.setScene(this);
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

const fixedSpace = new FixedRasterable(textToRaster(" ", ""));
const flexySpace = makeSolidGenerator(" ", "");
const flexyOneSpace = new PaddingRasterable({x0:0, y0:0, x1:1, y1:1}, flexySpace);

const oneCharPad = {
	component: fixedSpace,
	flexGrowAlong: 0,
	flexGrowAcross: 0,
	flexShrinkAlong: 1,
	flexShrinkAcross: 0,
};

function mkSimpleTextRasterable(spans:{text:string, style:Style}[], background=blackBackground) : AbstractRasterable {
	return new AbstractFlexRasterable(
		"right",
		background,
		spans.map(span => {
			const rast = textToRaster(span.text, span.style);
			return {
				component: new FixedRasterable(rast),
				flexGrowAlong: 0,
				flexGrowAcross: 0,
				flexShrinkAlong: 0,
				flexShrinkAcross: 0,
			}
		}),
	);
}

function mkTextRasterable(spans:{text:string, style:Style}[], background=blackBackground) : AbstractRasterable {
	return new AbstractFlexRasterable("right", background, [
		oneCharPad,
		...spans.map(span => {
			const rast = textToRaster(span.text, span.style);
			return {
				component: new FixedRasterable(rast),
				flexGrowAlong: 0,
				flexGrowAcross: 0,
				flexShrinkAlong: 0,
				flexShrinkAcross: 0,
			}
		}),
		oneCharPad,
		{
			component: flexySpace,
			flexGrowAlong: 1,
			flexGrowAcross: 0,
			flexShrinkAlong: 1,
			flexShrinkAcross: 0,
		}
	]); // Maybe add a padding one at the end
}

function simpleBordered(char:string, style:Style, interior:AbstractRasterable) : AbstractRasterable {
	return makeBorderedAbstractRasterable(makeSolidGenerator(char, style), 1, interior)
}

import { BDC_PROP_VALUES, LineStyle } from '../../lib/ts/termdraw/boxcharprops.ts';
import BoxDrawr from '../../lib/ts/termdraw/BoxDrawr.ts';
import { makeSeparatedFlex } from '../../lib/ts/termdraw/components2.ts';

class SizedLineBorderRasterable implements BoundedRasterable {
	readonly bounds : AABB2D<number>;
	readonly #bdcLineStyle : LineStyle;
	readonly #lineStyle  : Style;
	constructor(region:AABB2D<number>, bdcLineStyle:LineStyle, lineStyle:Style) {
		this.bounds = region;
		this.#bdcLineStyle = bdcLineStyle;
		this.#lineStyle = lineStyle;
	}
	rasterForRegion(region: AABB2D<number>): TextRaster2 {
		const size = boundsToSize(region);
		const boxDrawr = new BoxDrawr(size.x, size.y);
		const x0 = this.bounds.x0 - region.x0;
		const y0 = this.bounds.y0 - region.y0;
		const x1 = this.bounds.x1 - region.x0 - 1;
		const y1 = this.bounds.y1 - region.y0 - 1;
		const ls = this.#bdcLineStyle;
		boxDrawr.addLine(x0, y0, x1, y0, ls);
		boxDrawr.addLine(x1, y0, x1, y1, ls);
		boxDrawr.addLine(x1, y1, x0, y1, ls);
		boxDrawr.addLine(x0, y1, x0, y0, ls);
		return boxDrawr.contentToRaster(this.#lineStyle);
	}
}

// TODO: Use this to draw some cool bordered boxes
function lineBorder(bdcLineStyle:LineStyle, lineStyle:Style) : AbstractRasterable&PackedRasterable&RegionFillingRasterableGenerator {
	return {
		bounds: {x0: -1, y0:-1, x1: 1, y1: 1},
		pack() { return this; },
		fillSize(size:Vec2D<number>) {
			return this.fillRegion(sizeToBounds(size));
		},
		fillRegion(region:AABB2D<number>) {
			return new SizedLineBorderRasterable(region, bdcLineStyle, lineStyle);
		},
		rasterForRegion: thisPackedRasterableRegionToRaster,
		rasterForSize: thisAbstractRasterableToRasterForSize,
	}
}

function lineBordered(bdcLineStyle:LineStyle, lineStyle:Style, interior:AbstractRasterable) : AbstractRasterable {
	return makeBorderedAbstractRasterable(
		lineBorder(bdcLineStyle, lineStyle),
		1, interior
	);
}

const LINE_BORDER_PLACEHOLDER = "?"; // TODO: Pick some placeholder char, and actually replace it with line borders

const blackBackground = makeSolidGenerator(" ", ansi.BLACK_BACKGROUND);
const blueBackground = makeSolidGenerator(" ", ansi.BLACK_BACKGROUND);
const protoBorder = new PaddingRasterable({x0:0, y0:0, x1:1, y1:1}, makeSolidGenerator(LINE_BORDER_PLACEHOLDER, ansi.BRIGHT_CYAN_TEXT));

class BoxesAppInstance extends DemoAppInstance implements SizedRasterable {
	constructor(ctx:PossiblyTUIAppContext) {
		super(ctx);
		
		ctx.setScene(this);
	}
	
	_buildScene(size:Vec2D<number>) : AbstractRasterable {
		const border = makeSolidGenerator(" ", ansi.RED_BACKGROUND);
		const treeBg = blueBackground;
		
		const welcomeSpan = mkTextRasterable([
			{text:"Welcome to boxes!", style:ansi.FAINT+ansi.YELLOW_TEXT},
		])
		const sizeSpan = mkTextRasterable([
			{text:"Screen size: ", style:ansi.WHITE_TEXT},
			{text:size.x +" x " +size.y, style:ansi.BRIGHT_WHITE_TEXT},
		]);
		const contProps = {
			flexGrowAlong: 0,
			flexGrowAcross: 1,
			flexShrinkAlong: 0,
			flexShrinkAcross: 0,
		};
		const padProps = {
			flexGrowAlong: 1,
			flexGrowAcross: 1,
			flexShrinkAlong: 1,
			flexShrinkAcross: 1,
		};
		const texto = new AbstractFlexRasterable("down", treeBg, [
			{component: welcomeSpan, ...contProps},
			{component: sizeSpan   , ...contProps},
		]);
		const tree = lineBordered(BDC_PROP_VALUES.DOUBLE, ansi.BOLD+ansi.BRIGHT_RED_TEXT, new AbstractFlexRasterable("down", treeBg, [
			{component: lineBordered(BDC_PROP_VALUES.LIGHT, ansi.WHITE_TEXT, texto), ...contProps},
			// TODO: Instead of solid, make boxes
			{component: lineBordered(BDC_PROP_VALUES.LIGHT, ansi.BOLD+ansi.RED_TEXT  , makeSolidGenerator("2", ansi.RED_TEXT  )), ...padProps},
			{component: lineBordered(BDC_PROP_VALUES.LIGHT, ansi.BOLD+ansi.GREEN_TEXT, makeSolidGenerator("3", ansi.GREEN_TEXT)), ...padProps},
			{component: lineBordered(BDC_PROP_VALUES.LIGHT, ansi.BOLD+ansi.BLUE_TEXT , makeSolidGenerator("4", ansi.BLUE_TEXT )), ...padProps},
		]));
		return tree;
	}
	
	rasterForSize(size: Vec2D<number>): TextRaster2 {
		return this._buildScene(size).rasterForSize(size);
	}
}

interface StatusData {
	name: string;
	status?: string;
	lastSeen?: Date;
	recentMessages: string[];
}

function statusDataToAR(thing:StatusData) : AbstractRasterable {
	const components : FlexChild<AbstractRasterable>[] = [];
	// Note that along = down, across = L-R
	// Status line
	components.push({
		component: new AbstractFlexRasterable("right",
			blackBackground,
			[
				oneCharPad,
				{
					component: mkSimpleTextRasterable([{text: thing.name, style: ansi.BRIGHT_WHITE_TEXT}]),
					flexGrowAlong: 0, flexGrowAcross: 0, flexShrinkAlong: 0, flexShrinkAcross: 0
				},
				{
					component: flexyOneSpace,
					flexGrowAlong: 1, flexGrowAcross: 0, flexShrinkAlong: 0, flexShrinkAcross: 0
				},
				{
					component: mkSimpleTextRasterable([{
						text: thing.status ?? "?",
						style:
							thing.status == "online" ? ansi.BRIGHT_GREEN_TEXT :
							thing.status == "offline" ? ansi.RED_TEXT :
							ansi.YELLOW_TEXT
					}]),
					flexGrowAlong: 0, flexGrowAcross: 0, flexShrinkAlong: 0, flexShrinkAcross: 0
				},
				oneCharPad,
			]
		),
		flexGrowAlong: 0,
		flexGrowAcross: 1,
		flexShrinkAlong: 1,
		flexShrinkAcross: 1,
	});
	// Last seen line
	components.push({
		component: mkTextRasterable([
			{
				text: "last seen: " + (thing.lastSeen == undefined ? "never" : thing.lastSeen.toISOString()),
				style: ansi.BRIGHT_BLACK_TEXT
			}
		]),
		flexGrowAlong: 0,
		flexGrowAcross: 1,
		flexShrinkAlong: 1,
		flexShrinkAcross: 1,
	});
	const messagesChildren : FlexChild<AbstractRasterable>[] = [];
	// TODO: Put messages in its own area that when shrunk
	// just shows fewer of them; might need to add a 'gravity' prop or something
	for( const msg of thing.recentMessages ) {
		messagesChildren.push({
			// TODO: Show the most recent message in different color
			// so I can check that sorting is working
			component: mkTextRasterable([
				{text: msg, style: ansi.WHITE_TEXT},
			]),
			flexGrowAlong: 0,
			flexGrowAcross: 1,
			flexShrinkAlong: 1,
			flexShrinkAcross: 1
		});
	}
	components.push({
		component: new AbstractFlexRasterable("down", blueBackground, messagesChildren),
		flexGrowAlong: 0,
		flexGrowAcross: 1,
		flexShrinkAlong: 1,
		flexShrinkAcross: 1,
	})
	return new AbstractFlexRasterable("down", blueBackground, components);
}
function statusDatasToAR(things:StatusData[]) : AbstractRasterable {
	return makeSeparatedFlex("down", blackBackground, {
		component: protoBorder,
		flexGrowAlong: 0,
		flexGrowAcross: 1,
		flexShrinkAlong: 1,
		flexShrinkAcross: 1,
	}, things.map(sd => ({
		// TODO: Allow them to grow across, but not along!
		component: statusDataToAR(sd),
		flexGrowAlong: 0,
		flexGrowAcross: 1,
		flexShrinkAlong: 1,
		flexShrinkAcross: 1,
	})));
}

class StatusMockupAppInstance extends DemoAppInstance implements SizedRasterable {
	#statusDatas : StatusData[];
	
	constructor(ctx:PossiblyTUIAppContext) {
		super(ctx);
		this.#statusDatas = [
			{
				name: "bill", status: "online",
				lastSeen: new Date(),
				recentMessages: [
					"Hi there",
					"I'm Bill"
				]
			},
			{
				name: "ted", status: "offline",
				lastSeen: undefined,
				recentMessages: []
			},
		];
		ctx.setScene(this);
	}
	
	_buildScene(_size:Vec2D<number>) : AbstractRasterable {
		return new AbstractFlexRasterable("down", blackBackground, [
			{
				component: makeBorderedAbstractRasterable(protoBorder, 1, statusDatasToAR(this.#statusDatas)),
				flexGrowAlong: 0,
				flexGrowAcross: 0,
				flexShrinkAcross: 0,
				flexShrinkAlong: 0,
			}
		]);
	}
	
	rasterForSize(size: Vec2D<number>): TextRaster2 {
		return this._buildScene(size).rasterForSize(size);
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
	app  : PossiblyTUIAppSpawner<PossiblyTUIAppContext, Waitable<R>, KeyEvent>,
	opts : TUIAppRunOpts
) : Spawner<ProcLikeSpawnContext, Waitable<R>> {
	return {
		spawn(ctx:ProcLikeSpawnContext) : Waitable<R> {
			const exitCodePromise = runTuiApp(app, {
				stdin: ctx.stdin,
				stdout: ctx.stdout.writable.getWriter()
			}, opts);
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
	
	const runOpts = {
		// In case Deno.screenSize() doesn't work
		// Hmm: Maybe the whole Deno.consoleSizE() + fallback should be passed in as a callback
		fallbackConsoleSize: {x: 40, y: 20}
	};
	
	if( topArgs.appName == "help" ) {
		return echoAndExitApp([], HELP_TEXT_LINES, 0);
	} else if( topArgs.appName == "clock" ) {
		return tuiAppToProcLike({
			inputMode: topArgs.inputMode ?? "none",
			spawn: (ctx:PossiblyTUIAppContext)  => new ClockAppInstance(ctx),
		}, {
			...runOpts,
			outputMode: topArgs.outputMode ?? "screen"
		});
	} else if( topArgs.appName == "hello" ) {
		return tuiAppToProcLike({
			inputMode: topArgs.inputMode ?? "none",
			spawn: (ctx:PossiblyTUIAppContext) => new EchoAppInstance([
				"Hello, world!",
				"How's it going?"
			], ctx),
		}, {
			...runOpts,
			outputMode: topArgs.outputMode ?? "screen"
		});
	} else if( topArgs.appName == "wc" ) {
		const inputFiles : string[] = [];
		let usingStdin = false;
		for( const arg of topArgs.appArgs ) {
			if( arg == '-' ) {
				usingStdin = true;
			} else if( !arg.startsWith("-") ) {
				inputFiles.push(arg);
				// Means 'wc should read from stdin'.
				// TODO: Allow apps to deal with their own arguments.
			} else {
				throw new Error(`Unrecognized argument to 'wc': '${arg}'`);
			}
		}
		return tuiAppToProcLike({
			inputMode: usingStdin || topArgs.inputMode == undefined ? 'none' : topArgs.inputMode,
			spawn: (ctx:PossiblyTUIAppContext) => new WCAppInstance(ctx, inputFiles),
		}, {
			...runOpts,
			outputMode: topArgs.outputMode ?? "screen"
		});
	} else if( topArgs.appName == "boxes" ) {
		return tuiAppToProcLike({
			inputMode: topArgs.inputMode ?? "none",
			spawn: (ctx:PossiblyTUIAppContext) => new BoxesAppInstance(ctx),
		}, {
			...runOpts,
			outputMode: topArgs.outputMode ?? "screen"
		});
	} else if( topArgs.appName == "status-mockup" ) {
		return tuiAppToProcLike({
			inputMode: topArgs.inputMode ?? "none",
			spawn: (ctx:PossiblyTUIAppContext) => new StatusMockupAppInstance(ctx),
		}, {
			...runOpts,
			outputMode: topArgs.outputMode ?? "screen"
		});
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
