"use strict";

const { downloadMediaMessage, normalizeMessageContent } = require("./messages");

const MEDIA_FIELDS = [
    ["imageMessage", "image"],
    ["videoMessage", "video"],
    ["ptvMessage", "ptv"],
    ["audioMessage", "audio"]
];
const VIEW_ONCE_KEYS = ["viewOnceMessageV2Extension", "viewOnceMessageV2", "viewOnceMessage"];

const unwrap = (content) => {
    let current = content;
    for (let i = 0; i < 5 && current; i++) {
        if (current.ephemeralMessage?.message) {
            current = current.ephemeralMessage.message;
            continue;
        }
        const key = VIEW_ONCE_KEYS.find(name => current[name]?.message);
        if (key) {
            current = current[key].message;
            continue;
        }
        break;
    }
    return current;
};

const pickMedia = (content) => {
    if (!content) return null;
    for (const [field, type] of MEDIA_FIELDS) {
        if (content[field]) return { type, media: content[field] };
    }
    return null;
};

const hasMediaKeys = media => !!(media && (media.url || media.directPath || media.mediaKey));

const isViewOnceMessage = content => {
    if (!content) return false;
    const inner = content.ephemeralMessage?.message || content;
    const wrapper = VIEW_ONCE_KEYS.find(name => inner[name]);
    if (wrapper) return !!inner[wrapper]?.message;
    const normalized = unwrap(content);
    const media = pickMedia(normalized)?.media;
    return !!(media && media.viewOnce === true);
};

const getViewOnceMedia = content => {
    if (!content) return null;
    const normalized = normalizeMessageContent(content) || unwrap(content);
    const info = pickMedia(normalized);
    if (!info) return null;
    const flagged = info.media.viewOnce === true;
    if (!isViewOnceMessage(content) && !flagged) return null;
    return info;
};

