
# baileys

## New Features

### Communities

Full WhatsApp Communities management, mirroring the existing groups API.

```js
// create a community
const community = await sock.communityCreate('My Community', 'A description of the community')

// create a group inside a community
const group = await sock.communityCreateGroup('General', [participantJid], community.id)

// link / unlink an existing group
await sock.communityLinkGroup(groupJid, community.id)
await sock.communityUnlinkGroup(groupJid, community.id)

// fetch metadata
const metadata = await sock.communityMetadata(community.id)

// fetch all communities you're participating in
const communities = await sock.communityFetchAllParticipating()

// fetch the subgroups linked to a community (or the community for a subgroup)
const linked = await sock.communityFetchLinkedGroups(community.id)

// membership requests
const requests = await sock.communityRequestParticipantsList(community.id)
await sock.communityRequestParticipantsUpdate(community.id, [participantJid], 'approve') // or 'reject'

// add/remove/promote/demote participants
await sock.communityParticipantsUpdate(community.id, [participantJid], 'add')

// settings
await sock.communityUpdateSubject(community.id, 'New name')
await sock.communityUpdateDescription(community.id, 'New description')
await sock.communityToggleEphemeral(community.id, 7 * 24 * 60 * 60)
await sock.communitySettingUpdate(community.id, 'locked') // or 'unlocked' / 'announcement' / 'not_announcement'
await sock.communityMemberAddMode(community.id, 'admin_add') // or 'all_member_add'
await sock.communityJoinApprovalMode(community.id, 'on') // or 'off'

// invites
const code = await sock.communityInviteCode(community.id)
const revokedCode = await sock.communityRevokeInvite(community.id)
const joinedCommunityJid = await sock.communityAcceptInvite(code)

// leave
await sock.communityLeave(community.id)
```

### Business Profile

Extra business-profile management on top of the existing catalog/product functions.

```js
// update profile fields (only the fields you pass are updated)
await sock.updateBussinesProfile({
	address: '123 Example St',
	email: 'business@example.com',
	description: 'We sell example products',
	websites: ['https://example.com'],
	hours: {
		timezone: 'America/New_York',
		days: [
			{ day: 'monday', mode: 'specific_hours', openTimeInMinutes: 540, closeTimeInMinutes: 1020 },
			{ day: 'sunday', mode: 'appointment_only' }
		]
	}
})

// cover photo
const coverPhotoId = await sock.updateCoverPhoto({ url: './cover.jpg' })
await sock.removeCoverPhoto(coverPhotoId)
```

### Account Limits

Check your account's standing and new-chat messaging limits — useful for detecting
restricted/limited accounts (e.g. the "463 error") before you hit it.

```js
// check restriction / timelock status
const timelock = await sock.fetchAccountReachoutTimelock()
// { isActive, timeEnforcementEnds, enforcementType }

// check new-chat message quota/usage
const cap = await sock.fetchNewChatMessageCap()
```

`fetchAccountReachoutTimelock` also emits a `connection.update` event with a
`reachoutTimeLock` field so you can react to it passively.

### Username Lookup

Resolve a JID from a WhatsApp username (the `@username` handle feature), using the
USync query builder.

```js
const { USyncQuery, USyncUser } = require('baileys')

const query = new USyncQuery()
	.withContext('interactive')
	.withUsernameProtocol()
	.withContactProtocol()
	.withUser(new USyncUser().withUsername('someusername'))

const result = await sock.executeUSyncQuery(query)
// result.list[0] contains the resolved id/jid plus contact + username data
```

If you already know a user's "username pin" (usernameKey), pass it along for a more
reliable lookup:

```js
new USyncUser().withUsername('someusername').withUsernameKey('1234')
```

#### Checking if a username is available or taken

There's no separate "availability" endpoint — you check availability by doing the
same lookup and looking at whether it resolved to a contact, following the same
pattern as the built-in `onWhatsApp` helper:

```js
const { USyncQuery, USyncUser } = require('baileys')

async function isUsernameTaken(username) {
	const query = new USyncQuery()
		.withUsernameProtocol()
		.withContactProtocol()
		.withUser(new USyncUser().withUsername(username))

	const result = await sock.executeUSyncQuery(query)
	const match = result?.list?.[0]

	// match.contact is true if the username resolved to a real account
	return {
		taken: !!match?.contact,
		jid: match?.contact ? match.id : undefined
	}
}

const { taken, jid } = await isUsernameTaken('someusername')
console.log(taken ? `Taken by ${jid}` : 'Available')
```

