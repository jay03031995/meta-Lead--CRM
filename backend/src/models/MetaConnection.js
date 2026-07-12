const mongoose = require("mongoose");

const metaConnectionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
    connectedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    metaUserId: String,
    metaUserName: String,
    encryptedAccessToken: { type: String, required: true, select: false },
    tokenExpiresAt: Date,
    scopes: [String],
    status: { type: String, enum: ["connected", "expired", "revoked"], default: "connected" },
    lastSyncAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("MetaConnection", metaConnectionSchema);
