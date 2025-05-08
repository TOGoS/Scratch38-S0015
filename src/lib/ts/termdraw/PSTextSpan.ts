export default interface PSTextSpan {
	classRef: "x:PSTextSpan",
	x:number;
	y:number;
	z:number;
	style:string;
	text:string;
	width:number; // Width in visible characters; text.length may be reasonable approximation for starters
}

export const EMPTY_SPAN : PSTextSpan = {
	classRef: "x:PSTextSpan",
	x:0, y:0, z:0,
	style: "", text: "", width: 0,
};
