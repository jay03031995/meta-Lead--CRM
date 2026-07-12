const crypto = require("crypto");
const MetaConnection = require("../models/MetaConnection");
const { getEnv } = require("../config/env");
const { encryptSecret } = require("../utils/encryption");
const { httpError } = require("../utils/httpError");

const scopes = ["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "leads_retrieval", "business_management", "ads_read"];

function callbackUrl(env) {
  return `${env.appOrigin}/api/auth/meta/callback`;
}

function startMetaLogin(req, res) {
  const env = getEnv();
  if (!env.metaAppId || !env.metaAppSecret) throw httpError(503, "Meta App credentials are not configured");
  const state = crypto.randomBytes(24).toString("base64url");
  res.cookie("metaOAuthState", state, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/api/auth/meta",
    maxAge: 10 * 60 * 1000
  });
  const params = new URLSearchParams({
    client_id: env.metaAppId,
    redirect_uri: callbackUrl(env),
    scope: scopes.join(","),
    response_type: "code",
    state
  });
  res.redirect(`https://www.facebook.com/${env.metaGraphVersion}/dialog/oauth?${params}`);
}

async function metaCallback(req, res) {
  const env = getEnv();
  if (!req.query.state || req.query.state !== req.cookies.metaOAuthState) throw httpError(400, "Invalid Meta OAuth state");
  if (!req.query.code) throw httpError(400, req.query.error_description || "Meta authorization code missing");

  const tokenParams = new URLSearchParams({
    client_id: env.metaAppId,
    client_secret: env.metaAppSecret,
    redirect_uri: callbackUrl(env),
    code: String(req.query.code)
  });
  const tokenResponse = await fetch(`https://graph.facebook.com/${env.metaGraphVersion}/oauth/access_token?${tokenParams}`);
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) throw httpError(502, tokenData.error?.message || "Meta token exchange failed");

  const profileResponse = await fetch(`https://graph.facebook.com/${env.metaGraphVersion}/me?fields=id,name&access_token=${encodeURIComponent(tokenData.access_token)}`);
  const profile = await profileResponse.json();
  if (!profileResponse.ok) throw httpError(502, profile.error?.message || "Meta profile request failed");

  await MetaConnection.findOneAndUpdate(
    { organizationId: req.user.organizationId },
    {
      organizationId: req.user.organizationId,
      connectedByUserId: req.user.id,
      metaUserId: profile.id,
      metaUserName: profile.name,
      encryptedAccessToken: encryptSecret(tokenData.access_token),
      tokenExpiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
      scopes,
      status: "connected",
      lastSyncAt: new Date()
    },
    { upsert: true, new: true, runValidators: true }
  );
  res.clearCookie("metaOAuthState", { path: "/api/auth/meta" });
  res.redirect(`${env.appOrigin}/?meta=connected`);
}

async function metaStatus(req, res) {
  const connection = await MetaConnection.findOne({ organizationId: req.user.organizationId }).lean();
  res.json({
    connection: connection ? { connected: connection.status === "connected", business: connection.metaUserName || "Meta account", lastSync: connection.lastSyncAt } : { connected: false }
  });
}

module.exports = { startMetaLogin, metaCallback, metaStatus };
