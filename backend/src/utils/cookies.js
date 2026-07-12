const { getEnv } = require("../config/env");

function setAuthCookies(res, accessToken, refreshToken) {
  const env = getEnv();
  const common = {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    domain: env.cookieDomain,
    path: "/"
  };
  res.cookie("accessToken", accessToken, { ...common, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { ...common, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res) {
  const env = getEnv();
  const common = {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    domain: env.cookieDomain,
    path: "/"
  };
  res.clearCookie("accessToken", common);
  res.clearCookie("refreshToken", common);
}

module.exports = { setAuthCookies, clearAuthCookies };
