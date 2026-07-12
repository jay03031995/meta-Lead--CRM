const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "paused", "archived"], default: "active" },
    locations: [{ type: String, trim: true }],
    safeExportsEnabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

clientSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Client", clientSchema);
