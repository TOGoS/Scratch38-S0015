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