### Sticker Packs

```js
await sock.sendMessage(jid, {
	stickerPack: {
		name: 'My Pack',
		publisher: 'Me',
		description: 'A test pack',
		stickers: [
			{ sticker: webpBuffer1, emojis: ['😀'] },
			{ sticker: webpBuffer2, emojis: ['🔥'] }
		],
		cover: coverImageBuffer // jpg/png, auto-resized — no extra image library needed
	}
})
```

Each sticker's `sticker` field (and `cover`) accepts a `Buffer`, `{ url }`, or `{ stream }` —
the same media input shapes used everywhere else in this library. `cover` is required, and
every entry in `stickers` must include its media — both are validated up front with a clear
error naming exactly what's missing, instead of failing deep inside the upload pipeline.

Stickers themselves must already be valid WebP buffers (this matches how single
sticker messages already work in this library) — invalid input throws a clear error
naming which sticker index failed, rather than silently producing a broken pack. The
cover/tray image can be a regular JPG/PNG; it's automatically resized via the same
sharp→jimp fallback used elsewhere in this library, so no extra dependency is needed
if you already have `jimp` installed.

### Rich Messages (tables, code blocks, LaTeX, links)

Send WhatsApp's "AI-forwarded" style rich messages — tables, syntax-highlighted code
blocks, LaTeX, link cards, and multi-part combinations.

```js
// table — accepts any of the following for the table argument:
//   1) { headers: string[], rows: string[][] }
//   2) a plain 2D array: [['Name','Score'], ['Alice','92'], ['Bob','85']]
//   3) legacy flat format: ['Title', 'Name|Score', 'Alice|92;;Bob|85']
await sock.sendTable(jid, {
	headers: ['Name', 'Score'],
	rows: [
		['Alice', '92'],
		['Bob', '85']
	]
}, quotedMsg)

// syntax-highlighted code block (javascript, typescript, python, go, lua, bash)
await sock.sendCodeBlock(jid, 'const x = 1;\nconsole.log(x);', quotedMsg, { language: 'javascript' })

// a simple list
await sock.sendList(jid, 'Shopping List', ['Milk', 'Eggs', 'Bread'], quotedMsg)

// link card(s)
await sock.sendLink(jid, 'Check these out:', [
	{ url: 'https://example.com', displayName: 'Example' }
], quotedMsg)

// combine multiple pieces into one rich message
await sock.sendRichMessage(jid, [
	{ messageType: 2, messageText: 'Here is a table:' }
], quotedMsg)
```

LaTeX rendering isn't bundled (no renderer dependency is forced on you) — `sendLatex`
sends the expression as metadata for WhatsApp's own client-side renderer, while
`sendLatexImage`/`sendLatexInlineImage` need you to supply your own
`renderLatexToPng(expression) => { buffer, width, height }` function if you want
image-rendered LaTeX:

```js
await sock.sendLatex(jid, quotedMsg, { text: 'The formula:', expressions: [{ latexExpression: 'E=mc^2' }] })

await sock.sendLatexImage(jid, quotedMsg, {
	expressions: [{ latexExpression: 'E=mc^2' }]
}, myLatexRenderer)
```

You can also capture a rich message you've received/sent and re-send it verbatim later:

```js
const captured = sock.captureUnifiedResponse(someMessage)
await sock.sendUnifiedResponse(jid, quotedMsg, captured)
```

### Interactive Messages (Buttons & AI-Rich Responses)

A second, standalone set of helpers for buttons and AI-rich bot responses,
originally developed as the separate `keithbtn` package and merged directly
into this library. Unlike the `sock.sendXxx()` methods above, these are
plain functions you call as `fn(sock, jid, options)` — `sock` is still your
regular connected socket, just passed in explicitly instead of being a
method on it.

#### Buttons — native flow (`sendButtons`)

