import { assert, assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import DrawCommand from "../../lib/ts/termdraw/DrawCommand.ts";
import TextRaster, { TextLine, TextSpan } from "../../lib/ts/termdraw/TextRaster.ts";

// Note: It might all be a lot simpler
// if I actually just stored everything as a bitmap!

function sliceSpan(span:TextSpan, start:number, length:number) : TextSpan {
	if( span.classRef == "x:VisibleTextSpan" ) {
		return {
			classRef: "x:VisibleTextSpan",
			style: span.style,
			text: span.text.substring(start, start + length)
		};
	} else if( span.classRef == "x:BlankSpan" ) {
		return {
			classRef: "x:BlankSpan",
			length
		};
	} else {
		throw new Error("Unknown span type in sliceSpan: " + JSON.stringify(span));
	}
}

Deno.test("slice simple span", () => {
	assertEquals(
		sliceSpan(
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" },
			0, 5
		),
		{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" }
	)
});
Deno.test("slice beginning of span", () => {
	assertEquals(
		sliceSpan(
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello, world!" },
			0, 5
		),
		{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" }
	)
});
Deno.test("slice  end of span", () => {
	assertEquals(
		sliceSpan(
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello, world!" },
			7, 6
		),
		{ classRef: "x:VisibleTextSpan", style: "default", text: "world!" }
	)
});
Deno.test("slice middle end of span", () => {
	assertEquals(
		sliceSpan(
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello, world!" },
			1, 4
		),
		{ classRef: "x:VisibleTextSpan", style: "default", text: "ello" }
	)
});

// TODO: Pass in a text span to allow blank spots to be added
function blitToLine(line:TextLine, lineLength:number, insertX:number, insertText:string, insertStyle:string) : TextLine {
	if( insertX >= lineLength || insertX + insertText.length <= 0 ) {
		return line; // Insertion is completely outside the line, return original line
	}

	let insertLength = insertText.length;

	// Trim the inserted text to fit within the line:
	if( insertX < 0 ) {
		insertLength += insertX; // If insertX is negative, we need to adjust the length
		insertText = insertText.substring(-insertX);
		insertX = 0; // Adjust insertX to 0
	}
	if( insertX + insertLength > lineLength ) {
		insertLength = lineLength - insertX;
		insertText = insertText.substring(0, insertLength);
	}
	
	// If somehow we ended up with no text to insert, just return the original line
	if( insertLength == 0 ) return line; // Nothing to insert, return original line
	
	const insertSpan : TextSpan = {
		classRef: "x:VisibleTextSpan",
		style: insertStyle,
		text: insertText
	};
	
	const newSpans : TextSpan[] = [];
	let x = 0;
	let inserted = false;
	let spanX0 = 0;	
	const insertX1 = insertX + insertLength;
	for( const span of line.spans ) {
		const spanLength = (span.classRef == "x:BlankSpan" ? span.length : span.text.length);
		const spanX1 = spanX0 + spanLength;
		if( spanX1 <= x ) {
			// Span has been entirely skipped
		} else if( insertX >= spanX1 || insertX1 <= spanX0 ) {
			// No overlap; just copy this span
			newSpans.push(span);
			x = spanX1;
		} else {
			// There is overlap, either before, after, or both
			assert(insertX < spanX1);
			
			const beforeLength = insertX - x;
			if( beforeLength > 0 ) {
				newSpans.push(sliceSpan(span, 0, beforeLength));
				x += beforeLength; // Move x forward by the length of the before part
			}
			
			if( !inserted ) {
				assert(x == insertX);
				newSpans.push(insertSpan);
				inserted = true;
				x += insertLength; // Move x forward by the length of the inserted text
			}
			
			assert(x >= spanX0);
			if( x < spanX1 ) {
				newSpans.push(sliceSpan(span, x - spanX0, spanX1 - x));
				x = spanX1;
			}
		}
		// In any case, X0 of next span = X1 of this one
		spanX0 = spanX1;
	}
	if( !inserted ) {
		// Must go at the end
		const beforeLength = insertX - x;
		if( beforeLength > 0 ) {
			newSpans.push({
				classRef: "x:BlankSpan",
				length: beforeLength
			});
			x += beforeLength; // Move x forward by the length of the blank span
		}
		
		newSpans.push(insertSpan);
	}
	
	return { spans: newSpans };
}

// TODO: Pass in a text span to allow blank spots to be added
function blitToRaster(raster:TextRaster, x:number, y:number, text:string, style:string) : TextRaster {
	if( y < 0 || y >= raster.height ) return raster; // Out of bounds
	if( x < 0 || x >= raster.width ) return raster; // Out of bounds

	const oldLine = raster.lines[y];
	const newLine = blitToLine(oldLine, raster.width, x, text, style);
	if( newLine == oldLine ) return raster; // No change in this line, return original raster
		
	return {
		...raster,
		lines: [
			...raster.lines.slice(0, y),
			newLine,
			...raster.lines.slice(y + 1)
		],
	};
}

function testInsert(
	expectedResultLine:TextLine,
	originalLine:TextLine, lineLength:number,
	insertX:number, insertText:string, insertStyle:string
) {
	const actualResultLine = blitToLine(originalLine, lineLength, insertX, insertText, insertStyle);
	assertEquals(actualResultLine, expectedResultLine);
}
function testNoInsert(
	originalLine:TextLine, lineLength:number,
	insertX:number, insertText:string, insertStyle:string
) {
	const actualResultLine = blitToLine(originalLine, lineLength, insertX, insertText, insertStyle);
	assertEquals(actualResultLine, originalLine);
}

Deno.test("blit nothing to line", () => testNoInsert(
	{
		spans: [
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" },
			{ classRef: "x:BlankSpan", length: 3 },
			{ classRef: "x:VisibleTextSpan", style: "default", text: "World" }
		]
	}, 13, 4, "", "blorf")
);
Deno.test("blit before beginning", () => testNoInsert(
	{
		spans: [
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" },
			{ classRef: "x:BlankSpan", length: 3 },
			{ classRef: "x:VisibleTextSpan", style: "default", text: "World" }
		]
	}, 13, -4, "abcd", "blorf")
);
Deno.test("blit after end", () => testNoInsert(
	{
		spans: [
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" },
			{ classRef: "x:BlankSpan", length: 3 },
			{ classRef: "x:VisibleTextSpan", style: "default", text: "World" }
		]
	}, 13, 13, "abcd", "blorf")
);
Deno.test("replace entire single-span line", () => testInsert(
	{
		spans: [
			{ classRef: "x:VisibleTextSpan", style: "blorf", text: "kekek" },
		]
	},
	{
		spans: [
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" },
		]
	}, 5, 0, "kekek", "blorf")
);
Deno.test("blit covering multiple spans", () => testInsert(
	{
		spans: [
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hell" },
			{ classRef: "x:VisibleTextSpan", style: "blorf", text: "kekek" },
			{ classRef: "x:VisibleTextSpan", style: "default", text: "orld" }
		]
	}, {
		spans: [
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" },
			{ classRef: "x:BlankSpan", length: 3 },
			{ classRef: "x:VisibleTextSpan", style: "default", text: "World" }
		]
	}, 13, 4, "kekek", "blorf")
);
Deno.test("blit in the middle of one span", () => testInsert(
	{
		spans: [
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" },
			{ classRef: "x:BlankSpan", length: 1 },
			{ classRef: "x:VisibleTextSpan", style: "blorf", text: "k" },
			{ classRef: "x:BlankSpan", length: 1 },
			{ classRef: "x:VisibleTextSpan", style: "default", text: "World" }
		]
	}, {
		spans: [
			{ classRef: "x:VisibleTextSpan", style: "default", text: "Hello" },
			{ classRef: "x:BlankSpan", length: 3 },
			{ classRef: "x:VisibleTextSpan", style: "default", text: "World" }
		]
	}, 13, 6, "k", "blorf")
);

function* rasterToDrawCommands(raster:TextRaster) : Iterable<DrawCommand> {
	for(let y = 0; y < raster.height; y++) {
		const line = raster.lines[y];
		let x = 0;
		for(const span of line.spans) {
			if(span.classRef == "x:BlankSpan") {
				x += span.length;
				yield { classRef:"x:Move", x, y:y };
			} else if(span.classRef == "x:VisibleTextSpan") {
				x += span.text.length;
				yield { classRef:"x:EmitText", text:span.text };
			} else {
				throw new Error("Unknown span type in raster: " + JSON.stringify(span));
			}
		}
	}
}

function* rasterDiffToDrawCommands(prevRaster:TextRaster, newRaster:TextRaster) : Iterable<DrawCommand> {
	if(prevRaster.width != newRaster.width || prevRaster.height != newRaster.height) {
		yield { classRef:"x:ClearScreen" };
		for(const dc of rasterToDrawCommands(newRaster)) {
			yield dc;
		}
	} else {
		for(let y = 0; y < newRaster.height; y++) {
			const prevLine = prevRaster.lines[y];
			const newLine = newRaster.lines[y];
			if(prevLine == newLine) continue; // No change in this line, skip it
			
			let x = 0;
			for(const span of newLine.spans) {
				if(span.classRef == "x:BlankSpan") {
					x += span.length;
					yield { classRef:"x:Move", x, y:y };
				} else if(span.classRef == "x:VisibleTextSpan") {
					x += span.text.length;
					yield { classRef:"x:EmitText", text:span.text };
				} else {
					throw new Error("Unknown span type in raster diff: " + JSON.stringify(span));
				}
			}
		}
	}
}

// TODO: A function to apply DrawCommands to a raster, so this can all be nice and symmetric.

