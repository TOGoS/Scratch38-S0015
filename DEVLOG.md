## 2025-05-29

Brainstorming about component and rendering architecture.

At a high level, data flows between components thusly:

```

                        +----------+
         .------------->| terminal |<----text/escapes-.
         |              +----------+                  |
         |                                            |
         |  +------------+           +----------+     |
         '->| components |-- spans ->| span man |-----'
            |            |           +----------+
            |            |
            |            |-- other I/O actions ----->wherever
            +------------+
```

i.e. the system as a whole as modeled as a pipeline;
the components interact only by the indicated channels,
and could concievably be running concurrently
(the terminal itself is most likely a separate process).

When nothing is changing, no work should be done.
There's no fixed 'refresh rate' (though there may be a maximum refresh rate).

This is the conceptual model that I would like to stick with.

In practice, components and span man are immutable state
objects, and are probably updated in sequence in a big
main loop that bundles input events.

### Component model

TUI components know their size, but not their position,
and can be told to generate a `Map<SpanID,PSTextSpan>`
for themselves at a given position.

Hmm, but then if we have an enormous component tree and only
want to have to visit a small part of it, we can't, because
we always get the whole gigantic map.

Maybe 'a map' isn't what's in order, but a structure that
mirrors (potentially) the structure of the component graph.

Something like...

```
Renderable =
  | PSTextSpan
  | { classRef:"XForm",
      transforms : Transform[],
      renderables:{[k:string]: Renderable} ]
  | ...maybe some 'clip' renderable
```

The 'transformed' type does several jobs at once:
- groups renderables (maybe they are keye)
- allows changing position of renderables
- allows duplicating children at multiple positions

Each TUI component can render itself, returning one renderable.
This happens recursively from the root component.
A separate step will accept the new root renderable and
diff it against the previous one to generate a `Map<SpanID,Span>`
to feed to `SpanMan`.

The idea behind 'maybe some clip renderable' is to indicate some
axis-aligned bounding box that all contents will be clipped to.
This gives a later rendering step enough information to
ignore large chunks of the tree that are entirely disjoint
from the area being drawn.

### Tables

e.g. how to represent something like

```
+---------------+
| A             |
+--------+      |
| B      | C    |
+--------+------+
```

BoxDrawr can handle this, but how to represent it at a higher level,
assuming there are 3 logical cells?

```
Flexy{
	direction = "down",
	border = "single",
	items = [
		A,
		Flexy{
			direction = "right",
			border = "blank",
			items = [
				Flexy{
					border = "single",
					items = [ B ]
				},
				C
			]
		}
	]
}
```

Thicker borders override thinner borders of neighboring cells.

Might want to differentiate between border char and thickness;
here "blank" stands for 'one character thick', but invisible.
"none" would mean zero width.

I suppose borders could be specified separately for top/bottom/left/right
of each cell, similar to in HTML.

### Hmm

I started prototyping some code about `Renderable`s...

```typescript
interface TransformNode<T,C> {
	classRef: "x:TransformNode";
	transforms: T[];
	children: {[k:number]: C}
}
interface XYPosition { x:number; y:number };

type Renderable = PSTextSpan | TransformNode<XYPosition,Renderable>;
type SpanID = number;

function offsetPsTextSpan(offset: XYPosition, span: PSTextSpan): PSTextSpan {
	if (offset.x === 0 && offset.y === 0) return span;
	return {
		classRef: 'x:PSTextSpan',
		style: span.style,
		x: span.x + offset.x,
		y: span.y + offset.y,
		z: span.z,
		text: span.text,
		width: span.width
	};
}

function renderableToSpans(offset:XYPosition, id: SpanID, renderable : Renderable, into:Map<SpanID,PSTextSpan>) {
	if( renderable.classRef == 'x:PSTextSpan' ) {
		into.set(id, offsetPsTextSpan(offset, renderable));
	} else {
		for (const [childKey, childRenderable] of Object.entries(renderable.children)) {
			for (const ti in renderable.transforms) {
				const transform = renderable.transforms[ti];
				const childId = todo("how to generate child IDs, huh?");
				const newOffset = {
					x: offset.x + transform.x,
					y: offset.y + transform.y,
				};
				renderableToSpans(newOffset, childId, childRenderable, into);
			}
		}
	}
}
```

