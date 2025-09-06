import TextRaster2, { Character, Style } from './TextRaster2.ts';
import DrawCommand from './DrawCommand.ts';
import AABB2D from './AABB2D.ts';
import Vec2D from './Vec2D.ts';
import { DEFAULT_STYLE } from './ansi.ts';
import { intersection } from './boundsutils.ts';
import { assert } from 'https://deno.land/std@0.165.0/testing/asserts.ts';

function actualChangedRegions(rasterA:TextRaster2, rasterB:TextRaster2, regions:Iterable<AABB2D<number>>) : Iterable<AABB2D<number>> {
	// TODO: Check raster data, only emit sub-regions that actually differ
	return regions;
}

function clamp(n:number, min:number, max:number) {
	if(n < min) return min;
	if(n > max) return max;
	return n;
}

function textRaster2Bounds(raster:TextRaster2) : AABB2D<number> {
	return {
		x0: 0, y0: 0,
		x1: raster.size.x,
		y1: raster.size.y,
	};
}

/**
 * Generate draw commands to output the given region
 * of the given raster, top-to-bottom, without absolute cursor movement.
 */
export function* textRaster2ToLines(
	raster : TextRaster2,
	region : AABB2D<number> = textRaster2Bounds(raster),
	afterLine : DrawCommand = { classRef: "x:EmitText", text: "\n" },
	emptyChar : string = " ",
) : Iterable<DrawCommand> {
	const y0 = clamp(region.y0, 0, raster.size.y);
	const x0 = clamp(region.x0, 0, raster.size.x);
	const y1 = clamp(region.y1, 0, raster.size.y);
	const x1 = clamp(region.x1, 0, raster.size.x);
	let cursorStyle : string|undefined = undefined;
	for( let y=y0; y<y1; ++y ) {
		for( let x=x0; x<x1; ) {
			const spanX0 = x;
			const spanStyle = raster.styles[y][x];
			for( x=x+1; x<x1 && raster.styles[y][x] == spanStyle; ++x ) {}
			const spanX1 = x;
			const chars:string[] = [];
			for( x=spanX0; x<spanX1; ++x ) {
				const rChar = raster.chars[y][x];
				chars.push(rChar == undefined ? emptyChar : rChar);
			}
			if( spanStyle != cursorStyle ) {
				yield {
					classRef: "x:EmitStyleChange",
					sequence: cursorStyle = spanStyle ?? DEFAULT_STYLE,
				};
			}
			yield {
				classRef: "x:EmitText",
				text: chars.join(''),
			};
		}
		if( cursorStyle != "" ) {
			yield {
				classRef: "x:EmitStyleChange",
				sequence: cursorStyle = DEFAULT_STYLE,
			};
		}
		yield afterLine;
	}
}

export function* textRaster2ToDrawCommands(
	raster:TextRaster2,
	regions:Iterable<AABB2D<number>> = [textRaster2Bounds(raster)],
	offset:Vec2D<number> = {x:0, y:0}
) : Iterable<DrawCommand> {
	let cursorY : number|undefined = undefined;
	let cursorX : number|undefined = undefined;
	let cursorStyle : string|undefined = undefined;
	for( const reg of regions ) {
		const y0 = clamp(reg.y0, 0, raster.size.y);
		const x0 = clamp(reg.x0, 0, raster.size.x);
		const y1 = clamp(reg.y1, 0, raster.size.y);
		const x1 = clamp(reg.x1, 0, raster.size.x);
		for( let y=y0; y<y1; ++y ) {
			for( let x=x0; x<x1; ) {
				if( raster.chars[y][x] == "" ) {
					// Empty space; skip it and emit nothing without changing cursor!
					for( x=x+1; x<x1 && raster.chars[y][x] == ""; ++x ) {}
					continue;
				} else {
					const spanX0 = x;
					const spanStyle = raster.styles[y][x];
					for( x=x+1; x<x1 && raster.chars[y][x] != "" && raster.styles[y][x] == spanStyle; ++x ) {}
					const spanX1 = x;
					if( cursorX != spanX0 || cursorY != y ) {
						yield {
							classRef: "x:Move",
							x: cursorX = spanX0 + offset.x,
							y: cursorY = y      + offset.y
						};
					}
					const chars:string[] = [];
					for( x=spanX0; x<spanX1; ++x ) {
						chars.push(raster.chars[y][x] ?? " ");
					}
					if( spanStyle != cursorStyle ) {
						yield {
							classRef: "x:EmitStyleChange",
							sequence: cursorStyle = spanStyle ?? DEFAULT_STYLE
						};
					}
					yield {
						classRef: "x:EmitText",
						text: chars.join(''),
					};
					cursorX += chars.length;
				}
			}
		}
	}
	if( cursorStyle != DEFAULT_STYLE ) {
		yield {
			classRef: "x:EmitStyleChange",
			sequence: cursorStyle = DEFAULT_STYLE,
		};
	}
}

