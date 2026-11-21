"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSyncKeyAutoResolver = void 0;
const logger_1 = require("./logger");
/**
 * Ask the primary phone for the current app-state key when the credential
 * contains its id but the key material is missing locally. A key is requested
 * once per id per process; failed requests are not remembered.
 */
const makeSyncKeyAutoResolver = (deps) => {
    const { authState, requestKey } = deps;
    const log = deps.logger || logger_1.default;
    const asked = new Set();
    return async () => {
        try {
            const keyId = authState.creds.myAppStateKeyId;
            if (!keyId) {
                return 'no-id';
            }
            const stored = await authState.keys.get('app-state-sync-key', [keyId]);
            if (stored[keyId]) {
                return 'present';
            }
            if (asked.has(keyId)) {
                return 'already-asked';
            }
            await requestKey([keyId]);
            asked.add(keyId);
            return 'requested';
        }
        catch (error) {
            log.warn({ error }, 'failed to resolve the missing sync value');
            return 'failed';
        }
    };
};
exports.makeSyncKeyAutoResolver = makeSyncKeyAutoResolver;
