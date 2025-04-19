import { crayon } from "https://deno.land/x/crayon@3.3.3/mod.ts";
import { Tui,  handleInput, handleKeyboardControls, handleMouseControls, Signal, Computed } from "https://deno.land/x/tui@2.1.11/mod.ts";
import { Button } from "https://deno.land/x/tui@2.1.11/src/components/mod.ts";

const tui = new Tui({             // 1
	style: crayon.bgBlack,
	refreshRate: 1000 / 60,
});

handleInput(tui);                 // 2
handleMouseControls(tui);
handleKeyboardControls(tui);

tui.dispatch();                   // 3
tui.run();                        // 4

const number = new Signal(0);     // 5

const button = new Button({       // 6
	parent: tui,
	zIndex: 0,
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
