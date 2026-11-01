/**
 * OS-backed secret storage for the Electron main process.
 *
 * Uses Electron's safeStorage (Keychain / DPAPI / libsecret) through its async
 * API. When the OS has no usable backend (e.g. headless Linux without a
 * keyring), encryption is reported unavailable and the config layer keeps the
 * previous behaviour instead of pretending the value is protected.
 *
 * The availability probe talks to the desktop keyring over DBus on Linux; a
 * wedged session bus must not stop the app from starting, so it is bounded.
 */
import { safeStorage } from 'electron';
import type { SecretCodec } from '../config';

const AVAILABILITY_TIMEOUT_MS = 2000;

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((resolve) => {
                timer = setTimeout(() => resolve(fallback), ms);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export async function createElectronSecretCodec(): Promise<SecretCodec> {
    let available = false;
    try {
        available = await withTimeout(safeStorage.isAsyncEncryptionAvailable(), AVAILABILITY_TIMEOUT_MS, false);
    } catch {
        available = false;
    }

    if (!available) {
        console.warn('[Secrets] OS keyring unavailable; the API key cannot be encrypted at rest');
    } else {
        try {
            const backend = safeStorage.getSelectedStorageBackend();
            if (backend === 'basic_text') {
                console.warn('[Secrets] No OS keyring available; using Electron basic_text storage');
            }
        } catch {
            /* backend reporting is best-effort */
        }
    }

    return {
        get available() {
            return available;
        },
        async encrypt(plain: string): Promise<string> {
            const encrypted = await safeStorage.encryptStringAsync(plain);
            return 'v1:' + encrypted.toString('base64');
        },
        async decrypt(blob: string): Promise<string> {
            if (!blob.startsWith('v1:')) throw new Error('Unsupported secret format');
            const result = await safeStorage.decryptStringAsync(Buffer.from(blob.slice(3), 'base64'));
            return result.result;
        },
    };
}