A problem became apparent: since the Renderable graph is
a directed graph, not a tree, leaf nodes can appear
multiple times, so I would need some way of generating
span IDs.

CoPilot helped fill in some of the easy bits and generated
some stuff by adding the transform ID multiplied by 1000 something,
but it had to `parseInt` the key, which wasn't great.

Maybe I shouldn't mess with span IDs at all.  Maybe SpanMan
should just take a `Set<PSTextSpan>` instead of a `Map<SpanID,PSTextSpan>`?

Or maybe I should take an entirely different approach,
using a big raster of character data instead of messing with
an updatable collection of spans.

Q: Why would a raster thingy be better than a collection of spans?

A: Because then we wouldn't have to care about span identity.
Components could "just blit themselves to the raster"
(which could, as a side-effect, track which sections got updated).

## 2025-06-11

More thoughts on component model and rendering.

The easy / simple / pure-functional approach should
probably start by just blitting everything to some raster every time.
Easy to diff the raster against the previous version
to generated updates to send to the terminal.

Want to track changes to individual widgets?
Then you have to know which widget is updated

Want to only update the part of the screen changed?
Then you need to know for each widget changed where it is on the screen.

Both of which is a bit at odds with the 'easy / pure functional' approach

Don't really need to bother with a component tree --
just re-render the whole TUI every time there's a change

OTHERWISE....if you want to be super efficient,
make components mutable objects that know when they need to be re-rendered,
and emit PSTextSpan patches.

This could also work, but is going to be messier.
It is probably easier to go the functional approach
and then find ways to optimize.

## 2025-06-26

### 14:06 - dinking with TextRasters

Added a `TextRaster` type and some functions to work with them
in `rasterdemo.ts`, which includes some unit tests.

Got some 'help' from CoPilot which may have just made it
messier and take longer.

There's some overlap in functionality between
the raster updating function and things that `SpanMan`
does during `generateSpanOutput`, which feels a little silly.

## 2025-06-30

### 14:08 - Simplify the raster business

...by actually storing the raster as an array of characters and styles.

Added [TextRaster2](./src/lib/ts/termdraw/TextRaster2.ts), which defines
the (very simple) data structure, and [raster2demo](./src/demo/ts/raster2demo.ts),
which, like [rasterdemo](./src/demo/ts/rasterdemo.ts), is currently just unit tests.

TODO: Implement functions to apply draw commands to a raster
to produce a new raster and list of updated regions
(which for simplicity of implementation could just be one
big region, or one region per line).

TODO: An actual demo, where widgets are drawn.

## 2025-07-17

### 22:00 - Trying to make some dang progress

Problem: I'm not sure how to structure the code for a dang TUI app.

Created [asynciterappdemo](./src/demo/ts/asynciterappdemo.ts),
which gives a rough outline for one approach: the app is a function
that takes an async iterable of input events and returns an async iterable
of output events.  Which worked well enough for this simple demo.

The async iterable of input events maybe makes sense,
though an app could also get input from other places.

But I wonder if the model is awkward for output.
What if an app does a lot of output somewhere other than the terminal?
Output to the terminal is all yields, while output elsewhere
looks completely different.

Maybe instead of this iterator stuff, an app should just be
an async procedure that operates on a 'context' which consists
of whatever I/O functions are convenient for the app.
Terminal input and output would not have special status.

These conceptual models always seem to become more complicated
when I go and try to implement it in TypeScript.

## 2025-07-18

### App as iterator over input events

This model becomes more awkward as the app needs to react to more different things.

I had to go through some contortions to represent screen resizes as events
in a stream.  I'm imagining that setting timers would be even more weird.

The model I used in the original `tuidemo1.ts`, which uses 'reactive state variables',
seems much more straightforward.  I might want to simplify from that somewhat,
maybe remove the `.then` method which makes the things look like promises,
which could confuse promisey code that tries to deal with them.
