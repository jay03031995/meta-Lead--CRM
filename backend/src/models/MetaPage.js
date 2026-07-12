const mongoose = require("mongoose");

const metaPageSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    clientId: { type: String, default: "unassigned" },
    pageId: { type: String, required: true },
    pageName: String,
    encryptedPageAccessToken: { type: String, required: true, select: false },
    subscribed: { type: Boolean, default: false },
    lastLeadAt: Date
  },
  { timestamps: true }
);

metaPageSchema.index({ organizationId: 1, pageId: 1 }, { unique: true });
metaPageSchema.index({ pageId: 1 });

module.exports = mongoose.model("MetaPage", metaPageSchema);
