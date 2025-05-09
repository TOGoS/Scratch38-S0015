import PSTextSpan, { EMPTY_SPAN } from './PSTextSpan.ts';
import DrawCommand from './DrawCommand.ts';
import ViewportRect from './ViewportRect.ts';
import Colspan from './_util/Colspan.ts';
import { mergeSpans } from './_util/spanmerge.ts';

type SpanID = number;

function translateAndTrimSpan(
	span:PSTextSpan, offX:number, offY:number,
	destX0:number, destY0:number, viewWidth:number, viewHeight:number
) : PSTextSpan {
	const transY0 = span.y + offY;
	if( transY0 < destY0 || transY0 >= destY0 + viewHeight ) return EMPTY_SPAN;
	
	const transX0 = span.x + offX;
	const transX1   = transX0 + span.width;
	const destX1    = destX0 + viewWidth;
	
	if( transX1 <= destX0 || transX0 >= destX1 ) return EMPTY_SPAN;
	
	if( transX0 >= destX0 && transX1 <= destX1 ) {
		//if( offX == 0 && offY == 0 ) return span;
		// Could do simpler 'no-trim' translation here.  Otherwise fall through...
	}
	
	const clampedX0 = Math.max(transX0, destX0);
	const clampedX1 = Math.min(transX1, destX1);
	if( clampedX1 <= clampedX0 ) {
		throw new Error(`clampedX1 should always be > clampedX0, but are: ${clampedX0}, ${clampedX1}`);
	}
	
	const trimmedWidth = clampedX1 - clampedX0;
	if( trimmedWidth <= 0 ) {
		throw new Error(`trimmedWidth should always be positive, but is ${trimmedWidth}`);
	}
	const skip = Math.max(0, clampedX0 - transX0);
	const trimmedText = span.text.substring(skip, skip+trimmedWidth);
	
	return {
		classRef: "x:PSTextSpan",
		x: clampedX0, y: transY0, z: span.z,
		style: span.style,
		text: trimmedText,
		width: trimmedWidth,
	}
}

function withDirtyColspan(current:Colspan[], newCs:Colspan) : Colspan[] {
	if( newCs.x0 >= newCs.x1 ) return current; // Nothing to add!
	
	return [...mergeSpans(current, [newCs])];
}

function addDirtyRegion(into:Map<number,Colspan[]>, row:number, colspan:Colspan) {
	into.set(row, withDirtyColspan(into.get(row) ?? [], colspan));
}

const EMPTY_MAP : ReadonlyMap<unknown,unknown> = Object.freeze(new Map());
function emptyMap<K,V>() : ReadonlyMap<K,V>{
	return EMPTY_MAP as ReadonlyMap<K,V>;
}

export default class SpanMan {
	#textSpans : ReadonlyMap<SpanID,PSTextSpan>;
	#viewRect : ViewportRect;
	#dirtyRegions : ReadonlyMap<number,Colspan[]>; // Relative to 'world space'
	#fullRedrawRequested; // For now just always redraw everything!
	
	constructor(textSpans:ReadonlyMap<SpanID,PSTextSpan>, viewRect:ViewportRect, dirtyRegions:ReadonlyMap<number,Colspan[]>=emptyMap(), fullRedrawRequested=true) {
		this.#textSpans = textSpans;
		this.#viewRect = viewRect;
		this.#dirtyRegions = dirtyRegions;
		this.#fullRedrawRequested = fullRedrawRequested;
	}
	
	get viewRect() {
		return this.#viewRect;
	}
	
