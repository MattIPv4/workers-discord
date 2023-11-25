// Thanks https://gist.github.com/devsnek/77275f6e3f810a9545440931ed314dc1
const hex2bin = (hex) => {
    const buf = new Uint8Array(Math.ceil(hex.length / 2));
    for (let i = 0; i < buf.length; i++) {
        buf[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return buf;
};
/**
 * Import a hex-encoded key into a CryptoKey
 */
export const importKey = (key) => crypto.subtle.importKey('raw', hex2bin(key), {
    name: 'NODE-ED25519',
    namedCurve: 'NODE-ED25519',
}, true, ['verify']);
/**
 * Verify a request from Discord
 */
export const verifyRequest = (request, bodyText, publicKey) => {
    const timestamp = request.headers.get('X-Signature-Timestamp') || '';
    const signature = hex2bin(request.headers.get('X-Signature-Ed25519') || '');
    return crypto.subtle.verify('NODE-ED25519', publicKey, signature, new TextEncoder().encode(timestamp + bodyText));
};
