"use strict";

const { promises: fs } = require("fs");
const protobuf = require("protobufjs/minimal");
const { proto } = require("../../WAProto");
const { encryptedStream } = require("./messages-media");
const { generateMessageIDV2 } = require("./generics");

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const toBytes = (value) => {
    if (value == null) return value;
    if (typeof value === "string") return Buffer.from(value, "base64");
    return value;
};

const ChatCustomImageWallpaper = {
    create(properties) {
        return { ...(properties || {}) };
    },
    encode(message, writer) {
        writer = writer || protobuf.Writer.create();
        if (message.directPath != null && hasOwn(message, "directPath")) writer.uint32(10).string(message.directPath);
        if (message.mediaKey != null && hasOwn(message, "mediaKey")) writer.uint32(18).bytes(message.mediaKey);
        if (message.fileEncSha256 != null && hasOwn(message, "fileEncSha256")) writer.uint32(26).bytes(message.fileEncSha256);
        if (message.fileSha256 != null && hasOwn(message, "fileSha256")) writer.uint32(34).bytes(message.fileSha256);
        if (message.dimLevel != null && hasOwn(message, "dimLevel")) writer.uint32(45).float(message.dimLevel);
        return writer;
    },
    decode(input, length) {
        const reader = input instanceof protobuf.Reader ? input : protobuf.Reader.create(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = {};
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.directPath = reader.string(); break;
                case 2: message.mediaKey = reader.bytes(); break;
                case 3: message.fileEncSha256 = reader.bytes(); break;
                case 4: message.fileSha256 = reader.bytes(); break;
                case 5: message.dimLevel = reader.float(); break;
                default: reader.skipType(tag & 7); break;
            }
        }
        return message;
    },
    fromObject(value) {
        return {
            ...(value || {}),
            ...(value && value.mediaKey != null ? { mediaKey: toBytes(value.mediaKey) } : {}),
            ...(value && value.fileEncSha256 != null ? { fileEncSha256: toBytes(value.fileEncSha256) } : {}),
            ...(value && value.fileSha256 != null ? { fileSha256: toBytes(value.fileSha256) } : {})
        };
    },
    toObject(value, options = {}) {
        const result = { ...value };
        for (const key of ["mediaKey", "fileEncSha256", "fileSha256"]) {
            if (result[key] != null && options.bytes === String) result[key] = Buffer.from(result[key]).toString("base64");
            else if (result[key] != null && options.bytes === Array) result[key] = Array.from(result[key]);
        }
        return result;
    }
};

const ChatDefaultWallpaper = {
    encode(message, writer) {
        writer = writer || protobuf.Writer.create();
        if (message.isDoodleEnabled != null) writer.uint32(8).bool(message.isDoodleEnabled);
        return writer;
    },
    decode(input, length) {
        const reader = input instanceof protobuf.Reader ? input : protobuf.Reader.create(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = {};
        while (reader.pos < end) {
            const tag = reader.uint32();
            if ((tag >>> 3) === 1) message.isDoodleEnabled = reader.bool();
            else reader.skipType(tag & 7);
        }
        return message;
    },
    fromObject(value) { return { isDoodleEnabled: value?.isDoodleEnabled }; },
    toObject(value) { return { ...value }; }
};

const ChatSolidColorWallpaper = {
    encode(message, writer) {
        writer = writer || protobuf.Writer.create();
        if (message.colorLight != null) writer.uint32(10).string(message.colorLight);
        if (message.colorDark != null) writer.uint32(18).string(message.colorDark);
        if (message.isDoodleEnabled != null) writer.uint32(24).bool(message.isDoodleEnabled);
        return writer;
    },
    decode(input, length) {
        const reader = input instanceof protobuf.Reader ? input : protobuf.Reader.create(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = {};
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.colorLight = reader.string(); break;
                case 2: message.colorDark = reader.string(); break;
                case 3: message.isDoodleEnabled = reader.bool(); break;
                default: reader.skipType(tag & 7);
            }
        }
        return message;
    },
    fromObject(value) { return { ...(value || {}) }; },
    toObject(value) { return { ...value }; }
};

