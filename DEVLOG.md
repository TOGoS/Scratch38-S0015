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

### A more traditional approach

`tuidemo3.ts` works in a more traditional object-oriented/procedural way.

An app instance is constructed and spawned by giving it a 'context', which is
for now just a handler of `Renderable`s.  But later a context might include
accessors for other bits of the environment.

A `runTuiApp` function takes an app constructor, creates subsystems for
handling input and output, switches things to 'TUI mode' (`input.setRaw(true)`,
switch terminal to alternate buffer), spawns the app instance, `wait()`s for it to exit,
and then switches back out of TUI mode.

I was able to write this in only a couple of hours, including some refactoring
of and new functions for drawing to `TextRaster2`s.  I think it's a better way
than that iterable stuff.

## 2025-07-30

### Line mode

Refactored `tuidemo3.ts` slightly so that apps can be launched
in what I am currently thinking of calling 'TUI mode' or 'line mode'.

In TUI mode, the app get raw input and the app takes over the screen.

In line mode, the app does not get raw input, and prints its output
to the terminal line-by line.

Raw input and fullscreen/line-based output are sort of orthogonal,
so I want to refactor further so this is all handled by one function
with flags (maybe the `Spawner` will have properties indicating
whether it expects raw input, etc).

### Decouple usesRawInput from outputMode

Now you can run `tuidemo3.ts` in `screen` or `lines` mode.

```
deno run src\demo\ts\tuidemo3.ts --output-mode=screen
```

It would probably be good to tell the spawner somehow
which output mode is being used in case the app wants
to e.g. emit a different raster size when in screen mode.

Currently `EchoAppInstance` hardcodes the output height to 3 lines,
but that's not real 'scalable'.

## 2025-07-31

### Use of underscores in names

I used to say "ugh no!" when I saw names prefixed with underscores.

But now I am using it to mean something specific:
name beginning with underscore is intended to be called 'from inside'
the object, whereas those that are not are to be called 'from outside'.
This is sort of orthogonal to whether they are public or private.

e.g. `_exit`.  Obviously you don't call that to tell the process to quit!
It is called *by* the process as part of the implementation of quitting.
Telling the process you *want* it to quit would be something else.
I think the underscore helps make this clear.

### The TUIDemo app framework seems decent enough

Code could use some better organizing and better names,
but this framework (the 'framework' being the `runTuiApp` function
defined in [tuidemo3.ts](./src/demo/ts/tuidemo3.ts))
seems like it allows 'TUI apps' to be written without too much fuss.

I still want to demonstrate an app that updates itself based
on data coming in from standard input.

It might be good to have a standard way to ensure that
the screen gets redrawn when the screen size changes.

### Component system

Basically I just want a way to automatically lay out a bunch of stuff.
It might not even need to be a persistent object tree.

First stab at this is [components1.ts](./src/scratch/ts/components1.ts).
In the process of writing that stuff I started thinking
that I would prefer a more 'unified' approach.
i.e. one where components have the same API as the whole app,
which is currently

```typescript
interface Rasterable {
	toRaster(minSize:Vec2D<number>, maxSize:Vec2D<number>) : TextRaster2;
}
```

## 2025-08-05

### `wc`

Demonstrates an app that reads data from stdin
(and also updates every second, because it has a clock in it).

```sh
deno run --check=all src\demo\ts\tuidemo3.ts wc - <README.md
```

## 2025-08-09

Some not-super-important updates, but progress nonetheless:
- The 'x:EmitStyleChange' command now implies resetting formatting before the
  new style is emitted, to avoid temporal leakage between style changes.
- `tuidemo3 wc` subcommand now takes names of files to read from as arguments;
  use "-" to mean 'standard input'
- More colors defined in `ansi.ts`.  Concatenate to combine options.  e.g.
  `ansi.UNDERLINED + ansi.BRIGHT_WHITE_TEXT + ansi.RED_BACKGROUND`

## 2025-08-12

Past few days I worked on a layout system that I called '[components2](./src/lib/ts/termdraw/components2.ts)'.
It seems to be working pretty well!

![Box layout screenshot](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:NC26MWUVSTC5BLCFDNTE3UVI3TTIMLRA.KMXEUJGW3UU5EQQI24VY3UZQBRAF4ACNDUD6RPA/20250811-BoxLayout.png)

That said, here are some things I'd liked to change:
- Improve flex layouts -- mind `flexShrink`
- Aggresively memoize everything
- Automatic box-drawing

