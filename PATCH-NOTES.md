# keithbaileys 1.1.1 — LID mapping patch

## Problem
Messages (especially in DMs / "Message yourself") were stuck showing
WhatsApp's "Waiting for this message" placeholder forever. Root cause:
this fork had no PN <-> LID (linked ID) mapping layer, so the Signal
session for the same contact was sometimes built from their phone-number
JID and sometimes from their LID JID. The two silently diverged into two
different sessions, decryption kept failing, and retries never recovered.

## What changed
- `lib/Signal/lid-mapping.js` (new) — CommonJS LID<->PN mapping store,
  backed by your existing key store (`keys.get/set('lid-mapping', ...)`),
  with a small in-memory TTL cache (no new dependency added).
- `lib/WABinary/jid-utils.js` — added `isPnUser`, `isHostedPnUser`,
  `WAJIDDomains`, which the mapping store needs and which weren't
  present in this fork at all.
- `lib/Signal/libsignal.js` — `encryptMessage`, `decryptMessage`, and
  `injectE2ESession` now resolve to ONE consistent address per contact
  (LID once known) instead of using whatever JID form was on that
  particular message. Added `migrateSessionIfNeeded` so an existing PN
  session is carried over to the LID address instead of being dropped.
- `lib/Socket/socket.js` — added a self-contained `executeUSyncQuery`
  and a `pnFromLIDUSync` resolver, wired into `makeSignalRepository(...)`
  at construction time, so LID lookups are actually possible. (Your
  fork previously only had USync in a separate wrapper layer that
  loaded too late for this.)
- `package.json` — pinned `"libsignal": "^6.0.0"` instead of `"latest"`,
  and bumped the version to `1.1.1`.

## Not changed / known limitations
- Group chat sender-key (senderKeyName) resolution was left as-is.
  This patch targets 1:1 chats, which is what was reported broken.
- No live WhatsApp connection was available to test this end-to-end in
  the environment this was built in (no network access). Every file was
  syntax-checked (`node --check`) and the mapping-store logic was unit
  tested in isolation with a mock key store, but you should test this
  against a throwaway/test number before trusting it on your main line.
- If you still see "Waiting for this message" after this, check your
  logs for `LID resolution failed` or `session migration ... failed`
  warnings — those point at where to dig next (most likely: your
  `executeUSyncQuery` requires the socket to already be authenticated
  and connected; it won't resolve anything before then).

## How to install
1. Delete your existing `node_modules/keithbaileys`.
2. Unzip this package, `cd` into it, run `npm install` inside it once
   (to pull its own deps like libsignal/protobufjs) if you're linking
   it locally, OR just copy the `lib/` folder over your installed
   copy's `lib/` folder and update `package.json`'s version/libsignal
   line to match.
3. Restart your bot with a fresh delete of old sessions for a couple of
   contacts to force new, consistent sessions to be built under this
   patch (existing broken sessions won't self-heal instantly — new
   messages will trigger the resolution/migration path).
