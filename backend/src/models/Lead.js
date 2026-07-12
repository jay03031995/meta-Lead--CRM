const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    clientId: { type: String, default: "unassigned", index: true },
    externalId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    source: { type: String, default: "Meta Lead Form" },
    quality: { type: String, default: "Cold Lead", index: true },
    status: { type: String, default: "New Lead", index: true },
    owner: { type: String, default: "" },
    campaign: { type: String, default: "" },
    service: { type: String, default: "" },
    location: { type: String, default: "" },
    assetId: { type: String, default: "" },
    intent: { type: String, default: "" },
    due: Date,
    received: { type: Date, default: Date.now },
    notes: [{ type: String }],
    latestAction: { type: String, default: "Lead received" },
    rawSource: { type: mongoose.Schema.Types.Mixed, select: false }
  },
  { timestamps: true }
);

leadSchema.index({ organizationId: 1, externalId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Lead", leadSchema);
