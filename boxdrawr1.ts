export class BoxDrawr {
	#width : number;
	#height : number;
	#horiz : Uint8Array;
	#vertz : Uint8Array;
	constructor(width:number, height:number) {
		this.#width = width;
		this.#height = height;
		this.#horiz = new Uint8Array(new ArrayBuffer(height * (width+1)));
		this.#vertz = new Uint8Array(new ArrayBuffer(width * (height+1)));
	}
	charAt(x:number, y:number) : string {
		const up    = this.#vertz[    x +  y   * this.#width   ];
		const down  = this.#vertz[    x + (y+1)* this.#width   ];
		const left  = this.#horiz[    x +  y   *(this.#width+1)];
		const right = this.#horiz[1 + x +  y   *(this.#width+1)];
		
	}
}
