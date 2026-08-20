const express = require("express");
const router = express.Router();
const errcode = require("../utils/errcode");
const authMap = require("../permissions/auth");

/**
 * base controller
 * 权限校验
 */
router.use(function(req, res, next) {
    const fullPath = req.originalUrl.split("?")[0];
    let authority = authMap.get(fullPath);

    if (!authority) {
        for (const [pattern, value] of authMap.entries()) {
            if (!pattern.includes(":")) {
                continue;
            }

            const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, "[^/]+")}$`);
            if (regex.test(fullPath)) {
                authority = value;
                break;
            }
        }
    }

    if (!authority) {
        next();
        return;
    }

    const currentUser = req.session?.user;
    if (!currentUser) {
        res.send({
            ...errcode.AUTH.UNAUTHORIZED,
        });
        return;
    }

    const hasPermission = currentUser.roleName === authority.role ||
        (authority.role === "user" && currentUser.roleName === "admin");
    if (!hasPermission) {
        res.send({
            ...errcode.AUTH.FORBIDDEN,
        });
        return;
    }

    req.currentUser = currentUser;
    next();
});

module.exports = router;
