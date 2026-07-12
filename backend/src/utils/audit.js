const AuditEvent = require("../models/AuditEvent");

async function audit(req, action, target = {}) {
  if (!req.user?.organizationId) return;
  await AuditEvent.create({
    organizationId: req.user.organizationId,
    clientId: target.clientId,
    actorUserId: req.user.id,
    action,
    targetType: target.type,
    targetId: target.id,
    metadata: target.metadata || {},
    ip: req.ip,
    userAgent: req.get("user-agent")
  });
}

module.exports = { audit };
