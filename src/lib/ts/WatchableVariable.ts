export type ChangeEvent<T> = unknown;
export type ChangeListener<T> = (this:WatchableVariable<T>, event:ChangeEvent<T>) => unknown
export type ChangeListenerOptions = {
	immediate? : boolean // Fire immediately, as if value has just changed; default = true
}

export default interface WatchableVariable<T> {
	readonly value : T;
	addEventListener(type:"change", listener : ChangeListener<T>, opts:ChangeListenerOptions) : void;
	removeEventListener(type:"change", listener : ChangeListener<T>) : void;
}

type InternalUpdater<T> = (sig:AbortSignal, setter: (value:T)=>void) => void;

type ValueEqualityTester<T> = (a:T, b:T) => boolean;

const DEFAULT_VALUE_EQUALITY_TESTER : ValueEqualityTester<unknown> = (a,b) => (a == b);

const changeListenerArgs : [unknown] = [undefined];

class ReadonlyWatchableVariable<T> implements WatchableVariable<T> {
	#value : T;
	#changeListeners = new Set<ChangeListener<T>>();
	#valueEqualityTester : ValueEqualityTester<T>;
	#abortController = new AbortController();
	constructor(
		initialValue:T,
		internalUpdater: InternalUpdater<T> = ()=>{},
		valueEqualityTester : ValueEqualityTester<T> = DEFAULT_VALUE_EQUALITY_TESTER
	) {
		this.#value = initialValue;
		this.#valueEqualityTester = valueEqualityTester;
		internalUpdater(this.#abortController.signal, v => {
			this.#value = v;
			for( const l of this.#changeListeners ) {
				l.apply(this, changeListenerArgs);
			}
		})
	}
	get value() { return this.#value; }
	addEventListener(_type: "change", listener: ChangeListener<T>, opts: ChangeListenerOptions): void {
		this.#changeListeners.add(listener);
		if( opts.immediate ?? true ) {
			listener.apply(this, changeListenerArgs);
		}
	}
	removeEventListener(_type: "change", listener: ChangeListener<T>): void {
		this.#changeListeners.delete(listener);
	}
	stop() {
		this.#abortController.abort();
	}
}

export function makeReadonlyWatchable<T>(
	initialValue:T,
	internalUpdater: InternalUpdater<T> = ()=>{},
	valueEqualityTester : ValueEqualityTester<T> = DEFAULT_VALUE_EQUALITY_TESTER
) {
	return new ReadonlyWatchableVariable(initialValue, internalUpdater, valueEqualityTester);
}