const ChatStockImageWallpaper = {
    encode(message, writer) {
        writer = writer || protobuf.Writer.create();
        if (message.stockImageId != null) writer.uint32(10).string(message.stockImageId);
        if (message.dimLevel != null) writer.uint32(21).float(message.dimLevel);
        return writer;
    },
    decode(input, length) {
        const reader = input instanceof protobuf.Reader ? input : protobuf.Reader.create(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = {};
        while (reader.pos < end) {
            const tag = reader.uint32();
            if ((tag >>> 3) === 1) message.stockImageId = reader.string();
            else if ((tag >>> 3) === 2) message.dimLevel = reader.float();
            else reader.skipType(tag & 7);
        }
        return message;
    },
    fromObject(value) { return { ...(value || {}) }; },
    toObject(value) { return { ...value }; }
};

const ChatThemeSetting = {
    create(properties) {
        return { ...(properties || {}) };
    },
    encode(message, writer) {
        writer = writer || protobuf.Writer.create();
        if (message.settingTimestampMs != null && hasOwn(message, "settingTimestampMs")) writer.uint32(8).int64(message.settingTimestampMs);
        if (message.clearTheme != null && hasOwn(message, "clearTheme")) writer.uint32(16).bool(message.clearTheme);
        if (message.colorSchemeId != null && hasOwn(message, "colorSchemeId")) writer.uint32(26).string(message.colorSchemeId);
        if (message.defaultWallpaper != null) ChatDefaultWallpaper.encode(message.defaultWallpaper, writer.uint32(82).fork()).ldelim();
        if (message.solidColor != null) ChatSolidColorWallpaper.encode(message.solidColor, writer.uint32(90).fork()).ldelim();
        if (message.stockImage != null) ChatStockImageWallpaper.encode(message.stockImage, writer.uint32(98).fork()).ldelim();
        if (message.customImage != null && hasOwn(message, "customImage")) {
            ChatCustomImageWallpaper.encode(message.customImage, writer.uint32(106).fork()).ldelim();
        }
        return writer;
    },
    decode(input, length) {
        const reader = input instanceof protobuf.Reader ? input : protobuf.Reader.create(input);
        const end = length === undefined ? reader.len : reader.pos + length;
        const message = {};
        while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
                case 1: message.settingTimestampMs = reader.int64(); break;
                case 2: message.clearTheme = reader.bool(); break;
                case 3: message.colorSchemeId = reader.string(); break;
                case 10: message.defaultWallpaper = ChatDefaultWallpaper.decode(reader, reader.uint32()); break;
                case 11: message.solidColor = ChatSolidColorWallpaper.decode(reader, reader.uint32()); break;
                case 12: message.stockImage = ChatStockImageWallpaper.decode(reader, reader.uint32()); break;
                case 13: message.customImage = ChatCustomImageWallpaper.decode(reader, reader.uint32()); break;
                default: reader.skipType(tag & 7); break;
            }
        }
        return message;
    },
    fromObject(value) {
        const result = { ...(value || {}) };
        if (result.settingTimestampMs != null) result.settingTimestampMs = Number(result.settingTimestampMs);
        if (result.defaultWallpaper != null) result.defaultWallpaper = ChatDefaultWallpaper.fromObject(result.defaultWallpaper);
        if (result.solidColor != null) result.solidColor = ChatSolidColorWallpaper.fromObject(result.solidColor);
        if (result.stockImage != null) result.stockImage = ChatStockImageWallpaper.fromObject(result.stockImage);
        if (result.customImage != null) result.customImage = ChatCustomImageWallpaper.fromObject(result.customImage);
        return result;
    },
    toObject(value, options = {}) {
        return {
            ...value,
            ...(value && value.defaultWallpaper ? { defaultWallpaper: ChatDefaultWallpaper.toObject(value.defaultWallpaper, options) } : {}),
            ...(value && value.solidColor ? { solidColor: ChatSolidColorWallpaper.toObject(value.solidColor, options) } : {}),
            ...(value && value.stockImage ? { stockImage: ChatStockImageWallpaper.toObject(value.stockImage, options) } : {}),
            ...(value && value.customImage ? { customImage: ChatCustomImageWallpaper.toObject(value.customImage, options) } : {})
        };
    }
};

