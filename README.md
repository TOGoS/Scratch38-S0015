# Scratch38-S0015

Some Deno code for TUI...stuff.

For reading characters and escape codes as sent by terminals, use `toCharishes` from `escapeparser.ts`,
which will give you an `AsyncIterable<Charish>`, where `Charish` is either a number (for a regular character)
or an object representing the data contained in an escape sequence.
See [charishdemo.ts](./src/demo/ts/charishdemo.ts) for example.


Streams of charishes can in turn be translated into 'input events'.
See [eventreader.ts](./src/demo/ts/eventinputdemo.ts) for example.


There's also some stuff about box drawing buried in here.

This project is currently 'just a bunch of code',
isn't very well organized, and may change drastically between versions.

## Architecture

Currently brainstorming.

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
