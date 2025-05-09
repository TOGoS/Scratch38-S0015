import PSTextSpan, { EMPTY_SPAN } from './PSTextSpan.ts';
import DrawCommand from './DrawCommand.ts';
import ViewportRect from './ViewportRect.ts';

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

export default class SpanMan {
	#textSpans : ReadonlyMap<SpanID,PSTextSpan>;
	#viewRect : ViewportRect;
	// #dirtyRegions : Rectangle[]; // Relative to...our view rect space, I guess
	#fullRedrawNeeded = true; // For now just always redraw everything!
	
	constructor(textSpans:ReadonlyMap<SpanID,PSTextSpan>, viewRect:ViewportRect) {
		this.#textSpans = textSpans;
		this.#viewRect = viewRect;
	}
	
	get viewRect() {
		return this.#viewRect;
	}
	
	update(updates:Map<SpanID,PSTextSpan>) : SpanMan {
		const newSpans = new Map(this.#textSpans.entries());
		for( const [k,v] of updates ) {
			// If tracking dirty regions, would need to do so here,
			// also taking any old version of the span into account.
			if( v == undefined ) {
				newSpans.delete(k);
			} else {
				newSpans.set(k, v);
			}
		}
		return new SpanMan(newSpans, this.#viewRect);
	}
	withViewRect(viewRect:ViewportRect) : SpanMan {
		if( viewRect == this.#viewRect ) return this;
		// If tracking updates, will need to either
		// add newly exposed areas or the whole screen
		// to the dirty list.
		return new SpanMan(this.#textSpans, viewRect);
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
	
	render() : {newState:SpanMan, output:Iterable<DrawCommand>} {
		// For starters, just redraw the whole screen every time!
		// Which means there's no dirty list to bother with,
		// so we can return this same old spanman.
		return {
			newState: this,
			output: [
				{classRef:"x:ClearScreen"},
				...this.generateSpanOutput(this.#viewRect.worldX, this.#viewRect.worldY, this.#viewRect.screenX, this.#viewRect.screenY, this.#viewRect.width, this.#viewRect.height)
			],
		}
	}
}
