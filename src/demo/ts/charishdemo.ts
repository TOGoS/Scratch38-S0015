import { toBytes } from 'https://deno.land/x/scratch38s15@0.0.5/src/lib/ts/_util/asynciterableutil.ts';
import { toCharishes } from 'https://deno.land/x/scratch38s15@0.0.5/src/lib/ts/terminput/escapeparser.ts';

try {
	console.log("Welcome.  Press some keys if you'd like.  Hit 'q' or control+'c' to quit.");
	Deno.stdin.setRaw(true);
	for await( const charish of toCharishes(toBytes(Deno.stdin.readable)) ) {
		console.log(`Read charish: ${JSON.stringify(charish)}`);
		if( charish == 113 || charish == 3 ) { // 'q' or ctrl+'c'
			console.log("Goodbye!");
			break;
		}
	}
} finally {
	Deno.stdin.setRaw(false);
}
