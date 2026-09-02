# Patch notes: stale compiled WAProto fix

`WAProto/index.js` (the compiled protobuf encoder) was out of sync with its
own `WAProto/WAProto.proto` source. Two fields declared in the `.proto` file
were never compiled into the runtime encoder:

- `Message.botForwardedMessage` (field 104)
- `AIRichResponseMessage.contextInfo` (field 4)

Since the compiled `Message` class didn't recognize `botForwardedMessage` as
a field at all, `WAProto.Message.create()` silently dropped it during
encoding. Any code sending an AI-rich / bot-forwarded message -- including
this library's own `generateTableContent`, `generateRichMessageContent`,
etc. in `lib/Utils/rich-messages.js`, and any third-party AIRich-style
builder -- would appear to send successfully (no error) but nothing would
render on the recipient's device, because the entire payload silently
vanished during encoding.

## What changed

`WAProto/index.js` and `WAProto/index.d.ts` were regenerated directly from
`WAProto/WAProto.proto`, using the exact command `WAProto/GenerateStatics.sh`
already specifies:

```bash
npm install protobufjs@6.11.4 --no-save   # bundles a pbjs/pbts CLI that targets
                                            # the protobufjs 7.x runtime this library uses
./node_modules/.bin/pbjs -t static-module -w commonjs -o WAProto/index.js WAProto/WAProto.proto
./node_modules/.bin/pbts -o WAProto/index.d.ts WAProto/index.js
```

**Important:** the standalone `protobufjs-cli` package targets protobufjs
8's runtime conventions (a `this.ctor()` self-reference pattern in generated
`decode()` methods), which throws `TypeError: this.ctor is not a
constructor` when loaded against this library's protobufjs 7.x runtime.
protobufjs 6's bundled CLI generates code compatible with the 7.x runtime
actually in use here.

## `keithbtn` merged in directly

Everything that used to live in the separate `keithbtn` package is now
built into this library directly, under `lib/Interactive/`:

- `btn` — the button-payload helper object (`btn.url()`, `btn.copy()`,
  `btn.call()`, `btn.reply()`, `btn.reminder()`, `btn.cancelReminder()`,
  `btn.address()`, `btn.location()`, `btn.list()`, `btn.inappSignup()`)
- `sendButtons` / `sendInteractiveMessage` — native-flow interactive button
  messages
- `sendButtonsSafe` — same, with automatic plain-text fallback on
  iOS/SMB-iOS
- `sendInappSignup` — In-App Signup button with the same iOS fallback
- `sendButtonV2` / `ButtonV2` — classic `buttonsMessage` (quick-reply
  style) button builder
- `sendAIRich` / `createAIRich` / `AIRich` — the AI-rich bot-response
  builder (text, code, tables, images, videos, sources, products, posts,
  tips, suggestion pills, message editing)
- `AIRichError`, `ItemNotFoundError`, `DuplicateIdError`,
  `InvalidTargetError`, `ContentValidationError` — `AIRich`'s id-based
  content-addressing error classes
- `isIOSDevice` — device-platform check used by the `*Safe` fallback
  functions

All of it now pulls `generateWAMessageFromContent`, `prepareWAMessageMedia`,
and `generateMessageIDV2` directly from this package's own `lib/Utils/`
modules instead of self-requiring `keithbaileys` as an external peer
dependency -- there's no more separate `keithbtn` package to install.
`sharp` and `fluent-ffmpeg` remain genuinely optional, external peer
dependencies (declared as such in `package.json`) for `AIRich`'s
thumbnail/video-preview features; everything else works without them.

All existing call signatures are unchanged --
`sendButtonV2(sock, jid, options)`, `sendAIRich(sock, jid, blocks, options)`,
etc. -- so code written against `keithbtn` only needs its import source
changed from `keithbtn` to `keithbaileys`.



Regenerating `WAProto/index.js` from the current `.proto` surfaced a second,
pre-existing bug: `lib/Defaults/index.js` referenced
`proto.Message.HistorySyncNotification.HistorySyncType`, but the `.proto`
source declares `HistorySyncType` as a **sibling** enum of
`HistorySyncNotification` (both nested directly under `Message`), not
nested inside it. That path was `undefined`, so
`.INITIAL_BOOTSTRAP` etc. threw `Cannot read properties of undefined
(reading 'INITIAL_BOOTSTRAP')` -- at module load time, since
`PROCESSABLE_HISTORY_TYPES` is built at the top level of `Defaults/index.js`,
which crashed the whole library on startup.

This was **not** introduced by the WAProto regeneration -- it's a
pre-existing mismatch between the `.proto` text and this file specifically.
It was previously masked because the old, stale compiled `WAProto/index.js`
happened to have been generated from an even older `.proto` snapshot where
this enum genuinely was nested inside `HistorySyncNotification`; regenerating
from the current `.proto` (which has since been restructured) exposed the
mismatch. Two other files in this codebase (`lib/Utils/history.js`,
`lib/Utils/process-message.js`) already correctly reference
`proto.HistorySync.HistorySyncType` (a related enum with identical numeric
values for the members actually used) -- `lib/Defaults/index.js` was the
only place still using the broken path. Fixed to match.



- The regenerated encoder produces **byte-for-byte identical** output to
  the original for standard message types (`conversation`,
  `extendedTextMessage` with mentions, `buttonsMessage`).
- `Message.botForwardedMessage` and `AIRichResponseMessage.contextInfo` are
  now present and fully functional (encode/decode/verify/fromObject/toObject
  all generated).
- A full AIRich-built message (nested `botForwardedMessage.message.richResponseMessage`,
  with `contextInfo.isForwarded`/`forwardedAiBotMessageInfo`, submessages,
  and a JSON `unifiedResponse.data` payload) was round-tripped through a
  real `Message.create()` -> `encode()` -> `decode()` cycle:
  - **With the original (stale) encoder:** `botForwardedMessage` and
    everything nested inside it was silently stripped.
  - **With this patched encoder:** everything survives intact.
- `lib/Utils/rich-messages.js` (`generateTableContent`) was loaded and
  exercised end-to-end with the patched encoder in place -- confirmed
  working, and was previously silently broken by this same bug.
- The full library entry point (`lib/index.js`, 247 exports including
  `makeWASocket`) was loaded end-to-end with both fixes applied -- confirmed
  no load-time errors.

## Note on `index.d.ts`

No `.d.ts` was shipped for `WAProto` before this patch. It's included here
as a new addition, generated the same way, for TypeScript consumers.