```js
const { btn, sendButtons, sendButtonsSafe, isIOSDevice } = require('keithbaileys')

const buttons = [
	btn.url('Visit Site', 'https://example.com'),
	btn.copy('Copy Code', 'PROMO2024'),
	btn.call('Call Us', '15551234567'),
	btn.reply('Quick Reply', 'reply-id-1'),
	btn.reminder('Set Reminder', 'reminder-id-1'),
	btn.cancelReminder('Cancel Reminder', 'reminder-id-1'),
	btn.address('Send Address', 'address-id-1'),
	btn.location(),
	btn.list('Choose an option', [
		{ title: 'Section 1', rows: [{ title: 'Option A', rowId: 'opt-a' }] }
	]),
	btn.inappSignup() // config_id is optional -- omit it to send an empty buttonParamsJson: "{}"
]

await sendButtons(sock, jid, {
	text: 'Choose an option below',
	footer: 'Powered by keithbaileys',
	title: 'Header title',
	subtitle: 'Header subtitle',
	buttons
})

// Same, but automatically falls back to plain text on iOS/SMB-iOS, which
// doesn't render native flow buttons
await sendButtonsSafe(sock, jid, { text: 'Choose an option below', buttons })

// Check device support yourself, if you need to branch on it elsewhere
if (isIOSDevice(sock)) {
	console.log('This device does not support interactive buttons')
}
```

#### Buttons — classic (`sendButtonV2`)

The older `buttonsMessage`/quick-reply style, for clients or use cases that
still need it:

```js
const { sendButtonV2, ButtonV2 } = require('keithbaileys')

await sendButtonV2(sock, jid, {
	text: 'Pick an option below',
	footer: 'Powered by keithbaileys',
	buttons: [
		{ displayText: 'Option A', buttonId: 'opt_a' },
		'Option B (auto id)',
		{ raw: { buttonId: 'raw_1', buttonText: { displayText: 'Raw Button' }, type: 1 } }
	]
	// optional: thumbnail (url/buffer), media (raw setMedia payload),
	// location: { thumbnail, name, address }, contextInfo, mentions, quoted
})

// Or use the ButtonV2 builder class directly for manual chaining
const builder = new ButtonV2(sock)
builder.setBody('Pick one').addButton('Yes', 'yes').addButton('No', 'no')
await builder.send(jid)
```

#### In-App Signup

```js
const { sendInappSignup } = require('keithbaileys')

await sendInappSignup(sock, jid, {
	text: 'Sign up in-app to continue',
	title: 'MyBot',
	subtitle: 'v1',
	footer: 'In-app signup'
	// config_id: 'YOUR_META_CONFIG_ID', // optional
	// extra: { flow: 'default' }        // optional, merged into buttonParamsJson
})
```

#### AI-Rich bot responses (`sendAIRich`)

Text, code, tables, images, sources, product/post cards, tips, and
follow-up suggestion pills, all in one bot-style message:

```js
const { sendAIRich, createAIRich, AIRich } = require('keithbaileys')

await sendAIRich(sock, jid, [
	{ type: 'text', text: 'Here is a quick summary:' },
	{ type: 'code', language: 'javascript', code: 'console.log("hi")' },
	{ type: 'table', rows: [['Name', 'Score'], ['Alice', '90']] },
	{ type: 'tip', text: 'Tip: you can ask follow-up questions.' },
	{ type: 'suggest', suggestion: ['Tell me more', 'Show an example'] }
], {
	title: 'MyBot',
	footer: 'Powered by keithbaileys'
})
```

Supported block `type`s: `text`, `code`, `table`, `image`, `video`,
`source`, `reels`, `product`, `post`, `tip`, `metadata`, `suggest`,
`widget`, `footerAction`, `submessage`, `section`. Every block accepts an
`options` object passed straight to the underlying method — most support
`{ id, replace, insertAt }` for later editing/reordering.

For full manual control (chaining, id-based content management, editing an
already-sent message in place), use the builder directly:

```js
const rich = createAIRich(sock) // or: new AIRich(sock)

rich
	.setTitle('MyBot')
	.addText('Chained call works too', { id: 'intro' })
	.addSource(['https://icon.png', 'https://example.com', 'Example'])

const sent = await rich.send(jid)

// edit it in place later
rich.addText('One more thing!')
await rich.sendEdit(jid, sent.key.id)

// id-based content management
console.log(rich.getIds())      // ['intro']
console.log(rich.hasId('intro')) // true
rich.delete('intro')
```

`AIRich`'s id-based methods (`assignId`, `peek`, `delete`, and the
`replace`/`insertAt` options) throw typed errors you can catch by name:
`ItemNotFoundError`, `DuplicateIdError`, `InvalidTargetError`,
`ContentValidationError` (all instances of the base `AIRichError`, with a
`.code` and relevant metadata).

