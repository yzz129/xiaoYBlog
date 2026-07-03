const express = require("express");
const multer = require("multer");
const path = require("path");
const { uploadImage } = require("../utils/minio");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

function sanitizeFolder(folder) {
    const normalized = String(folder || "common").trim().toLowerCase();
    const allowList = new Set(["avatar", "article-cover", "common"]);

    return allowList.has(normalized) ? normalized : "common";
}

router.post("/image", upload.single("file"), async function(req, res) {
    if (!req.file) {
        res.send({
            code: "014001",
            msg: "请上传图片文件",
        });
        return;
    }

    const mimeType = req.file.mimetype || "";
    if (!mimeType.startsWith("image/")) {
        res.send({
            code: "014002",
            msg: "仅支持图片文件上传",
        });
        return;
    }

    try {
        const folder = sanitizeFolder(req.body.folder);
        const extension = path.extname(req.file.originalname || "") || ".png";
        const uploadResult = await uploadImage({
            buffer: req.file.buffer,
            folder,
            extension,
            mimeType,
        });

        res.send({
            code: "0",
            data: uploadResult,
        });
    } catch (error) {
        res.send({
            code: "014003",
            msg: error.message || "图片上传失败",
        });
    }
});

module.exports = router;