// toChars will be important for translating x:EmitText to chars for a raster

const CHARS_REGEX = /(?:.(\u200D.)*)/gu;
export function toChars(str:string) : string[] {
	return str.match(CHARS_REGEX) ?? [];
}

function createUniformList<T>(length:number, item:T) : T[] {
	return Array.from({ length }, () => item);
}

function validateRaster(rast:TextRaster2) {
	if( rast.size.x < 0 || !isFinite(rast.size.x) ) throw new Error(`Bad raster width: ${rast.size.x}`);
	if( rast.size.y < 0 || !isFinite(rast.size.y) ) throw new Error(`Bad raster height: ${rast.size.y}`);
	if( rast.chars.length != rast.size.y ) throw new Error(`Raster chars length (${rast.chars.length} doesn't match size.y (${rast.size.y})`);
	if( rast.styles.length != rast.size.y ) throw new Error(`Raster styles length (${rast.chars.length} doesn't match size.y (${rast.size.y})`);
	for( let r=0; r<rast.size.y; ++r ) {
		if( rast.chars [r].length != rast.size.x ) throw new Error(`${rast.size.x}x${rast.size.y} raster char row ${ r}'s length = ${rast.chars [r].length}`);
		if( rast.styles[r].length != rast.size.x ) throw new Error(`${rast.size.x}x${rast.size.y} raster style row ${r}'s length = ${rast.styles[r].length}`);
	}
	return rast;
}

export function createRaster(size:Vec2D<number>, chars:(Character|undefined)[][], styles:(Style|undefined)[][]) : TextRaster2 {
	return validateRaster({size, chars, styles});
}

export function createUniformRaster(size:Vec2D<number>, char:Character|undefined, style:Style|undefined) : TextRaster2 {
	const charLine  = createUniformList(size.x, char);
	const styleLine = createUniformList(size.x, style);
	return validateRaster({
		size,
		chars : createUniformList(size.y,  charLine),
		styles: createUniformList(size.y, styleLine),
	})
}

function blitRowNoBoundsCheck<T>(canvas:T[], offset:number, stamp:(T|undefined)[], stampOffset0:number, stampOffset1:number) : T[] {
	const result = [];
	let anythingChanged = false;
	const x0 = offset;
	const x1 = offset + stampOffset1-stampOffset0;
	for( let i=0; i<canvas.length; ++i ) {
		const dat =
			i < x0 || i >= x1 ? canvas[i] :
			stamp[stampOffset0 + i - x0] ?? canvas[i];
		if( canvas[i] != dat ) anythingChanged = true;
		result[i] = dat;
	}
	return anythingChanged ? result : canvas;
}

function blitCanvasNoBoundsCheck(canvas:TextRaster2, offsetOntoCanvas:Vec2D<number>, stampRaster:TextRaster2, stampRegion:AABB2D<number>) : TextRaster2 {
	const destY0 = offsetOntoCanvas.y;
	const destY1 = destY0 + stampRegion.y1 - stampRegion.y0;
	const resultChars  : (Character|undefined)[][] = [];
	const resultStyles : (Style|undefined)[][] = [];
	let anythingChanged : boolean = false;
	for( let row=0; row<canvas.size.y; ++row ) {
		if( row < destY0 || row >= destY1 ) {
			resultChars[ row] = canvas.chars[ row];
			resultStyles[row] = canvas.styles[row];
		} else {
			const stampRow = stampRegion.y0 + row - destY0;
			resultChars[ row] = blitRowNoBoundsCheck(canvas.chars[ row], offsetOntoCanvas.x, stampRaster.chars[ stampRow], stampRegion.x0, stampRegion.x1);
			resultStyles[row] = blitRowNoBoundsCheck(canvas.styles[row], offsetOntoCanvas.x, stampRaster.styles[stampRow], stampRegion.x0, stampRegion.x1);
			if( resultChars[ row] != canvas.chars[row] || resultStyles[row] != canvas.styles[row] ) anythingChanged = true;
		}
	}
	return anythingChanged ? validateRaster({
		size: canvas.size,
		chars: resultChars,
		styles: resultStyles,
	}) : canvas;
}

