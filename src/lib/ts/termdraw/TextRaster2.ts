export type Character = string;
export type Style = string;

export default interface TextRaster2 {
	width : number;
	height: number;
	chars  : Character[][];
	styles : Style[][];
}
