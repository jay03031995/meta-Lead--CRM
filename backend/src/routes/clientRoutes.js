const express = require("express");
const { listClients, createClient, updateClient } = require("../controllers/clientController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { validate } = require("../middleware/validate");
const { createClientSchema, updateClientSchema } = require("../validators/clientSchemas");

const router = express.Router();
router.use(requireAuth);
router.get("/", asyncHandler(listClients));
router.post("/", requireRole("super_admin", "admin"), validate(createClientSchema), asyncHandler(createClient));
router.patch("/:id", requireRole("super_admin", "admin"), validate(updateClientSchema), asyncHandler(updateClient));

module.exports = router;