	update(updates:Map<SpanID,PSTextSpan>) : SpanMan {
		const newSpans = new Map(this.#textSpans.entries());
		const newDirtyRegions = this.#fullRedrawRequested ? undefined : new Map(this.#dirtyRegions.entries());
		
		for( const [k,v] of updates ) {
			// If tracking dirty regions, would need to do so here,
			// also taking any old version of the span into account.
			const oldSpan = this.#textSpans.get(k);
			if( oldSpan != undefined ) {
				if( newDirtyRegions ) addDirtyRegion(newDirtyRegions, oldSpan.y, {x0:oldSpan.x, x1:oldSpan.x+oldSpan.width});
			}
			if( v == undefined ) {
				newSpans.delete(k);
			} else {
				newSpans.set(k, v);
				if( newDirtyRegions ) addDirtyRegion(newDirtyRegions, v.y, {x0:v.x, x1:v.x + v.width});
			}
		}
		return new SpanMan(newSpans, this.#viewRect, newDirtyRegions ?? emptyMap(), this.#fullRedrawRequested);
	}
	withFullRedrawRequested() {
		if( this.#fullRedrawRequested ) return this;
		return new SpanMan(this.#textSpans, this.#viewRect, new Map(), true);
	}
	withViewRect(viewRect:ViewportRect) : SpanMan {
		if( viewRect == this.#viewRect ) return this;
		return new SpanMan(this.#textSpans, viewRect, new Map(), true);
	}
	
	generateSpanOutput(worldX:number, worldY:number, destX:number, destY:number, regWidth:number, regHeight:number) : Iterable<DrawCommand> {
		const spans = [];
		for( let span of this.#textSpans.values() ) {
			span = translateAndTrimSpan(span,
				destX - worldX, destY - worldY,
				destX, destY,
				regWidth, regHeight
			);
			if( span == EMPTY_SPAN ) continue;
			spans.push(span);
		}
		// Higher Z come later for overdraw
		// (TODO: Don't do overdraw!)
		spans.sort((a,b) => a.z < b.z ? -1 : a.z > b.z ? 1 : 0);
		return spans;
	}
	
	*generateDirtyRegionOutput() : Iterable<DrawCommand> {
		for( const [worldY,colspans] of this.#dirtyRegions ) {
			if( worldY < this.#viewRect.worldY || worldY >= this.#viewRect.worldY + this.#viewRect.height ) continue;
			
			//console.log(`Dirty colspans on line ${row}: ${colspans}`)
			for( const colspan of colspans ) {
				// TODO: Find spans on the row, sort,
				// insert spaces in gaps, and draw that, to avoid overdraw
				const trimmedWorldX0 = Math.max(colspan.x0, this.#viewRect.worldX);
				const trimmedWorldX1 = Math.min(colspan.x1, this.#viewRect.worldX + this.#viewRect.width);
				if( trimmedWorldX0 >= trimmedWorldX1 ) continue;
				
				const regionWidth = trimmedWorldX1 - trimmedWorldX0;
				
				yield {
					classRef: 'x:PSTextSpan',
					style: '\x1b[0m', // 'default style'
					x: this.#viewRect.screenX + trimmedWorldX0 - this.#viewRect.worldX,
					y: this.#viewRect.screenY + worldY         - this.#viewRect.worldY,
					z: 0,
					width: regionWidth,
					text: ' '.repeat(regionWidth),
				};
				
				for( const out of this.generateSpanOutput(
					trimmedWorldX0,
					worldY,
					this.#viewRect.screenX + trimmedWorldX0 - this.#viewRect.worldX,
					this.#viewRect.screenY + worldY         - this.#viewRect.worldY,
					trimmedWorldX1 - trimmedWorldX0,
					1
				) ) {
					yield out;
				}
			}
		} 
	}
	
	render() : {newState:SpanMan, output:Iterable<DrawCommand>} {
		// For starters, just redraw the whole screen every time!
		// Which means there's no dirty list to bother with,
		// so we can return this same old spanman.
		if( this.#fullRedrawRequested ) {
			return {
				newState: new SpanMan(this.#textSpans, this.#viewRect, emptyMap(), false),
				output: [
					{classRef:"x:ClearScreen"},
					...this.generateSpanOutput(this.#viewRect.worldX, this.#viewRect.worldY, this.#viewRect.screenX, this.#viewRect.screenY, this.#viewRect.width, this.#viewRect.height)
				]
			}
		} else if( this.#dirtyRegions.size > 0 ) {
			return {
				newState: new SpanMan(this.#textSpans, this.#viewRect, emptyMap(), false),
				output: this.generateDirtyRegionOutput(),
			};
		} else {
			// Nothing to do!
			return {newState: this, output: []};
		}
	}
}
