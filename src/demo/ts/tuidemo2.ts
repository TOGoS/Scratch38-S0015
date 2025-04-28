// Messing around with the 'tui' library

import { crayon } from "https://deno.land/x/crayon@3.3.3/mod.ts";
import { Tui,  handleInput, handleKeyboardControls, handleMouseControls, Signal, Computed, SignalOfObject, Rectangle } from "https://deno.land/x/tui@2.1.11/mod.ts";
import { Button, Frame } from "https://deno.land/x/tui@2.1.11/src/components/mod.ts";
import { TextBox } from "https://deno.land/x/tui@2.1.11/src/components/textbox.ts";

const tui = new Tui({             // 1
	style: crayon.bgBlack,
	refreshRate: 1000 / 60,
});

handleInput(tui);                 // 2
handleMouseControls(tui);
handleKeyboardControls(tui);

tui.dispatch();                   // 3
tui.run();                        // 4

tui.on("destroy", () => {
	console.log("# Goodbye!");
});

let sizeRecomputationCountBox : TextBox|undefined = undefined;
let sizeRecomputationCount = 0;
const popupFrameSize : SignalOfObject<Rectangle> = new Computed(() => {
	const canvasSize = tui.canvas.size.value;
	// IT SEEMS THAT requesting some signal.value within a Computed
	// automatically registers this computed as depending on those signals.
	// I don't really like this, and would prefer something more 'monadic',
	// (and less 'magical') like signal.then(value => computation).  But okay.
	++sizeRecomputationCount;
	if( sizeRecomputationCountBox ) {
		sizeRecomputationCountBox.text.value = ""+sizeRecomputationCount;
	}
	return {
		column: 5, row: 5,
		width: canvasSize.columns - 8,
		height: canvasSize.rows - 8,
	}
});

const popupFrame = new Frame({
	parent: tui,
	charMap: "sharp",
	theme: {
		base: crayon.bgBlack
	},
	zIndex: 10,
	rectangle: popupFrameSize,
	visible: false,
});
sizeRecomputationCountBox = new TextBox({
	parent: popupFrame,
	theme: {
		cursor: {
			active: (text:string) => text,
			disabled: (text:string) => text,
		}
	},
	rectangle: new Computed(() => {
		return {
			row: popupFrame.rectangle.value.row+1, column: popupFrame.rectangle.value.column+1,
			width: 20, height: 1,
		}
	}),
	zIndex: 1,
	text: "hi",
	visible: false, // Doesn't inherit from parent until parent changes
});

tui.on("keyPress", (keyPressEvent) => {
	if( keyPressEvent.key == "escape" ) {
		popupFrame.visible.value = !popupFrame.visible.value;
	} else if( keyPressEvent.key == "q" ) {
		// tui.destroy() doesn't seem to clean up enough
		// for the process to exit.  tui.emit("destroy") call destroy()
		// and also do some other stuff, then Deno.exit(0).
		tui.emit("destroy");
	}
});

const number = new Signal(0);     // 5

const button = new Button({       // 6
	parent: tui,
	zIndex: 2,
	label: {
		text: new Computed(() => number.value.toString()),
	},
	theme: {
		base: crayon.bgRed,
		focused: crayon.bgLightRed,
		active: crayon.bgYellow,
	},
	rectangle: {
		column: 1,
		row: 1,
		height: 5,
		width: 10,
	},
});

button.state.subscribe((state) => {  // 7
	if (state === "active")  {
		++number.value;
	}
});

button.on("mousePress", ({ drag, movementX, movementY }) => { // 8
	if (!drag) return;

	// Use peek() to get signal's value when it happens outside of Signal/Computed/Effect
	const rectangle = button.rectangle.peek();
	rectangle.column += movementX;
	rectangle.row += movementY;
});
