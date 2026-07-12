const crypto = require("crypto");
const { getEnv } = require("../config/env");

function keyFor(env) {
  return crypto.createHash("sha256").update(env.metaTokenEncryptionKey || env.jwtRefreshSecret).digest();
}

function encryptSecret(value) {
  const env = getEnv();
  const key = keyFor(env);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptSecret(value) {
  const env = getEnv();
  const key = keyFor(env);
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

module.exports = { encryptSecret, decryptSecret };
