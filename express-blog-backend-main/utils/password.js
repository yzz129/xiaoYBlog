const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const PREFIX = "scrypt";
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function safeEqual(left, right) {
    const leftBuffer = Buffer.from(String(left || ""), "utf8");
    const rightBuffer = Buffer.from(String(right || ""), "utf8");
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function hashCredential(credential) {
    const normalized = String(credential || "");
    if (!normalized) throw new Error("凭证不能为空");

    const salt = crypto.randomBytes(SALT_BYTES);
    const derivedKey = await scrypt(normalized, salt, KEY_BYTES);
    return `${PREFIX}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function verifyCredential(credential, storedValue) {
    const normalized = String(credential || "");
    const stored = String(storedValue || "");
    const [algorithm, saltHex, keyHex, extra] = stored.split("$");

    if (algorithm !== PREFIX) {
        return { valid: safeEqual(normalized, stored), needsUpgrade: true };
    }

    if (extra !== undefined || !/^[a-f0-9]{32}$/i.test(saltHex || "") || !/^[a-f0-9]{64}$/i.test(keyHex || "")) {
        return { valid: false, needsUpgrade: false };
    }

    const expected = Buffer.from(keyHex, "hex");
    const actual = await scrypt(normalized, Buffer.from(saltHex, "hex"), expected.length);
    return { valid: crypto.timingSafeEqual(actual, expected), needsUpgrade: false };
}

module.exports = {
    hashCredential,
    verifyCredential,
};
