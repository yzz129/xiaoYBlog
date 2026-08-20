const crypto = require("crypto");

function sessionUserFromRecord(user) {
    return {
        id: Number(user.id),
        userId: Number(user.id),
        userName: user.username,
        username: user.username,
        nickName: user.nick_name || user.username,
        avatar: user.avatar || "",
        roleName: user.role_name || user.role || "user",
    };
}

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
    });
}

async function establishSession(req, user) {
    await regenerateSession(req);
    req.session.user = sessionUserFromRecord(user);
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    req.session.authenticatedAt = new Date().toISOString();
    await saveSession(req);
    return req.session.user;
}

function destroySession(req) {
    return new Promise((resolve, reject) => {
        if (!req.session) return resolve();
        req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
}

function getCurrentUser(req) {
    return req.currentUser || req.session?.user || null;
}

function csrfProtection(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (!req.session?.user) return next();

    const supplied = String(req.get("X-CSRF-Token") || "");
    const expected = String(req.session.csrfToken || "");
    if (!supplied || !expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
        res.status(403).send({ code: "403002", msg: "请求校验失败，请刷新页面后重试" });
        return;
    }
    next();
}

module.exports = { csrfProtection, destroySession, establishSession, getCurrentUser, sessionUserFromRecord };
