require("dotenv").config();

const required = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

function getEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  const normalizeOrigin = (value) => value ? value.replace(/\/$/, "") : undefined;
  const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter(Boolean)
    .map((host) => normalizeOrigin(host.startsWith("http") ? host : `https://${host}`));

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 4000),
    appOrigin: normalizeOrigin(process.env.APP_ORIGIN || "http://localhost:5173"),
    allowedOrigins: [...new Set(vercelOrigins)],
    mongoUri: process.env.MONGODB_URI,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
    refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "7d",
    cookieSecure: process.env.COOKIE_SECURE === "true",
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    metaAppId: process.env.META_APP_ID,
    metaAppSecret: process.env.META_APP_SECRET,
    metaLoginConfigId: process.env.META_LOGIN_CONFIG_ID,
    metaGraphVersion: process.env.META_GRAPH_VERSION || "v20.0",
    metaTokenEncryptionKey: process.env.META_TOKEN_ENCRYPTION_KEY,
    metaVerifyToken: process.env.META_VERIFY_TOKEN
  };
}

module.exports = { getEnv };
