const express = require("express");
const multer = require("multer");
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

function detectImageType(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { mimeType: "image/png", extension: ".png" };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { mimeType: "image/jpeg", extension: ".jpg" };
    }
    if (["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
        return { mimeType: "image/gif", extension: ".gif" };
    }
    if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
        return { mimeType: "image/webp", extension: ".webp" };
    }
    return null;
}

router.post("/image", upload.single("file"), async function(req, res) {
    if (!req.file) {
        res.send({
            code: "014001",
            msg: "请上传图片文件",
        });
        return;
    }

    const detectedType = detectImageType(req.file.buffer);
    if (!detectedType) {
        res.send({
            code: "014002",
            msg: "仅支持图片文件上传",
        });
        return;
    }

    try {
        const folder = sanitizeFolder(req.body.folder);
        const uploadResult = await uploadImage({
            buffer: req.file.buffer,
            folder,
            extension: detectedType.extension,
            mimeType: detectedType.mimeType,
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
