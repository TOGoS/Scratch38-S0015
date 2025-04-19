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

function drawBox() {
	console.clear();
	const nocolor = '\x1b[0m';
	const color = colors[colorIndex];
	console.log(`┌────────────┐`);
	console.log(`│ ${color}Hello TUI!${nocolor} │`);
	console.log(`└────────────┘`);
}

function updateColor() {
	colorIndex = (colorIndex + 1) % colors.length;
	drawBox();
}

drawBox();
setInterval(updateColor, 1000);
