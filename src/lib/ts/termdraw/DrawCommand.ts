import PSTextSpan from './PSTextSpan.ts';

export type DrawCommand = {
	classRef: "x:ClearScreen",
} | {
	classRef: "x:Move",
	x:number, y:number
} | {
	classRef: "x:EmitText",
	text: string // If this includes escape codes, you'd better escape them somehow!
} | PSTextSpan | {
	classRef: "x:EmitLiteral",
	sequence: string
};

export default DrawCommand;
