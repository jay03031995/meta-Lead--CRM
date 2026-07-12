const mongoose = require("mongoose");

const auditEventSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, trim: true },
    targetId: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: String,
    userAgent: String
  },
  { timestamps: true }
);

auditEventSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditEvent", auditEventSchema);
