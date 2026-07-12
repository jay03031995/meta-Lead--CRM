const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const roles = ["super_admin", "admin", "team_member", "client_user", "client_viewer"];

const userSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    clientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Client", index: true }],
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: roles, required: true, index: true },
    status: { type: String, enum: ["active", "invited", "suspended"], default: "active", index: true },
    permissions: {
      canViewSpend: { type: Boolean, default: false },
      canExportLeads: { type: Boolean, default: false },
      canManageMeta: { type: Boolean, default: false },
      canManageUsers: { type: Boolean, default: false },
      canManageTemplates: { type: Boolean, default: false }
    },
    lastLoginAt: Date,
    refreshTokenVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, email: 1 }, { unique: true });

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

userSchema.statics.safeFields = function safeFields() {
  return "-passwordHash -refreshTokenVersion";
};

module.exports = mongoose.model("User", userSchema);
module.exports.roles = roles;
