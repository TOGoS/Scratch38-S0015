import * as ansicodes from 'https://deno.land/x/tui@2.1.11/src/utils/ansi_codes.ts';

// tuidemo1.ts
const colors = [
	"\x1b[31m", // Red
	"\x1b[32m", // Green
	"\x1b[33m", // Yellow
	"\x1b[34m", // Blue
	"\x1b[35m", // Magenta
	"\x1b[36m", // Cyan
];

let colorIndex = 0;

const textEncoder = new TextEncoder();

function clear() : Promise<unknown> {
	return Deno.stdout.write(textEncoder.encode('\x1b[0J'));
}
function moveToTop() : Promise<unknown> {
	return Deno.stdout.write(textEncoder.encode('\x1b[1;1H'));
}
function lawg(str:string) : Promise<unknown> {
	return Deno.stdout.write(textEncoder.encode(str+"\n"));
}

async function drawBox() {
	await moveToTop();
	
	const nocolor = '\x1b[0m';
	const color = colors[colorIndex];
	await lawg(`┌────────────┐`);
	await lawg(`│ ${color}Hello TUI!${nocolor} │`);
	await lawg(`└────────────┘`);
}
function updateColor() {
	colorIndex = (colorIndex + 1) % colors.length;
	drawBox();
}

async function enterTui() {
	await Deno.stdin.setRaw(true);
	await Deno.stdout.write(textEncoder.encode(ansicodes.USE_SECONDARY_BUFFER + ansicodes.HIDE_CURSOR));
}

async function exitTui() {
	await Deno.stdin.setRaw(false);
	await Deno.stdout.write(textEncoder.encode(ansicodes.USE_PRIMARY_BUFFER + ansicodes.SHOW_CURSOR));
}

await enterTui();
lawg("Lawg!");
drawBox();
setInterval(updateColor, 1000);

async function quit() {
	await exitTui();
	Deno.exit(1);
}

// See tui/src/input_reader/mod.ts for hints on handling input
for await( const buf of Deno.stdin.readable ) {
	for( const byte of buf ) {
		if( byte == 113 ) { // 'q'
			console.log(`# Bye bye!`);
			quit();
		} else {
			exitTui();
			console.log(`# You said ${byte}; Goodbye!`);
			Deno.exit(0);
		}
	}
}

// Note: If debugging in the 'debug console' of Visual Studio Code, you'll get console.whatever,
// but not things written to Deno.stdout!  Bah!
