const assert = require("assert");

const { hashCredential, verifyCredential } = require("../utils/password");

async function main() {
    const credential = "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592";
    const firstHash = await hashCredential(credential);
    const secondHash = await hashCredential(credential);

    assert.match(firstHash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    assert.notStrictEqual(firstHash, secondHash, "每次哈希必须使用独立随机盐");
    assert.deepStrictEqual(await verifyCredential(credential, firstHash), { valid: true, needsUpgrade: false });
    assert.deepStrictEqual(await verifyCredential(`${credential}0`, firstHash), { valid: false, needsUpgrade: false });
    assert.deepStrictEqual(await verifyCredential(credential, credential), { valid: true, needsUpgrade: true });
    assert.deepStrictEqual(await verifyCredential(`${credential}0`, credential), { valid: false, needsUpgrade: true });

    console.log("Password security checks passed: salted hashes, verification, tamper rejection, legacy migration.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
