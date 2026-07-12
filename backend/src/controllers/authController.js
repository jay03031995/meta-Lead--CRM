const Organization = require("../models/Organization");
const RefreshSession = require("../models/RefreshSession");
const User = require("../models/User");
const { httpError } = require("../utils/httpError");
const { clearAuthCookies, setAuthCookies } = require("../utils/cookies");
const {
  newTokenId,
  refreshExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} = require("../utils/tokens");

function publicUser(user) {
  return {
    id: String(user._id),
    organizationId: String(user.organizationId),
    clientIds: (user.clientIds || []).map(String),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: user.permissions
  };
}

async function issueTokens(req, res, user) {
  const tokenId = newTokenId();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, tokenId);
  await RefreshSession.create({
    organizationId: user.organizationId,
    userId: user._id,
    tokenId,
    userAgent: req.get("user-agent"),
    ip: req.ip,
    expiresAt: refreshExpiryDate()
  });
  setAuthCookies(res, accessToken, refreshToken);
  return { accessToken, refreshToken };
}

async function registerOrganization(req, res) {
  const { organizationName, organizationSlug, name, email, password } = req.validated.body;
  const organization = await Organization.create({
    name: organizationName,
    slug: organizationSlug
  });
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    organizationId: organization._id,
    name,
    email,
    passwordHash,
    role: "super_admin",
    permissions: {
      canViewSpend: true,
      canExportLeads: true,
      canManageMeta: true,
      canManageUsers: true,
      canManageTemplates: true
    }
  });
  const tokens = await issueTokens(req, res, user);
  res.status(201).json({ user: publicUser(user), organization, ...tokens });
}

async function login(req, res) {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || user.status !== "active") throw httpError(401, "Invalid credentials");
  const ok = await user.comparePassword(password);
  if (!ok) throw httpError(401, "Invalid credentials");

  user.lastLoginAt = new Date();
  await user.save();
  const tokens = await issueTokens(req, res, user);
  res.json({ user: publicUser(user), ...tokens });
}

async function me(req, res) {
  const user = await User.findById(req.user.id).select(User.safeFields());
  res.json({ user: publicUser(user) });
}

async function refresh(req, res) {
  const token = req.cookies.refreshToken || req.body.refreshToken;
  if (!token) throw httpError(401, "Refresh token required");

  const payload = verifyRefreshToken(token);
  const session = await RefreshSession.findOne({ tokenId: payload.tokenId, revokedAt: null });
  if (!session) throw httpError(401, "Refresh session revoked");

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "active" || user.refreshTokenVersion !== payload.version) {
    throw httpError(401, "Invalid refresh token");
  }

  session.revokedAt = new Date();
  await session.save();
  const tokens = await issueTokens(req, res, user);
  res.json({ user: publicUser(user), ...tokens });
}

async function logout(req, res) {
  const token = req.cookies.refreshToken || req.body.refreshToken;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await RefreshSession.updateOne({ tokenId: payload.tokenId }, { revokedAt: new Date() });
    } catch {
      // Logout should still clear cookies if the token is already invalid.
    }
  }
  clearAuthCookies(res);
  res.status(204).send();
}

module.exports = { registerOrganization, login, me, refresh, logout, publicUser };
