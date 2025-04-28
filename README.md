# Scratch38-S0015

Some Deno code for TUI...stuff.

For reading characters and escape codes as sent by terminals, use `toCharishes` from `escapeparser.ts`,
which will give you an `AsyncIterable<Charish>`, where `Charish` is either a number (for a regular character)
or an object representing the data contained in an escape sequence.
See [charishdemo.ts](./src/demo/ts/charishdemo.ts) for example.


Streams of charishes can in turn be translated into 'input events'.
See [eventreader.ts](./src/demo/ts/eventinutdemo.ts) for example.


There's also some stuff about box drawing buried in here.

This project is currently 'just a bunch of code',
isn't very well organized, and may change drastically between versions.
