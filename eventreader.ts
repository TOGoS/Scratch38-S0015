
import { inputEvents } from './src/lib/ts/inputeventparser.ts';

Deno.stdin.setRaw(true);
console.log(`pid ${Deno.pid}`);
try {
	console.log("# Welcome to input event tester.  Type 'q' or control+'c' to quit.")
	for await( const inputEvent of inputEvents(Deno.stdin.readable) ) {
		console.log(`charish ${JSON.stringify(inputEvent.charish)}   ->  ${JSON.stringify(inputEvent)}`);
		if( inputEvent.char == "q" ) {
			console.log("# Goodbye!");
			break;
		} else if( inputEvent.lowercaseChar == "c" && inputEvent.control ) {
			console.log("# See ya!");
			break;
		}
	}
} finally {
	Deno.stdin.setRaw(false);
}
