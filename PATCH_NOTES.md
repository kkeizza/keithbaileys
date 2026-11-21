# keithbaileys 1.1.3 patch notes

- Includes the 1.1.2 block/unblock LID and carousel protobuf fixes.
- Tracks the active WhatsApp media host and uses it for media retry URLs.
- Preserves upload response metadata (`meta_hmac`, `fbid`, and `ts`) alongside the media URL/direct path.
- Sends explicit encrypted-file `Content-Length` during media upload.
- Adds safer remote-media size enforcement while encrypting streams.
- Correctly distinguishes PN, LID, hosted PN, and hosted LID domains when decoding JIDs.
- Keeps Keithbaileys CommonJS and custom Buttons/AIRich/rich-message layers intact.
