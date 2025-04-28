
import { inputEvents } from '../../lib/ts/terminput/inputeventparser.ts';

Deno.stdin.setRaw(true);
console.log(`pid ${Deno.pid}`);
try {
	console.log("# Welcome to input event reader demo.  Type 'q' or control+'c' to quit.")
	for await( const inputEvent of inputEvents(Deno.stdin.readable) ) {
		console.log(`charish ${JSON.stringify(inputEvent.charish)}   ->  ${JSON.stringify(inputEvent)}`);
		if( inputEvent.key == "q" ) {
			console.log("# Goodbye!");
			break;
		} else if( inputEvent.key == "c" && inputEvent.ctrlKey ) {
			console.log("# See ya!");
			break;
		}
	}
} finally {
	Deno.stdin.setRaw(false);
}
