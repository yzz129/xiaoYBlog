const express = require("express");
const router = express.Router();
const errcode = require("../utils/errcode");
const authMap = require("../permissions/auth");
const jwt = require("jsonwebtoken");
const config = require("../config");

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

    const token = req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : undefined;
    if (!token) {
        res.send({
            ...errcode.AUTH.UNAUTHORIZED,
        });
        return;
    }

    jwt.verify(token, config.jwt.secret, (err, payload) => {
        if (err) {
            console.error(err);
            res.send({
                ...errcode.AUTH.UNAUTHORIZED,
            });
            return;
        }

        const hasPermission =
            payload.roleName === authority.role || (authority.role === "user" && payload.roleName === "admin");

        if (!hasPermission) {
            res.send({
                ...errcode.AUTH.FORBIDDEN,
            });
            return;
        }

        req.currentUser = payload;
        next();
    });
});

module.exports = router;
