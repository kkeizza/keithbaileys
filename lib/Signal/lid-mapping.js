"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIDMappingStore = void 0;
const WABinary_1 = require("../WABinary");
const MAPPING_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
/**
 * A minimal TTL cache used instead of the `lru-cache` package so this file
 * doesn't require adding a new dependency to keithbaileys.
 */
class SimpleTTLCache {
    constructor(ttlMs) {
        this.ttlMs = ttlMs;
        this.map = new Map();
    }
    get(key) {
        const entry = this.map.get(key);
        if (!entry)
            return undefined;
        if (Date.now() - entry.t > this.ttlMs) {
            this.map.delete(key);
            return undefined;
        }
        entry.t = Date.now(); // updateAgeOnGet
        return entry.v;
    }
    set(key, value) {
        this.map.set(key, { v: value, t: Date.now() });
    }
    delete(key) {
        this.map.delete(key);
    }
}
class LIDMappingStore {
    constructor(keys, logger, pnToLIDFunc) {
        this.mappingCache = new SimpleTTLCache(MAPPING_TTL_MS);
        this.inflightLIDLookups = new Map();
        this.inflightPNLookups = new Map();
        this.keys = keys;
        this.pnToLIDFunc = pnToLIDFunc;
        this.logger = logger || console;
    }
    async storeLIDPNMappings(pairs) {
        if (!pairs || pairs.length === 0)
            return;
        const validatedPairs = [];
        for (const { lid, pn } of pairs) {
            if (!((0, WABinary_1.isLidUser)(lid) && (0, WABinary_1.isPnUser)(pn)) &&
                !((0, WABinary_1.isPnUser)(lid) && (0, WABinary_1.isLidUser)(pn))) {
                this.logger.warn?.(`Invalid LID-PN mapping: ${lid}, ${pn}`);
                continue;
            }
            const lidDecoded = (0, WABinary_1.jidDecode)(lid);
            const pnDecoded = (0, WABinary_1.jidDecode)(pn);
            if (!lidDecoded || !pnDecoded)
                continue;
            validatedPairs.push({ pnUser: pnDecoded.user, lidUser: lidDecoded.user });
        }
        if (validatedPairs.length === 0)
            return;
        const cacheMissSet = new Set();
        const existingMappings = new Map();
        for (const { pnUser } of validatedPairs) {
            const cached = this.mappingCache.get(`pn:${pnUser}`);
            if (cached) {
                existingMappings.set(pnUser, cached);
            }
            else {
                cacheMissSet.add(pnUser);
            }
        }
        if (cacheMissSet.size > 0) {
            const cacheMisses = [...cacheMissSet];
            const stored = await this.keys.get('lid-mapping', cacheMisses);
            for (const pnUser of cacheMisses) {
                const existingLidUser = stored[pnUser];
                if (existingLidUser) {
                    existingMappings.set(pnUser, existingLidUser);
                    this.mappingCache.set(`pn:${pnUser}`, existingLidUser);
                    this.mappingCache.set(`lid:${existingLidUser}`, pnUser);
                }
            }
        }
        const pairMap = {};
        for (const { pnUser, lidUser } of validatedPairs) {
            const existingLidUser = existingMappings.get(pnUser);
            if (existingLidUser === lidUser) {
                continue;
            }
            pairMap[pnUser] = lidUser;
        }
        if (Object.keys(pairMap).length === 0)
            return;
        const batchData = {};
        for (const [pnUser, lidUser] of Object.entries(pairMap)) {
            batchData[pnUser] = lidUser;
            batchData[`${lidUser}_reverse`] = pnUser;
            const oldLidUser = existingMappings.get(pnUser);
            if (oldLidUser && oldLidUser !== lidUser) {
                batchData[`${oldLidUser}_reverse`] = null;
            }
        }
        if (this.keys.transaction) {
            await this.keys.transaction(async () => {
                await this.keys.set({ 'lid-mapping': batchData });
            }, 'lid-mapping');
        }
        else {
            await this.keys.set({ 'lid-mapping': batchData });
        }
        for (const [pnUser, lidUser] of Object.entries(pairMap)) {
            this.mappingCache.set(`pn:${pnUser}`, lidUser);
            this.mappingCache.set(`lid:${lidUser}`, pnUser);
            const oldLidUser = existingMappings.get(pnUser);
            if (oldLidUser && oldLidUser !== lidUser) {
                this.mappingCache.delete(`lid:${oldLidUser}`);
            }
        }
    }
    async getLIDForPN(pn) {
        var _a, _b;
        return ((_b = (_a = (await this.getLIDsForPNs([pn]))) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.lid) || null;
    }
    async getLIDsForPNs(pns) {
        if (!pns || pns.length === 0)
            return null;
        const sortedPns = [...new Set(pns)].sort();
        const cacheKey = sortedPns.join(',');
        const inflight = this.inflightLIDLookups.get(cacheKey);
        if (inflight) {
            return inflight;
        }
        const promise = this._getLIDsForPNsImpl(pns);
        this.inflightLIDLookups.set(cacheKey, promise);
        try {
            return await promise;
        }
        finally {
            this.inflightLIDLookups.delete(cacheKey);
        }
    }
    async _getLIDsForPNsImpl(pns) {
        const usyncFetch = {};
        const successfulPairs = {};
        for (const pn of pns) {
            if (!(0, WABinary_1.isPnUser)(pn) && !(0, WABinary_1.isHostedPnUser)(pn))
                continue;
            const decoded = (0, WABinary_1.jidDecode)(pn);
            if (!decoded)
                continue;
            const pnUser = decoded.user;
            let lidUser = this.mappingCache.get(`pn:${pnUser}`);
            if (!lidUser) {
                const stored = await this.keys.get('lid-mapping', [pnUser]);
                lidUser = stored[pnUser];
                if (lidUser) {
                    this.mappingCache.set(`pn:${pnUser}`, lidUser);
                    this.mappingCache.set(`lid:${lidUser}`, pnUser);
                }
                else {
                    const device = decoded.device || 0;
                    let normalizedPn = (0, WABinary_1.jidNormalizedUser)(pn);
                    if ((0, WABinary_1.isHostedPnUser)(normalizedPn)) {
                        normalizedPn = `${pnUser}@s.whatsapp.net`;
                    }
                    if (!usyncFetch[normalizedPn]) {
                        usyncFetch[normalizedPn] = [device];
                    }
                    else {
                        usyncFetch[normalizedPn].push(device);
                    }
                    continue;
                }
            }
            lidUser = lidUser.toString();
            if (!lidUser) {
                this.logger.warn?.(`Invalid or empty LID user for PN ${pn}`);
                return null;
            }
            const pnDevice = decoded.device !== undefined ? decoded.device : 0;
            const deviceSpecificLid = `${lidUser}${pnDevice ? `:${pnDevice}` : ``}@${decoded.server === 'hosted' ? 'hosted.lid' : 'lid'}`;
            successfulPairs[pn] = { lid: deviceSpecificLid, pn };
        }
        if (Object.keys(usyncFetch).length > 0) {
            const result = this.pnToLIDFunc ? await this.pnToLIDFunc(Object.keys(usyncFetch)) : null;
            if (result && result.length > 0) {
                await this.storeLIDPNMappings(result);
                for (const pair of result) {
                    const pnDecoded = (0, WABinary_1.jidDecode)(pair.pn);
                    const pnUser = pnDecoded === null || pnDecoded === void 0 ? void 0 : pnDecoded.user;
                    if (!pnUser)
                        continue;
                    const lidDecoded = (0, WABinary_1.jidDecode)(pair.lid);
                    const lidUser = lidDecoded === null || lidDecoded === void 0 ? void 0 : lidDecoded.user;
                    if (!lidUser)
                        continue;
                    for (const device of (usyncFetch[pair.pn] || [])) {
                        const deviceSpecificLid = `${lidUser}${device ? `:${device}` : ``}@${device === 99 ? 'hosted.lid' : 'lid'}`;
                        const deviceSpecificPn = `${pnUser}${device ? `:${device}` : ``}@${device === 99 ? 'hosted' : 's.whatsapp.net'}`;
                        successfulPairs[deviceSpecificPn] = { lid: deviceSpecificLid, pn: deviceSpecificPn };
                    }
                }
            }
            else {
                return null;
            }
        }
        return Object.values(successfulPairs);
    }
    /** Get PNs for LIDs - user level, with device numbers reattached */
    async getPNsForLIDs(lids) {
        const result = [];
        const missingLids = [];
        for (const lid of lids) {
            if (!(0, WABinary_1.isLidUser)(lid)) {
                continue;
            }
            const decoded = (0, WABinary_1.jidDecode)(lid);
            if (!decoded) {
                continue;
            }
            const lidUser = decoded.user;
            const pnUser = this.mappingCache.get(`lid:${lidUser}`);
            if (!pnUser || typeof pnUser !== 'string') {
                missingLids.push(lidUser);
            }
            else {
                const lidDevice = decoded.device !== undefined ? decoded.device : 0;
                const domain = decoded.domainType === WABinary_1.WAJIDDomains.HOSTED_LID ? 'hosted' : 's.whatsapp.net';
                const pnJid = `${pnUser}${lidDevice ? `:${lidDevice}` : ``}@${domain}`;
                result.push({ lid, pn: pnJid });
            }
        }
        if (missingLids.length > 0) {
            const lookupKeys = missingLids.map(l => `${l}_reverse`);
            const stored = await this.keys.get('lid-mapping', lookupKeys);
            for (const lidUser of missingLids) {
                const pnUser = stored[`${lidUser}_reverse`];
                if (pnUser && typeof pnUser === 'string') {
                    this.mappingCache.set(`lid:${lidUser}`, pnUser);
                    for (const lid of lids) {
                        const decoded = (0, WABinary_1.jidDecode)(lid);
                        if (decoded && decoded.user === lidUser) {
                            const lidDevice = decoded.device !== undefined ? decoded.device : 0;
                            const domain = decoded.domainType === WABinary_1.WAJIDDomains.HOSTED_LID ? 'hosted' : 's.whatsapp.net';
                            const pnJid = `${pnUser}${lidDevice ? `:${lidDevice}` : ``}@${domain}`;
                            result.push({ lid, pn: pnJid });
                        }
                    }
                }
            }
        }
        return result;
    }
    async getPNForLID(lid) {
        var _a, _b;
        const results = await this.getPNsForLIDs([lid]);
        return ((_b = (_a = results) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.pn) || null;
    }
}
exports.LIDMappingStore = LIDMappingStore;
