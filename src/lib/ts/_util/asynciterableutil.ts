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

/**
 * Create an async iterable that yields the items of each of the passed-in async iterables
 * as they become available.
 * 
 * Mostly copied from https://stackoverflow.com/questions/50585456/how-can-i-interleave-merge-async-iterables
 */
export async function* mergeAsyncIterables<T>(iterables : Iterable<AsyncIterable<T>>) : AsyncIterable<T> {
	
	const asyncIterators = Array.from(iterables, o => o[Symbol.asyncIterator]());
	const results = [];
	let count = asyncIterators.length;
	const never = new Promise<never>(() => {});
	function getIndexedNext(asyncIterator : AsyncIterator<T>, index : number) {
		return asyncIterator.next().then(result => ({ index, result }));
	}
	const indexedNextPromises = asyncIterators.map(getIndexedNext);
	try {
		while (count) {
			const {index, result} = await Promise.race(indexedNextPromises);
			if (result.done) {
				indexedNextPromises[index] = never;
				results[index] = result.value;
				--count;
			} else {
				indexedNextPromises[index] = getIndexedNext(asyncIterators[index], index);
				yield result.value;
			}
		}
	} finally {
		for (const [index, iterator] of asyncIterators.entries())
			if (indexedNextPromises[index] != never && iterator.return != null)
				iterator.return();
		// no await here - see https://github.com/tc39/proposal-async-iteration/issues/126
	}
	return results;
}

/** Call the callback for each item, then return the return value of the iterable */
export async function iterateAndReturn<I,R>(iterable:AsyncIterable<I,R>, itemCallback: (item:I) => unknown) : Promise<R> {
	const iterator = iterable[Symbol.asyncIterator]();
	let entry = await iterator.next();
	while( !entry.done ) {
		await itemCallback(entry.value);
		entry = await iterator.next();
	}
	return entry.value;
}
