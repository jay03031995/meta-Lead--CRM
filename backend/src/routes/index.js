const express = require("express");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const leadRoutes = require("./leadRoutes");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "meta-leads-crm-api" });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/leads", leadRoutes);

module.exports = router;
