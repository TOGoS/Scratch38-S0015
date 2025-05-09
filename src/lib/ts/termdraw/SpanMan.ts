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
	#fullRedrawNeeded; // For now just always redraw everything!
	
	constructor(textSpans:ReadonlyMap<SpanID,PSTextSpan>, viewRect:ViewportRect, dirtyRegions:ReadonlyMap<number,Colspan[]>=emptyMap(), fullRedrawNeeded=false) {
		this.#textSpans = textSpans;
		this.#viewRect = viewRect;
		this.#dirtyRegions = dirtyRegions;
		this.#fullRedrawNeeded = fullRedrawNeeded;
	}
	
	get viewRect() {
		return this.#viewRect;
	}
	
	update(updates:Map<SpanID,PSTextSpan>) : SpanMan {
		const newSpans = new Map(this.#textSpans.entries());
		const newDirtyRegions = new Map(this.#dirtyRegions.entries());
		
		for( const [k,v] of updates ) {
			// If tracking dirty regions, would need to do so here,
			// also taking any old version of the span into account.
			const oldSpan = this.#textSpans.get(k);
			if( oldSpan != undefined ) {
				addDirtyRegion(newDirtyRegions, oldSpan.y, {x0:oldSpan.x, x1:oldSpan.x+oldSpan.width});
			}
			if( v == undefined ) {
				newSpans.delete(k);
			} else {
				newSpans.set(k, v);
				addDirtyRegion(newDirtyRegions, v.y, {x0:v.x, x1:v.x + v.width});
			}
		}
		return new SpanMan(newSpans, this.#viewRect, newDirtyRegions);
	}
	withViewRect(viewRect:ViewportRect) : SpanMan {
		if( viewRect == this.#viewRect || this.#fullRedrawNeeded ) return this;
		
		// If tracking updates, will need to either
		// add newly exposed areas or the whole screen
		// to the dirty list.
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
		for( const [row,colspans] of this.#dirtyRegions ) {
			//console.log(`Dirty colspans on line ${row}: ${colspans}`)
			for( const colspan of colspans ) {
				const width = colspan.x1 - colspan.x0;
				// TODO: Find spans on the row, sort,
				// insert spaces in gaps, and draw that, to avoid overdraw
				yield {
					classRef: 'x:PSTextSpan',
					style: '\x1b[0m', // 'default style'
					x: this.#viewRect.screenX + colspan.x0 - this.#viewRect.worldX,
					y: this.#viewRect.screenY + row        - this.#viewRect.worldY,
					z: 0,
					width: width,
					text: ' '.repeat(width),
				};
				for( const out of this.generateSpanOutput(
					colspan.x0,
					row,
					this.#viewRect.screenX + colspan.x0 - this.#viewRect.worldX,
					this.#viewRect.screenY + row        - this.#viewRect.worldY,
					width, 1 // TODO: May need to trim width, or skip if row entirely outside viewRect
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
		if( this.#fullRedrawNeeded ) {
			return {
				newState: this,
				output: [
					{classRef:"x:ClearScreen"},
					...this.generateSpanOutput(this.#viewRect.worldX, this.#viewRect.worldY, this.#viewRect.screenX, this.#viewRect.screenY, this.#viewRect.width, this.#viewRect.height)
				],
			}
		} else if( this.#dirtyRegions.size == 0 ) {
			return {newState: this, output: []};
		} else {
			return {
				newState: new SpanMan(this.#textSpans, this.#viewRect, emptyMap(), false),
				output: this.generateDirtyRegionOutput(),
			}
		}
	}
}
