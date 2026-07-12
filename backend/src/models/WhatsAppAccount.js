const mongoose = require("mongoose");

const whatsAppAccountSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    clientId: { type: String, default: "unassigned" },
    wabaId: { type: String, required: true },
    phoneNumberId: { type: String, required: true, unique: true },
    displayPhoneNumber: String,
    subscribed: { type: Boolean, default: false },
    lastMessageAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("WhatsAppAccount", whatsAppAccountSchema);
