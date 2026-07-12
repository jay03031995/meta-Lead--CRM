const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getEnv } = require("../config/env");

function signAccessToken(user) {
  const env = getEnv();
  return jwt.sign(
    {
      sub: String(user._id),
      organizationId: String(user.organizationId),
      clientIds: (user.clientIds || []).map(String),
      role: user.role,
      permissions: user.permissions
    },
    env.jwtAccessSecret,
    { expiresIn: env.accessTokenTtl }
  );
}

function signRefreshToken(user, tokenId) {
  const env = getEnv();
  return jwt.sign(
    {
      sub: String(user._id),
      organizationId: String(user.organizationId),
      tokenId,
      version: user.refreshTokenVersion
    },
    env.jwtRefreshSecret,
    { expiresIn: env.refreshTokenTtl }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, getEnv().jwtAccessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, getEnv().jwtRefreshSecret);
}

function newTokenId() {
  return crypto.randomBytes(24).toString("hex");
}

function refreshExpiryDate() {
  const ttl = getEnv().refreshTokenTtl;
  const days = ttl.endsWith("d") ? Number(ttl.replace("d", "")) : 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  newTokenId,
  refreshExpiryDate
};
