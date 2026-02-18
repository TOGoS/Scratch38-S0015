# Scratch38-S0015

A bunch of TypeScript code to help me build simple TUIs;
things that look like:

![Screenshot of a status dashboard mockup...thing](http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:G7QURFA4HSWHUT7PRSDOOCAMV44K5ZY3.F4KMNXHIRW7VOECLO6ZHNIPCMRABCXKHBZ73UZY/20250906T23-ChildLineBorders2.png)

I have tried to keep the different components
separate from each other as much as possible
so that you can mix and match the parts that are useful.

## Major components

- [inputeventparser](./src/lib/ts/terminput/inputeventparser.ts) has functions for parsing escape sequences from the terminal.
- [TextRaster2](./src/lib/ts/termdraw/TextRaster2.ts) defines a common representation of styled terminal text.
- [tuiappframework3](./src/lib/ts/tuiappframework3.ts) takes care of TUI application lifecycle management stuff.
- [components2](./src/lib/ts/termdraw/components2.ts) defines a component layout and 'rendering' system and several predefined component classes.
- [tuidemo3.ts](./src/demo/ts/tuidemo3.ts) uses all of the above to demonstrate how this library can be used.

There are also various vestigial bits, like `SpanMan`,
which was a cool idea but turned out to not be especially useful under the
'pure functions that return TextRaster2s' regime.

## Things this library does *not* have

- Mouse input handling
- Any routing of input to 'components';
  the components defined by components2 are output-only,
  and do not themselves handle input.

## TUIAppFramework3

To run demonstration, try one of:
- `deno run --check=all src/demo/ts/tuidemo3.ts help`
- `deno run --check=all src/demo/ts/tuidemo3.ts boxes`
  - Box layout demo!
- `deno run --check=all src/demo/ts/tuidemo3.ts hello`
- `deno run --check=all src/demo/ts/tuidemo3.ts clock`
- `deno run --check=all --allow-read src\demo\ts\tuidemo3.ts wc README.md CHANGELOG.txt`
- `deno run --check=all src\demo\ts\tuidemo3.ts wc -`
  - This one reads data from stdin; recommendation is to pipe in a file
  - You can also type text in but it will 'look messy' and you'll have
    to manually send EOF (Ctrl+z on Windows, Ctrl+d on Unixen) or Ctrl+c to quit.
- `deno run --check=all src\demo\ts\tuidemo3.ts status-mockup`
  - Device status dashboard mockup

Pass `--capture-input` before the subcommand if you want to be able to hit "q" to quit
instead of having to control+c.

## Other stuff

For reading characters and escape codes as sent by terminals, use `toCharishes` from `escapeparser.ts`,
which will give you an `AsyncIterable<Charish>`, where `Charish` is either a number (for a regular character)
or an object representing the data contained in an escape sequence.
See [charishdemo.ts](./src/demo/ts/charishdemo.ts) for example.


Streams of charishes can in turn be translated into 'input events'.
See [eventreader.ts](./src/demo/ts/eventinputdemo.ts) for example.


There's also some stuff about box drawing buried in here.

This project is currently 'just a bunch of code',
isn't very well organized, and may change drastically between versions.


See [DEVLOG.md](./DEVLOG.md) for stream of consciousness as I try to figure out what I'm trying to build.

## TODOs

### Fix handling of keys with modifiers

I am not sure how control, alt, and shift are supposed to modify
keyboard events in the web key API,
which (inputeventparser.ts)[./src/lib/ts/terminput/inputeventparser.ts]
tries to emulate.

https://garbagecollected.org/2017/01/31/four-column-ascii/ may have a hint or two,
at least when it comes to keypresses that correspond cleanly to ASCII characters.

"Pressing CTRL simply sets all bits but the last 5 to zero in the character that you typed."
