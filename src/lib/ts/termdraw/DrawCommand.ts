import PSTextSpan from './PSTextSpan.ts';

export type DrawCommand = {
	classRef: "x:ClearScreen",
} | {
	classRef: "x:Move",
	x:number, y:number
} | {
	classRef: "x:EmitText",
	text: string // If this includes escape codes, the handler had better escape them somehow!
} | PSTextSpan | {
	classRef: "x:EmitLiteral",
	sequence: string // Handler should emit this directly without escaping
};

export default DrawCommand;
