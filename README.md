# Scratch38-S0015

Some Deno code for TUI...stuff.

## TUIAppFramework3

To run demonstration, try one of:
- `deno run --check=all help`
- `deno run --check=all boxes`
  - Box layout demo!
- `deno run --check=all hello`
- `deno run --check=all clock`
- `deno run --check=all --allow-read src\demo\ts\tuidemo3.ts wc README.md CHANGELOG.txt`
- `deno run --check=all src\demo\ts\tuidemo3.ts wc -`
  - This one reads data from stdin; recommendation is to pipe in a file
  - You can also type text in but it will 'look messy' and you'll have
    to manually send EOF (Ctrl+z on Windows, Ctrl+d on Unixen) or Ctrl+c to quit.

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
