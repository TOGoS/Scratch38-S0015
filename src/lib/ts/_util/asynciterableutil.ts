// deno-lint-ignore no-explicit-any
export function isAsyncIterable<T>(iter:AsyncIterable<T>|any) : iter is AsyncIterable<T> {
	return iter[Symbol.asyncIterator] != undefined;
}

async function* syncToAsyncIterable<T>(iter:Iterable<T>) : AsyncIterable<T> {
	for( const item of iter ) yield item;
}

export function toAsyncIterable<T>(iter:AsyncIterable<T>|Iterable<T>) : AsyncIterable<T> {
	if( isAsyncIterable(iter) ) return iter;
	return syncToAsyncIterable(iter);
}

export async function toList<T>(iter:AsyncIterable<T>|Iterable<T>) : Promise<T[]> {
	if( isAsyncIterable(iter) ) {
		const arr : T[] = [];
		for await( const item of iter ) arr.push(item);
		return arr;
	} else {
		return [...iter];
	}
}

export async function* toBytes(chunks : AsyncIterable<Uint8Array>) {
	for await( const chunk of chunks ) {
		for( const byte of chunk ) {
			yield byte;
		}
	}
}

export async function* toChunks(data:string|Uint8Array) : AsyncIterable<Uint8Array> {
	yield typeof(data) == 'string' ? new TextEncoder().encode(data) : data;
}
