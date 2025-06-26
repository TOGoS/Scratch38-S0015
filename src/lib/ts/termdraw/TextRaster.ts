export type TextSpan = {
	classRef: "x:VisibleTextSpan";
	style  : string;
	text   : string;
} | {
	// Represents a gap in the raster. i.e. a transparent spot.
	classRef: "x:BlankSpan";
	length : number;
}

export interface TextLine {
	spans : readonly TextSpan[];
}

export interface TextRaster {
	width : number;
	height: number;
	lines : readonly TextLine[];
}

export default TextRaster;
