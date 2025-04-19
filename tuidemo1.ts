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

console.log("Clearing screen...");
console.clear();
console.log("DONE CLEARING");
lawg("Lawg!");
drawBox();
setInterval(updateColor, 1000);

// Note: If debugging in the 'debug console' of Visual Studio Code, you'll get console.whatever,
// but not things written to Deno.stdout!  Bah!
