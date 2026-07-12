const express = require("express");
const { createLead, listLeads, updateLead } = require("../controllers/leadController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { validate } = require("../middleware/validate");
const { createLeadSchema, updateLeadSchema } = require("../validators/leadSchemas");

const router = express.Router();
router.use(requireAuth);
router.get("/", asyncHandler(listLeads));
router.post("/", requireRole("super_admin", "admin", "team_member"), validate(createLeadSchema), asyncHandler(createLead));
router.patch("/:id", requireRole("super_admin", "admin", "team_member"), validate(updateLeadSchema), asyncHandler(updateLead));

module.exports = router;
