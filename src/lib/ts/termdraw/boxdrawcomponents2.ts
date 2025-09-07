// Stuff involving both BoxDrawr *and* components2 stuff

import { LineStyle } from './boxcharprops.ts';
import BoxDrawr from './BoxDrawr.ts';
import { makeChildBorderGenerator } from './components2.ts';
import { Style } from './TextRaster2.ts';

export function makeChildLineBorderGenerator(lineStyle:LineStyle, charStyle:Style) {
	return makeChildBorderGenerator(maskRast => {
		const w = maskRast.size.x, h = maskRast.size.y;
		const boxDrawr = new BoxDrawr(w, h);
		let i=0;
		for( let y=0; y<h; ++y ) {
			for( let x=0; x<w; ++x, ++i ) {
				const maskVal = maskRast.data[i] == 1;
				if( maskVal ) {
					if( x < w-1 ) {
						const rightVal = maskRast.data[i+1] == 1;
						if( rightVal ) {
							//throw new Error(`Draw a line from ${x},${y} to ${x+1},${y}!`);
							boxDrawr.addLine(x, y, x+1, y, lineStyle);
						}
					}
					if( y < h-1 ) {
						const downVal = maskRast.data[i+w] == 1;
						if( downVal ) {
							boxDrawr.addLine(x, y, x, y+1, lineStyle);
						}
					}
				}
			}
		}
		return boxDrawr.contentToRaster(charStyle);
	});
}
