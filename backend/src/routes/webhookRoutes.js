const express = require("express");
const { verifyMetaWebhook, receiveMetaWebhook } = require("../controllers/metaWebhookController");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.get("/meta", verifyMetaWebhook);
router.post("/meta", asyncHandler(receiveMetaWebhook));

module.exports = router;
