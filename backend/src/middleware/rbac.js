const { httpError } = require("../utils/httpError");

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(httpError(401, "Authentication required"));
    if (!roles.includes(req.user.role)) return next(httpError(403, "Insufficient role"));
    next();
  };
}

function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(httpError(401, "Authentication required"));
    if (req.user.role === "super_admin" || req.user.permissions?.[permission]) return next();
    next(httpError(403, `Missing permission: ${permission}`));
  };
}

function requireClientAccess(req, _res, next) {
  if (!req.user) return next(httpError(401, "Authentication required"));
  if (req.user.role === "super_admin" || req.user.role === "admin") return next();

  const clientId = req.params.clientId || req.body.clientId || req.query.clientId;
  if (!clientId || !req.user.clientIds.includes(String(clientId))) {
    return next(httpError(403, "Client access denied"));
  }
  next();
}

module.exports = { requireRole, requirePermission, requireClientAccess };
