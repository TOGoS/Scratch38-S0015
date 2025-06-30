import TextRaster2 from './TextRaster2.ts';
import DrawCommand from './DrawCommand.ts';
import AABB2D from './AABB2D.ts';
import Vec2D from './Vec2D.ts';

function actualChangedRegions(rasterA:TextRaster2, rasterB:TextRaster2, regions:Iterable<AABB2D>) : Iterable<AABB2D> {
	// TODO: Check raster data, only emit sub-regions that actually differ
	return regions;
}

function clamp(n:number, min:number, max:number) {
	if(n < min) return min;
	if(n > max) return max;
	return n;
}

export function* textRaster2ToDrawCommands(raster:TextRaster2, regions:Iterable<AABB2D>, offset:Vec2D<number>) : Iterable<DrawCommand> {
	for( const reg of regions ) {
		const y0 = clamp(reg.y0, 0, raster.height);
		const x0 = clamp(reg.x0, 0, raster.width);
		const y1 = clamp(reg.y1, 0, raster.height);
		const x1 = clamp(reg.x1, 0, raster.width);
		let cursorY : number|undefined = undefined;
		let cursorX : number|undefined = undefined;
		let cursorStyle : string|undefined = undefined;
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
						chars.push(raster.chars[y][x]);
					}
					if( spanStyle != cursorStyle ) {
						yield {
							classRef: "x:EmitLiteral",
							sequence: cursorStyle = spanStyle
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
}

// toChars will be important for translating x:EmitText to chars for a raster

const CHARS_REGEX = /(?:.(\u200D.)*)/gu;
export function toChars(str:string) {
	return str.match(CHARS_REGEX);
}
