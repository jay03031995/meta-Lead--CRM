require("dotenv").config();

const required = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

function getEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 4000),
    appOrigin: process.env.APP_ORIGIN || "http://localhost:5173",
    mongoUri: process.env.MONGODB_URI,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
    refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "7d",
    cookieSecure: process.env.COOKIE_SECURE === "true",
    cookieDomain: process.env.COOKIE_DOMAIN || undefined
  };
}

module.exports = { getEnv };
