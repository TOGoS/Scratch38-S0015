import Colspan from './Colspan.ts';

function* mergeSpans1(a:Colspan[], ai:number, b:Colspan[], bi:number) : Iterable<Colspan> {
	if( ai == a.length && bi == b.length ) return;
	
	let current : Colspan;
	if( ai == a.length ) {
		current = b[bi++];
	} else if( bi == b.length ) {
		current = a[ai++];
	} else if( a[ai].x0 < b[bi].x0 ) {
		current = a[ai++];
	} else {
		current = b[bi++];
	}
	
	while(ai < a.length || bi < b.length) {
		let next : Colspan;
		if( ai == a.length ) {
			next = b[bi++];
		} else if( bi == b.length ) {
			next = a[ai++];
		} else if( a[ai].x0 < b[bi].x0 ) {
			next = a[ai++];
		} else {
			next = b[bi++];
		}
		
		if( current.x1 < next.x0 ) {
			// Yield current!
			yield current;
			current = next;
		} else if( current.x0 >= next.x0 && current.x1 <= next.x1 ) {
			// Skip current!
			current = next;
		} else if( next.x0 >= current.x0 && next.x1 <= current.x1 ) {
			// Skip next!
		} else {
			// Merge 'em!
			current = {
				x0: Math.min(current.x0, next.x0),
				x1: Math.max(current.x1, next.x1),
			};
		}
	}
	
	yield current;
}

export function mergeSpans(a:Colspan[], b:Colspan[]) : Iterable<Colspan> {
	return mergeSpans1(a,0,b,0);
}
