const User = require("../models/User");
const { verifyAccessToken } = require("../utils/tokens");
const { httpError } = require("../utils/httpError");

async function requireAuth(req, _res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : req.cookies.accessToken;
    if (!token) throw httpError(401, "Authentication required");

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select(User.safeFields()).lean();
    if (!user || user.status !== "active") throw httpError(401, "User is not active");

    req.user = {
      id: String(user._id),
      organizationId: String(user.organizationId),
      clientIds: (user.clientIds || []).map(String),
      role: user.role,
      permissions: user.permissions || {}
    };
    next();
  } catch (error) {
    next(error.status ? error : httpError(401, "Invalid or expired token"));
  }
}

module.exports = { requireAuth };