export function blitToRaster(
	canvas:TextRaster2,
	offsetOntoCanvas:Vec2D<number>,
	stampRaster:TextRaster2,
	stampRegion:AABB2D<number> = {x0: 0, y0: 0, x1: stampRaster.size.x, y1: stampRaster.size.y}
) : TextRaster2 {
	validateRaster(canvas);
	// Crop source region to source, adjusting offset as needed
	//const stampCroppedStampRegion = intersection(stampRegion, {x0:0, y0:0, x1:stampRaster.size.x, y1:stampRaster.size.y});
	const croppedStampRegion = intersection(
		intersection(stampRegion,
			{x0:0, y0:0, x1:stampRaster.size.x, y1:stampRaster.size.y}
		),
		{
			x0: 0             - offsetOntoCanvas.x,
			y0: 0             - offsetOntoCanvas.y,
			x1: canvas.size.x - offsetOntoCanvas.x,
			y1: canvas.size.y - offsetOntoCanvas.y,
		}
	);
	offsetOntoCanvas = {
		x: offsetOntoCanvas.x + croppedStampRegion.x0 - stampRegion.x0,
		y: offsetOntoCanvas.y + croppedStampRegion.y0 - stampRegion.y0,
	}
	// Shortcut if entirely outside canvas
	if( offsetOntoCanvas.x >= canvas.size.x ) return canvas;
	if( offsetOntoCanvas.y >= canvas.size.y ) return canvas;
	if( offsetOntoCanvas.x + croppedStampRegion.x1 - croppedStampRegion.x0 <= 0 ) return canvas;
	if( offsetOntoCanvas.y + croppedStampRegion.y1 - croppedStampRegion.y0 <= 0 ) return canvas;
	
	assert(offsetOntoCanvas.x >= 0);
	assert(offsetOntoCanvas.y >= 0);
	assert(offsetOntoCanvas.x + croppedStampRegion.x1 - croppedStampRegion.x0 <= canvas.size.x);
	assert(offsetOntoCanvas.y + croppedStampRegion.y1 - croppedStampRegion.y0 <= canvas.size.y);
	return blitCanvasNoBoundsCheck(canvas, offsetOntoCanvas, stampRaster, croppedStampRegion);
}

export function textToRaster(text:string, style:Style) : TextRaster2 {
	const chars  = toChars(text);
	const styles = createUniformList(chars.length, style);
	return validateRaster({
		size: {x: chars.length, y: 1},
		chars : [chars ],
		styles: [styles],
	})
}

export function drawTextToRaster(canvas:TextRaster2, offset:Vec2D<number>, text:string, style:Style) {
	// This way is 'simple'
	const textRaster = textToRaster(text,style);
	return blitToRaster(canvas, offset, textRaster);
	
	// Alternate way might be more efficient if text is much larger than the target raster,
	// but repeats some of the blitting logic:
	
	/*
	if( offset.y < 0 || offset.y >= canvas.size.y ) return canvas;
	const chars = toChars(text);
	const x0 = offset.x;
	const x1 = x0 + chars.length;
	if( x0 >= canvas.size.x || x1 <= 0 ) return canvas;
	
	const styles = createUniformList(chars.length, style);
	
	const resultChars  : string[][] = [];
	const resultStyles :  Style[][] = [];
	let anythingChanged : boolean = false;
	for( let row=0; row<canvas.size.y; ++row ) {
		if( row != offset.y ) {
			resultChars[ row] = canvas.chars[ row];
			resultStyles[row] = canvas.styles[row];
		} else {
			resultChars[ row] = blitRowNoBoundsCheck(canvas.chars[ row], x0,  chars, 0,  chars.length);
			resultStyles[row] = blitRowNoBoundsCheck(canvas.styles[row], x0, styles, 0, styles.length);
			if( resultChars[ row] != canvas.chars[row] || resultStyles[row] != canvas.styles[row] ) anythingChanged = true;
		}
	}
	return anythingChanged ? {
		size: canvas.size,
		chars: resultChars,
		styles: resultStyles,
	} : canvas;
	*/
}

export function drawCommandsToRaster(canvas:TextRaster2, commands:Iterable<DrawCommand>) : TextRaster2 {
	let currentOffset : Vec2D<number> = {x:0, y:0};
	let currentStyle  : Style = DEFAULT_STYLE;
	for( const command of commands ) {
		switch( command.classRef ) {
		case 'x:ClearScreen':
			canvas = createUniformRaster(canvas.size, " ", DEFAULT_STYLE);
			// TODO: Handle the other cases!
			break;
		case 'x:EmitLiteral':
			// We could try to parse it, but for now...
			throw new Error("drawCommandsToRaster doesn't accept literals!");
		case 'x:EmitText': {
			//canvas = drawTextToRaster(canvas, currentOffset, command.text, currentStyle);
			const textRaster = textToRaster(command.text, currentStyle);
			canvas = blitToRaster(canvas, currentOffset, textRaster);
			currentOffset = {x: currentOffset.x + textRaster.size.x, y: currentOffset.y};
			break;
		}
		case 'x:Move':
			currentOffset = command;
			break;
		case 'x:PSTextSpan':
			{
				currentOffset = command;
				currentStyle = command.style;
				const textRaster = textToRaster(command.text, command.style);
				canvas = drawTextToRaster(canvas, currentOffset, command.text, command.style);
				currentOffset = {x: currentOffset.x + textRaster.size.x, y: currentOffset.y};
			}
			break;
		}
	}
	return canvas;
}