function installChatWallpaperProtocol() {
    const protocolMessage = proto.Message.ProtocolMessage;
    if (protocolMessage.__keithChatWallpaperPatched) return;

    proto.Message.ChatCustomImageWallpaper = ChatCustomImageWallpaper;
    proto.Message.ChatThemeSetting = ChatThemeSetting;
    protocolMessage.Type.CHAT_THEME_SETTING = 34;
    protocolMessage.Type[34] = "CHAT_THEME_SETTING";
    protocolMessage.prototype.chatThemeSetting = null;

    const encode = protocolMessage.encode;
    protocolMessage.encode = function encodeWithChatTheme(message, writer) {
        const theme = message && message.chatThemeSetting;
        if (!theme) return encode.call(this, message, writer);
        const copy = { ...message };
        delete copy.chatThemeSetting;
        const result = encode.call(this, copy, writer);
        ChatThemeSetting.encode(theme, result.uint32(242).fork()).ldelim();
        return result;
    };

    const fromObject = protocolMessage.fromObject;
    protocolMessage.fromObject = function fromObjectWithChatTheme(value) {
        if (!value || value.chatThemeSetting == null) return fromObject.call(this, value);
        const copy = { ...value };
        delete copy.chatThemeSetting;
        const result = fromObject.call(this, copy);
        result.chatThemeSetting = ChatThemeSetting.fromObject(value.chatThemeSetting);
        return result;
    };

    const decode = protocolMessage.decode;
    protocolMessage.decode = function decodeWithChatTheme(input, length) {
        const reader = input instanceof protobuf.Reader ? input : protobuf.Reader.create(input);
        const start = reader.pos;
        const result = decode.call(this, input, length);
        const end = length === undefined ? reader.len : start + length;
        reader.pos = start;
        while (reader.pos < end) {
            const tag = reader.uint32();
            if ((tag >>> 3) === 30) {
                result.chatThemeSetting = ChatThemeSetting.decode(reader, reader.uint32());
            }
            else {
                reader.skipType(tag & 7);
            }
        }
        return result;
    };

    const toObject = protocolMessage.toObject;
    protocolMessage.toObject = function toObjectWithChatTheme(value, options) {
        const result = toObject.call(this, value, options);
        if (value && value.chatThemeSetting != null) {
            result.chatThemeSetting = ChatThemeSetting.toObject(value.chatThemeSetting, options);
        }
        return result;
    };

    const verify = protocolMessage.verify;
    protocolMessage.verify = function verifyWithChatTheme(value) {
        if (value && value.chatThemeSetting != null) {
            const copy = { ...value };
            delete copy.chatThemeSetting;
            const error = verify.call(this, copy);
            if (error) return error;
            if (typeof value.chatThemeSetting !== "object") return "chatThemeSetting: object expected";
        }
        return verify.call(this, value && value.chatThemeSetting != null ? { ...value, chatThemeSetting: undefined } : value);
    };

    Object.defineProperty(protocolMessage, "__keithChatWallpaperPatched", { value: true });
}

installChatWallpaperProtocol();

async function setChatWallpaper(sock, jid, image, options = {}) {
    if (!sock || typeof sock.waUploadToServer !== "function" || typeof sock.relayMessage !== "function") {
        throw new TypeError("setChatWallpaper requires a socket with waUploadToServer and relayMessage");
    }
    if (!jid || typeof jid !== "string") throw new TypeError("jid must be a chat JID");

    const media = Buffer.isBuffer(image) || image instanceof Uint8Array
        ? image
        : typeof image === "string"
            ? { url: image }
            : image;
    const encrypted = await encryptedStream(media, "chat-wallpaper-image", { logger: sock.logger });
    let uploaded;
    try {
        uploaded = await sock.waUploadToServer(encrypted.encFilePath, {
            mediaType: "chat-wallpaper-image",
            fileEncSha256B64: encrypted.fileEncSha256.toString("base64"),
            timeoutMs: options.mediaUploadTimeoutMs
        });
    } finally {
        await fs.unlink(encrypted.encFilePath).catch(() => {});
    }

    const directPath = uploaded && (uploaded.directPath || uploaded.direct_path);
    if (!directPath) throw new Error("wallpaper upload returned no directPath");

    const message = {
        protocolMessage: {
            type: proto.Message.ProtocolMessage.Type.CHAT_THEME_SETTING,
            chatThemeSetting: {
                settingTimestampMs: options.settingTimestampMs ?? Date.now(),
                customImage: {
                    directPath,
                    mediaKey: encrypted.mediaKey,
                    fileEncSha256: encrypted.fileEncSha256,
                    fileSha256: encrypted.fileSha256,
                    dimLevel: options.dimLevel ?? 0
                }
            }
        }
    };
    const messageId = options.messageId || generateMessageIDV2(sock.user && sock.user.id);
    await sock.relayMessage(jid, message, {
        messageId,
        additionalAttributes: { type: "media" }
    });
    return { key: { remoteJid: jid, fromMe: true, id: messageId }, message };
}

async function setChatTheme(sock, jid, theme = {}, options = {}) {
    if (!sock || typeof sock.relayMessage !== "function") {
        throw new TypeError("setChatTheme requires a socket with relayMessage");
    }
    if (!jid || typeof jid !== "string") throw new TypeError("jid must be a chat JID");
    const chatThemeSetting = {
        settingTimestampMs: options.settingTimestampMs ?? Date.now(),
        ...theme
    };
    const messageId = options.messageId || generateMessageIDV2(sock.user && sock.user.id);
    const message = {
        protocolMessage: {
            type: proto.Message.ProtocolMessage.Type.CHAT_THEME_SETTING,
            chatThemeSetting
        }
    };
    await sock.relayMessage(jid, message, {
        messageId,
        additionalAttributes: { type: "media" }
    });
    return { key: { remoteJid: jid, fromMe: true, id: messageId }, message };
}

module.exports = { setChatWallpaper, setChatTheme, installChatWallpaperProtocol };
