const crypto = require("crypto");
const Minio = require("minio");
const config = require("../config");

const minioConfig = config.minio || {};

const client = new Minio.Client({
    endPoint: minioConfig.endPoint,
    port: Number(minioConfig.port || 9000),
    useSSL: Boolean(minioConfig.useSSL),
    accessKey: minioConfig.accessKey,
    secretKey: minioConfig.secretKey,
});

let bucketReadyPromise;

function getBucketName() {
    return minioConfig.bucket || "blog-assets";
}

function getObjectPublicUrl(objectName) {
    const baseUrl =
        minioConfig.publicBaseUrl ||
        `${minioConfig.useSSL ? "https" : "http"}://${minioConfig.endPoint}:${minioConfig.port}`;

    return `${baseUrl.replace(/\/$/, "")}/${getBucketName()}/${objectName}`;
}

async function ensureBucket() {
    if (bucketReadyPromise) {
        return bucketReadyPromise;
    }

    bucketReadyPromise = (async () => {
        const bucketName = getBucketName();
        const exists = await client.bucketExists(bucketName);

        if (!exists) {
            await client.makeBucket(bucketName, minioConfig.region || "us-east-1");
        }

        const publicReadPolicy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: { AWS: ["*"] },
                    Action: ["s3:GetObject"],
                    Resource: [`arn:aws:s3:::${bucketName}/*`],
                },
            ],
        };

        await client.setBucketPolicy(bucketName, JSON.stringify(publicReadPolicy));
    })();

    return bucketReadyPromise;
}

async function uploadImage({ buffer, folder, extension, mimeType }) {
    if (!buffer || !buffer.length) {
        throw new Error("上传内容为空");
    }

    await ensureBucket();

    const objectName = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
    await client.putObject(getBucketName(), objectName, buffer, buffer.length, {
        "Content-Type": mimeType || "application/octet-stream",
    });

    return {
        bucket: getBucketName(),
        objectName,
        url: getObjectPublicUrl(objectName),
    };
}

module.exports = {
    uploadImage,
    ensureBucket,
};
