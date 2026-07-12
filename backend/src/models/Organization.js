const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: { type: String, enum: ["local", "starter", "agency", "enterprise"], default: "agency" },
    status: { type: String, enum: ["active", "suspended"], default: "active" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