For 'automatic box drawing', what I have in mind
is that at some point, an outline is drawn simply
by blitting some placeholder character for borders,
and then later those would be replaced with box-drawing characters
based on which neighbors are the same placeholder character.
Separate boxes could be kept separate by using different placeholders.
Alternatively, border pixels with different styles could be considered separate boxes.

This would have the advantage that boxes could be drawn across multiple
components without coordination.

On the other hand
- How to allocate box IDs?
- Maybe don't really need it!

And either way, if I want e.g. the flex layout to put borders between cells,
I need to figure a way to specify that.

In the meantime, maybe the thing to do is to massage
the output from the existing [BoxDrawr library](./src/lib/ts/termdraw/BoxDrawr.ts)
so I can at least blit that stuff.

## 2025-08-18

### Borders drawn with proper line-drawing characters!

![Screenshot showing box borders drawn using proper box-drawing characters](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:GUSKYBJLEJ4WKUVYJKFLQ5FSEF4RNEP5.FEM2X3ND4KF6AD4MHA2GGOLQKLKAMGFHGTFYGAA/20250818-LineBoxes.png)

`BoxDrawr` now has a `contentToRaster` method, which returns a `TextRaster2`.
This can be used to draw more complicated liney stuff, too, not just rectangles.

## 2025-08-21

### Status Mockup, take 1

Bare minimum work done to translate a couple of
abstract 'status data' objects to rasterable components:

![Screenshot showing a very shoddy, but non-crashing, mockup of a dashboard showing statuses of 'bill' and 'ted' devices](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:32UASPAPQJ7SETR7LMWMJF2X32VOE6IF.G4Y7ZVV5DENC3ILVWCUEEF4QSEBPHCPP4RGOLLY/20250821T12-StatusMockup-take1.png)

### Status Mockup, take 2

- Renamed `regionToRaster` to `rasterForRegion`.
  It is conceptually different, but this wasn't obvious based on the name,
  and in practice, it might not matter.  If you ask something that
  doesn't know its size to generate a raster, maybe it's fine if that
  is the same as telling it that's what its bounds should be and then
  generationg a raster for that region.
- Padding is no longer completely abstract - it has a size.
  - But it is becoming clear that how it grows X-wise and Y-wise should maybe be different things,
    since these 'horizontal rules' or whatever would be okay expanding X-wise,
	 but don't want to expand Y-wise.
  - Maybe there should be separate `flexGrowAlong` and `flexGrowAcross` props?

![Screenshot showing incremental progress since take1](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:DMBCGFSZUI7ZENIXNFC3SNSJGTHM4MI6.RVCR642JM4PPBGWZABFLCJ4WR2WYAMNBTWSHTMY/20250821T13-StatusMockup-take2.png)

### Why isn't the crap centered

![Ugh](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:FBNAWDP6XWXGXTKGQH4IA2MDI5WYMW5U.QCYB6P2K5EV22MFV4XTUSEXHAW7VSIRSUCYO45Q/20250821T18-UncenteredBoxes.png)

That column of boxes should be centered within the big red box,
with blue stuff on both sides.

How it's supposed to work:
- The flex column thing figures out how big it
  and all its children can be, and creates a `SizedCompoundRasterable`
  that is that size (well, it has a `#background` that knows its size)
- Later, the parent component will look at the bounds of that thing
  and the area it wants to fill, and ask the `SizedCompoundRasterable`
  for a raster of the needed size...aaand it is up to the inner component
  to convert that size to a region, which could be centered or not.
  - Does `SizedCompoundRasterable` do that correctly?
  - Maybe not, given that `rasterForSize = thisAbstractRasterableToRasterForSize`
  - Fixing that, so that `rasterForSize = thisBoundedRegionRasterableCenteredRasterForSize`,
    didn't result in things being centered.

It's kind of hard to debug this stuff.

I should probably remove the stuff where everything implements everything,
because I think it is causing confusion.

### I got it centered!

After writing several unit tests,
refactoring how transparency and default styles are represented in `TextRaster2`s
(undefined and empty string, respectively),
and overlaying some debug information onto the resulting rasters,
I found the bug in `SizedCompoundRasterable#rasterForRegion`
that was resulting in things not being centered.

I was subtracting the top-left corner position of `this.bounds` (effectively),
but should have been subtracing the position of the top-left corner
of the raster!

Now everything seems to be working properly.

