# Changelog

## Unreleased

### App-state trace and test notes (2026-11-21)

This entry records the comparison between `keithbaileys` and [Casper-Tech-ke/baileys](https://github.com/Casper-Tech-ke/baileys/blob/main/CHANGELOG.md), specifically for operations that use WhatsApp app-state patches.

#### What was wrong in `keithbaileys`

1. `chatModify()` calls `appPatch()` for archive, clear, pin, contact, label, star, and related operations.
2. `appPatch()` checks only `creds.myAppStateKeyId`. It does not confirm that the matching `app-state-sync-key` value exists in the key store before starting the operation.
3. `encodeSyncdPatch()` then looks up that value and throws `myAppStateKey ("...") not present` when the ID exists but the key value is missing.
4. `keithbaileys` does not expose Casper's `requestAppStateSyncKey()` method and does not request a missing key from the primary phone when a connection opens.
5. `resyncAppState()` treats a missing key as a failed sync instead of parking the affected collection and retrying it after an `APP_STATE_SYNC_KEY_SHARE` arrives.
6. The current package contains the low-level `chatModify()` API, but it does not export Casper's convenience wrappers such as `archiveChat()`, `clearChat()`, `deleteChat()`, or `pinChat()`.

This explains the observed behavior: the patch shape is generated correctly, but a fresh or imported session can have a valid `myAppStateKeyId` with no corresponding key material. The operation fails before WhatsApp can accept the patch. A session that already has the matching key can appear to work.

#### What Casper changed

Casper's changelog and commit [`8a3f5df`](https://github.com/Casper-Tech-ke/baileys/commit/8a3f5df5daec3b98f9bb38cec88c77735a84249d) add a missing-key recovery path:

- `requestAppStateSyncKey(keyIds)` sends an `APP_STATE_SYNC_KEY_REQUEST` to the primary phone.
- A connection-open hook checks whether `myAppStateKeyId` exists in the key store.
- Each missing key is requested once per process and retried on a later connection if the request failed.
- The existing app-state share handler stores the returned key and emits `creds.update`.
- App-state resync treats a missing key as a blocked collection instead of permanently discarding the operation, then retries that collection when the key arrives.

Casper also added `ensureLTHashStateVersion()` and changed the missing-key error to carry `data.isMissingKey`, which lets the resync code distinguish a missing key from a corrupted or otherwise unrecoverable app-state error.

#### Test the current `keithbaileys` patch path

The following uses the APIs currently exported by `keithbaileys` 1.1.3. It uses `chatModify()` directly because the convenience wrappers have not yet been ported into this package.

```js
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('keithbaileys')

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    console.log('connection:', connection)
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        start().catch(console.error)
      }
    }
  })

  // Replace this JID with a chat you control.
  const jid = '254700000001@s.whatsapp.net'

  // Archive. lastMessages must contain the latest message in reverse
  // chronological order, as required by the app-state archive patch.
  await sock.chatModify({
    archive: true,
    lastMessages: [latestMessage]
  }, jid)

  // Clear the conversation. In this package the clear patch is generated
  // by chatModify({ clear: true }, jid).
  await sock.chatModify({ clear: true }, jid)

  // Add or edit a WhatsApp contact. This changes the WhatsApp contact
  // record, not the phone's native address book.
  await sock.addOrEditContact(jid, {
    fullName: 'Keith Test',
    firstName: 'Keith',
    phoneNumber: jid
  })

  // Remove the WhatsApp contact.
  await sock.removeContact(jid)
}

// Supply a real WAMessage from messages.upsert before calling archive.
const latestMessage = {
  key: {
    remoteJid: '254700000001@s.whatsapp.net',
    id: 'MESSAGE_ID',
    fromMe: false
  },
  messageTimestamp: Math.floor(Date.now() / 1000)
}

start().catch(console.error)
```

Run the archive call first with a session that already contains its app-state key. Then test with the affected fresh/imported session. Before the Casper-style recovery is ported, the affected session is expected to fail with a missing-key error rather than automatically requesting the key.

#### Direct diagnostic logging

Add this temporary logging around the first failing operation to distinguish a missing key from an invalid patch:

```js
try {
  await sock.chatModify({ clear: true }, jid)
  console.log('app-state patch accepted')
} catch (error) {
  console.error('app-state patch failed')
  console.error({
    message: error?.message,
    statusCode: error?.output?.statusCode,
    data: error?.output?.payload?.data
  })
}
```

Expected failure on the affected package/session:

```text
myAppStateKey ("<current-key-id>") not present
```

This changelog entry documents the trace and test path only. The next implementation step is to port Casper's key-request API, connection-open resolver, missing-key classification, blocked-collection retry, and convenience wrappers into `keithbaileys`, then publish a new version for live testing.
