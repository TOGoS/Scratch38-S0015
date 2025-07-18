import Vec2D from "./Vec2D.ts";

export type Character = string;
export type Style = string;

export default interface TextRaster2 {
	size : Vec2D<number>;
	chars  : Character[][];
	styles : Style[][];
}
