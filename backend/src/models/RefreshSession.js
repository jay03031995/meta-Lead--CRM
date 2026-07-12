const mongoose = require("mongoose");

const refreshSessionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenId: { type: String, required: true, unique: true },
    userAgent: String,
    ip: String,
    revokedAt: Date,
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

module.exports = mongoose.model("RefreshSession", refreshSessionSchema);
