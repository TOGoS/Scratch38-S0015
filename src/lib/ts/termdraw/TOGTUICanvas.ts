import * as ansicodes from 'https://deno.land/x/tui@2.1.11/src/utils/ansi_codes.ts';

export type TOGTUIRenderer = (writer:WritableStreamDefaultWriter) => Promise<unknown>;

const textEncoder = new TextEncoder();

export default class TOGTUICanvas {
	#redrawTimeout : number|undefined = undefined;
	#out : WritableStreamDefaultWriter;
	#writeProm : Promise<unknown> = Promise.resolve();
	#renderer : TOGTUIRenderer;
	#state : "off"|"starting"|"on"|"stopping" = "off";
	
	constructor(
		out:WritableStreamDefaultWriter,
		renderer: TOGTUIRenderer
	) {
		this.#state = "off";
		this.#out = out;
		this.#renderer = renderer;
	}
	
	get state() {
		return this.#state;
	}
	
	#write(stuff:string|Uint8Array) : Promise<unknown> {
		if( typeof(stuff) == "string" ) {
			stuff = textEncoder.encode(stuff);
		}
		return this.#writeProm = this.#writeProm.then(
			() => this.#out.write(stuff)
		);
	}
	
	async draw() {
		if( this.#state != "on" ) return;
		await this.#out;
		await this.#renderer(this.#out);
	}
	
	async enterTui() {
		if( this.#state != "off" ) throw new Error(`Can't start canvas; state = ${this.#state}`);
		this.#state = "starting";
		await this.#write(ansicodes.USE_SECONDARY_BUFFER + ansicodes.HIDE_CURSOR);
		this.#state = "on";
		this.requestRedraw();
	}
	async exitTui() {
		if( this.#redrawTimeout ) clearTimeout(this.#redrawTimeout);
		if( this.#state != "on" ) throw new Error(`Can't exit canvas; state = ${this.#state}`);
		this.#state = "stopping";
		await this.#write(ansicodes.USE_PRIMARY_BUFFER + ansicodes.SHOW_CURSOR);
		this.#state = "off";
	}
	
	requestRedraw() {
		if( this.#redrawTimeout != undefined ) return;
		this.#redrawTimeout = setTimeout(async () => {
			try {
				await this.draw();
			} finally {
				this.#redrawTimeout = undefined;
			}
		}, 5); // Or 0, but 5 for extra debounciness
	}
}
