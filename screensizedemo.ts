function updateConsoleSize() {
	const {columns: w, rows: h} = Deno.consoleSize();
	console.log(`Console size: ${w} x ${h}`);
}

Deno.addSignalListener("SIGWINCH", updateConsoleSize);
updateConsoleSize();

console.log("Requesting screen size...\x1b[18t");

async function* toBytes(chunks:AsyncIterable<Uint8Array>) {
	for await(const chunk of chunks) {
		console.log("Read "+chunk.length+" bytes from stdin: " + [...chunk].map(x => `0x${x.toString(16)}`).join(','));
		for( const byte of chunk ) {
			yield byte;
		}
	}
}

const byteIter = toBytes(Deno.stdin.readable);
let next;
while( !(next = await byteIter.next()).done ) {
	const byte = next.value;
	if( byte == 0x1b ) {
		// const seq = readEscape(byteIter);
		// Blah blah blah
	}
}