![Centered boxes screenshot](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:PMDMGPSQGTJ4AQLUULLAJVO3PQP4SKL5.B2MXEOAUZCIXCY5IAAJTS2JBIQ6V7CA7DTJBGBA/20250821T23-CenteredBoxes.png)
![Centered status mockup screenshot](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:E4QJAAU3KRCYTUMGM6NKAXZUH2J2TWVQ.ECFYJF4NN47QQKMGC3FHLLFW4IQQNS6EIADQWJI/20250821T23-CenteredStatus.png)

## 2025-08-22

### Flex spacing

Made flex boxes able to put space around stuff.

![Screenshot showing a flex container with 1-character border around each child](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:FY6VMMVQ4UQSHAQ7YI4M5D7U534BJJBJ.YGAQBIHEH2EFBTLUFUPXRJOU7IAOBTRYOSRY5WQ/20250822T17-PackOkay.png)

Problem: Flex box crammed into small space
should be able to expand, but its parent flex box cannot
take into account children's new size after inflating!

![Screenshot showing a parent flexbox failing to take into account a child's post-inflation width](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:S4536LZPK2UDGPYZ6KPDM7HYQUP5XH7U.MB5QQS3I3UF7DSBFRN2Q4OWPHD72TVNAFEAT7AA/20250822T17-PackFail.png)

(Also, why is the border at the top two lines tall instead of one?)

Proposed solution: `pack` to take a container size parameter.
Obejcts should still try to pack into the smallest space possible,
but they can take those dimensions into account.

### Unexplained gap

Also, when I make the screen only 5 rows high,
the 'Bill' box of `status-mockup` somehow
ends up with a space at the top, cuurrently marked with a cyan background.

![Exclamation points on cyan background indicate "this area should not be showing"](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:C5BHVSYK54ASWXZBRDI3DGKD5GPF345E.SDSH7EA3X5XNBCRRTCY5KQ6SBERJR6F5PLBC5DQ/20250822T17-PackFail2.png)

This may be the same issue as the inappropriately two-line-tall border shown in the previous screenshot.

### Gap explained

Bill's status box originally packed to 4 lines tall.
When `fillSize`d to three lines, the "Hi there"/"I'm Bill"
got moved to a separate column, leaving the whole thing
only two lines high.  The cyuan background showed through
because it was asked to fill a 3-line-tall space with only 2 lines of content.

'Fixed' this by taking whichever is shorter--the original 'to be filled' length,
or the 'actually filled length of the child component.  To prevent overflowing
the parent, too-long children are not given extra space.

Figuring out how rigid-ish things will lay out is complicated by wrapping.
There should probably be an option to disable it.

## 2025-08-27

### New options to boxes app

To show that nested flex containers don't wrap properly.

Looks good:

`deno run src\demo\ts\tuidemo3.ts --output-mode=lines --screen-size=40,12 boxes --quit`

Looks good:

`deno run src\demo\ts\tuidemo3.ts --output-mode=lines --screen-size=40,12 boxes --wrap-with-border --quit`

Not so good; nested flex container fails to wrap:

`deno run src\demo\ts\tuidemo3.ts --output-mode=lines --screen-size=40,12 boxes --wrap-with-flex-row --quit`

![Screenshot showing boxes app in three different border modes, where the flex-inside-flex on fails to wrap properly](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:ZUPJDXPXXYMSKZUXGGFCQPINYFJEEU45.MTPOVGZQ4UFE3JU2X4JLW4PE4VRGNLSDXGVIVHY/20250827T15-FlexFail.png)

I think it might help if `pack` took a parameter indicating the shape of the space available,
so that flex containers can wrap if needed, making their packed form will be more representative
of the space they need.

### That worked great!  Minor issues remain.

Boxes demo now lays out properly with `--wrap-with-flex-row`,
giving the same result as when not wrapped at all.
I can change the screen size and things flow around as they should.
Which is fun to after editing the refresh interval to, like, 100ms
(`Deno.addSignalListener("SIGWINCH", refreshScreenSize)` doesn't work on Windows).

Status mockup has some funkiness though.
I refactored it a little bit to use flex spacing around text
instead of padding components, which resulted in slightly different,
(but hopefully caused by the same underlying problem) funkiness:

![Issues with status-demo layout](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:74P6R3XRXUFWNKDPMOUOFBFCJOUXW7TW.HQZBWCS3ABXSDN7YDWD2J45ZQU4Z4EPPELXYHTY/20250827T16-MinorIssues.png)

1. Why is there a gap after the status?
2. Why does it wrap when screen height = 9?  There's clearly an empty space at the top.

I'm guessing it has to do with spacing, because that's a difference between `status-mockup` and `boxes`.

Also because:

3. Adding `alongBetweenSpace: 1` to the boxes when height = 5 gives the wrong result
(third box gets cammed to one line tall when it should have had two):

![Hmm, alongBetweenSpace misbehavior](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:UH2C4QELFSNB4GN2X4ZOCJ3ADPHO3HPW.VU6B62NH255D3LZNSODAVP7FYE4TFJTTG5C2FSA/20250827T17-AlongSpaceHmm.png)

### A fix

Oops!  When calculating row lengths in `PackedFlexRasterable#PackedFlexRasterable`:

```
if( c > 0 ) rowTotalLength += alongBetweenSpace;
```

should have been:

```
if( c > 0 ) rowTotalLength += alongBeforeSpace;
```

That fixed the prolem #1 and #3, but not #2.


### To-do

#### Demo improvements

- [ ] When many messages, try to show the last ones
- [ ] flexShrink: can it be used to prioritize
  what gets removed entirely, not just how much,
  proportionally, to shrink a given flex child?
  Old messages, 'last seen', and latest message
  could be hidden, in that order, when space is insufficient.
  And/or the whole layout could change to not include borders.

#### Flex

- [/] Replace "rows" and "columns" flex directions with alongDirection and acrossDirection,
  which can be "up"/"down"/"left"/"right" (but along and across must be orthogonal)
  - Renamed, but left/up not yet options

#### Box drawing

- [ ] At some point, turn placeholder '?'s into box-drawing chars as appropriate given neighbors.
  - May want to somehow do this before flex content is drawn?
  - I'm thinking of possibly wanting to draw titles over the lines.
    Maybe punt for now.

Thought: Background generator could be a function of outer bounding box +
bounding boxes of all children.  Then an outlining background generator
could just `BoxDrawr` lines around each child.

This would also require the flex layout thing to
be able to insert margins between and around children;
the goofy padding inserted in there is no good
anyway because it might end up at the edge and be redundant.

#### TUI Framework

- [X] Remove direct references to `Deno` to make the framework more generic

## 2025-09-06

### Child Borders

As a step towards drawing nice line borders around and between flex children,
I added an optional options parameter to `RegionFillingRasterableGenerator#fillRegion`:

```typescript
export type RegionFillOptions = {
	/**
	 * May be used by background generators to indicate areas that will be drawn over.
	 * The background generator may e.g. use this to draw decorative borders.
	 */
	populatedRegions?: AABB2D<number>[]
};

export interface RegionFillingRasterableGenerator {
	/**
	 * Generate a BoundedRasterable that fills the given space;
	 * result may be larger or smaller than the given region
	 * and positioned differently; area is just a suggestion.
	 */
	fillRegion(area : AABB2D<number>, options?: RegionFillOptions) : BoundedRasterable
}
```

The idea being that the background generator that is used by a flex layout component
will be provided, by the flex layout, the positions of all the child elements,
which the background generator can use, or not, for whatever purpose it wants,
one possible use being to outline those regions:

Thanks to strong typing and immutable data structures, this worked the first time,
though the issue with mysterious extra gaps remains.

```sh
deno run src/demo/ts/tuidemo3.ts --output-mode=lines --screen-size=50,10 status-mockup
```

Output, with yellow/black checkerboard pattern highlighting the
gaps that shouldn't exist:

![Screenshot showing border drawing working okay, but mystery gaps remaining](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:OUDM7F2EPJD6GJSJKAUFYODXLX6NCEG4.BKMHUAYDJUCKKUPY32T4QAKP5FZDAPD7VZ6BBAY/20250906T15-ChildBordersAndMysteryGaps.png)

You'd think that when told to pack itself into 9 rows,
that top gap would go away, but instead the thing reflows into two columns.
In any case, the black gap on the right is obviously wrong.

Part of me wants to rewrite the flex layout system in Idris or Coq or something
in the hope that the compiler could then tell me why the components
aren't filling the full space that I expect them to.

### Line borders

Yay, now I can automatically draw line borders around children of flex layouts!

![Booyah](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:ENL2WMA7HMIOWKBLBZ643TVV3J3IEPXF.OCKHDTJ3NP6Y5NGW5LADBTU435N7DQBJAWDC5AI/20250906T23-ChildLineBorders.png)

In addition to the weird gaps,
there's this case where lines get doubled:

![Hmm](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:K4TP6N3XTLH3B2GO4O6KAZBEPE43BUGI.PAEHNRF6GLZGS23VC7MHRJXMEVTVOADHH5VKRUA/20250906T23-ChildLineBordersHmm.png)
