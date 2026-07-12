const crypto = require("crypto");
const { getEnv } = require("../config/env");

function encryptSecret(value) {
  const env = getEnv();
  const key = crypto.createHash("sha256").update(env.metaTokenEncryptionKey || env.jwtRefreshSecret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

module.exports = { encryptSecret };
