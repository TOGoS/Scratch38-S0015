// deno-lint-ignore no-explicit-any
export default class Peekerator<T, TReturn=any, TNext=any> implements AsyncIterator<T, TReturn, TNext> {
	#queued : T[] = [];
	#wrapped : AsyncIterator<T>;
	constructor(wrapped:AsyncIterator<T>) {
		this.#wrapped = wrapped;
	}
	
	unshift(item:T) {
		this.#queued.unshift(item);
	}
	next(...whatever: [] | [TNext]): Promise<IteratorResult<T, TReturn>> {
		const shifted = this.#queued.shift();
		if( shifted != undefined ) {
			return Promise.resolve({done: false, value: shifted});
		} else {
			return this.#wrapped.next(...whatever);
		}
	}
}