const downloadBuffer = async (sock, message) => downloadMediaMessage(
    message,
    "buffer",
    {},
    { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
);

const downloadViewOnceMessage = async (sock, message) => {
    const info = getViewOnceMedia(message?.message);
    if (!info || !hasMediaKeys(info.media)) return null;
    try {
        const buffer = await downloadBuffer(sock, message);
        return buffer?.length ? buffer : null;
    }
    catch {
        return null;
    }
};

const senderOf = message => {
    const raw = message?.key?.participant || message?.key?.remoteJid || "";
    return raw.split(":")[0] || "";
};
const numericCore = jid => String(jid || "").split(":")[0].split("@")[0].replace(/\D/g, "");

const handleViewOnce = (sock, options = {}) => {
    const {
        onViewOnce,
        onError,
        senderCopyWindowMs = 300000,
        senderCopyWaitMs = 5000,
        senderCopyCacheMs = 86400000,
        includeOwn = false
    } = options;
    if (!sock?.ev || typeof onViewOnce !== "function") {
        throw new TypeError("handleViewOnce requires a socket and onViewOnce callback");
    }

    const copies = new Map();
    const pending = [];
    let stopped = false;
    let sequence = 0;

    const prune = sender => {
        const list = copies.get(sender);
        if (!list) return;
        const kept = list.filter(item => Date.now() - item.ts < senderCopyCacheMs);
        if (kept.length) copies.set(sender, kept);
        else copies.delete(sender);
    };
    const findCopy = (sender, type) => {
        prune(sender);
        const list = (copies.get(sender) || []).filter(item => Date.now() - item.ts < senderCopyWindowMs)
            .sort((a, b) => (b.ts - a.ts) || (b.seq - a.seq));
        return list.find(item => item.type === type) || list[0] || null;
    };
    const lookupCopy = (senderJid, type) => {
        const key = String(senderJid || "").split(":")[0];
        const candidates = [];
        const collect = k => {
            prune(k);
            candidates.push(...(copies.get(k) || []));
        };
        if (copies.has(key)) collect(key);
        if (!candidates.length) {
            const core = numericCore(senderJid);
            if (core) for (const k of copies.keys()) if (numericCore(k) === core) collect(k);
        }
        candidates.sort((a, b) => (b.ts - a.ts) || (b.seq - a.seq));
        return (type ? candidates.find(item => item.type === type) : candidates[0]) || null;
    };
    const deliver = async (message, info, buffer, via) => {
        const media = info.media || {};
        await onViewOnce({
            key: message.key,
            chatJid: message.key?.remoteJid || "",
            sender: senderOf(message),
            type: info.type,
            buffer,
            mimetype: media.mimetype,
            caption: media.caption,
            message,
            via
        });
    };
    const trySenderCopy = async item => {
        const copy = findCopy(item.sender, item.info.type);
        if (!copy) return false;
        try {
            const buffer = copy.buffer?.length ? copy.buffer : await downloadBuffer(sock, copy.message);
            if (!buffer?.length) return false;
            copy.buffer = buffer;
            await deliver(item.message, item.info, buffer, "sender-copy");
            return true;
        }
        catch {
            return false;
        }
    };
    const expire = () => {
        const now = Date.now();
        for (let i = pending.length - 1; i >= 0; i--) {
            if (pending[i].expires <= now) {
                const item = pending.splice(i, 1)[0];
                onError?.(new Error("View-once media arrived without keys and no sender copy was found"), item.message);
            }
        }
    };
    const timer = setInterval(expire, 1000);

    const onUpsert = async ({ messages = [] }) => {
        if (stopped) return;
        for (const message of messages) {
            try {
                if (!message.message || (!includeOwn && message.key?.fromMe)) continue;
                const sender = senderOf(message);
                const info = getViewOnceMedia(message.message);
                if (!info) {
                    const plain = pickMedia(normalizeMessageContent(message.message) || unwrap(message.message));
                    if (plain && hasMediaKeys(plain.media)) {
                        const list = copies.get(sender) || [];
                        list.push({ ts: Date.now(), seq: ++sequence, type: plain.type, message });
                        while (list.length > 10) list.shift();
                        copies.set(sender, list);
                        for (let i = pending.length - 1; i >= 0; i--) {
                            if (pending[i].sender === sender && await trySenderCopy(pending[i])) pending.splice(i, 1);
                        }
                    }
                    continue;
                }
                if (hasMediaKeys(info.media)) {
                    const buffer = await downloadViewOnceMessage(sock, message);
                    if (buffer) {
                        await deliver(message, info, buffer, "direct");
                        continue;
                    }
                }
                const item = { message, info, sender, expires: Date.now() + senderCopyWaitMs };
                if (!(await trySenderCopy(item))) pending.push(item);
            }
            catch (error) {
                onError?.(error instanceof Error ? error : new Error(String(error)), message);
            }
        }
    };

    sock.ev.on("messages.upsert", onUpsert);
    return {
        stop() {
            stopped = true;
            clearInterval(timer);
            try { sock.ev.off("messages.upsert", onUpsert); } catch {}
            pending.length = 0;
            copies.clear();
        },
        getSenderCopy(senderJid, type) {
            const copy = lookupCopy(senderJid, type);
            return copy ? { message: copy.message, type: copy.type, ts: copy.ts, buffer: copy.buffer } : null;
        },
        async downloadSenderCopy(senderJid, type) {
            const copy = lookupCopy(senderJid, type);
            if (!copy) return null;
            try {
                const buffer = copy.buffer?.length ? copy.buffer : await downloadBuffer(sock, copy.message);
                if (!buffer?.length) return null;
                copy.buffer = buffer;
                const media = pickMedia(normalizeMessageContent(copy.message.message) || unwrap(copy.message.message))?.media;
                return { buffer, type: copy.type, mimetype: media?.mimetype, message: copy.message };
            }
            catch {
                return null;
            }
        }
    };
};

module.exports = { isViewOnceMessage, getViewOnceMedia, downloadViewOnceMessage, handleViewOnce };
