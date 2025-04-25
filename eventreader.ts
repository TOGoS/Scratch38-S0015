import { KeyPressEvent, MouseEvent, MousePressEvent, MouseScrollEvent } from "https://deno.land/x/tui@2.1.11/src/input_reader/types.ts";
import { toAsyncIterable, toList } from "./src/lib/ts/asynciterableutil.ts";
import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";

async function* toBytes(chunks : Iterable<Uint8Array>) {
	for await( const chunk of chunks ) {
		for( const byte of chunk ) {
			yield byte;
		}
	}
}

interface KeyEvent {
	type: "Key",
	text: string,
	char: string,
	shift: boolean,
	control: boolean,
}


interface EscapeSequence {
	type: "EscapeSequence",
	code1 : string; // The character directly following the escape
	params : number[];
	code2? : string; // The character following the parameters, if any
}
type Charish = number | EscapeSequence | null;

const EMPTY_PARAMS : number[] = [];

//// Peekable iterable

class Peekeratable<T, TReturn=any, TNext=any> implements AsyncIterator<T, TReturn, TNext> {
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

//// Messing around with idea of using infinite linked lists
// so that I could pretend I'm writing a lisp program or something

interface EmptyLinkedList {
	isEmpty: true;
}
interface NonEmptyAsyncLinkedList<T> {
	isEmpty : false;
	head : T;
	tail : PromiseLike<AsyncLinkedList<T>>;
}
type AsyncLinkedList<T> = EmptyLinkedList | NonEmptyAsyncLinkedList<T>;
const NIL : EmptyLinkedList = Object.freeze({ isEmpty: true });

async function toAsyncLinkedList<T>(iter:AsyncIterator<T>) : Promise<AsyncLinkedList<T>> {
	const next = await iter.next();
	return next.done ? NIL : {isEmpty: false, head: next.value, tail: toAsyncLinkedList(iter) };
}
function asyncCons<T>(head:T, tail:PromiseLike<AsyncLinkedList<T>>) : AsyncLinkedList<T> {
	return {isEmpty: false, head, tail};
}
class LazyPromise<T> implements PromiseLike<T> {
	#wrapped  : PromiseLike<T>|undefined;
	#generate : ()=>PromiseLike<T>;
	#getWrapped() {
		if( this.#wrapped == undefined ) this.#wrapped = this.#generate();
		return this.#wrapped;
	}
	constructor(generate:()=>PromiseLike<T>) {
		this.#generate = generate;
	}
	then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2> {
		return this.#getWrapped().then(onfulfilled, onrejected);
	};
}

async function parseCharishes(bytes:AsyncLinkedList<number>) : Promise<AsyncLinkedList<Charish>> {
	if( bytes.isEmpty ) return Promise.resolve(NIL);
	if( bytes.head != 0x1b ) {
		const {head, tail} = bytes;
		return Promise.resolve(
			asyncCons(head, new LazyPromise( () => tail.then(parseCharishes) ))
		);
	}
	bytes = await bytes.tail;
	throw new Error("TODO");
}



async function readCharish(byteStream:Peekeratable<number>) : Promise<Charish> {
	const esc = await byteStream.next();
	if( esc.done ) {
		return null;
	} else if( esc.value != 0x1b ) {
		return esc.value;
	}
	const code1 = await byteStream.next();
	if( code1.done ) {
		return null;
	} else if( code1.value == 91 ) { // '['
		throw new Error("TODO: read [ escape sequence");
	}
	throw new Error("TODO: readEscapeSequence");
}

async function* toCharishes(byteStream:AsyncIterable<number>, includeEof:boolean=false) : AsyncIterable<Charish> {
	const iter = new Peekeratable(byteStream[Symbol.asyncIterator]());
	while( true ) {
		const charish = await readCharish(iter);
		if( charish == null ) {
			return;
		} else {
			yield(charish);
		}
	}
}

Deno.test("read some regular charishes", async () => {
	const input = new TextEncoder().encode("abc123");
	const charishes = await toList(toCharishes(toAsyncIterable(input)));
	assertEquals([...input], charishes);
});
Deno.test("read an escape sequence", async () => {
	const input = new TextEncoder().encode("\x1b[11~");
	const charishes = await toList(toCharishes(toAsyncIterable(input)));
	assertEquals([{type: "EscapeSequence", code1: "[", params: [11], code2: "~"}], charishes);
});

function charishToInputEvent(charish:Charish) : KeyEvent {
	throw new Error("TODO: charishToInputEvent");
}

async function* inputEvents(chunks : Iterable<Uint8Array>) : AsyncIterable<KeyEvent> {
	const bytes = toBytes(chunks);
	for await( const charish of toCharishes(bytes) ) {
		yield charishToInputEvent(charish);
	}
}

Deno.test("read some regular key events", () => {
	
});
