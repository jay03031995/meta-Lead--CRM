const express = require("express");
const { verifyMetaWebhook, receiveMetaWebhook } = require("../controllers/metaWebhookController");
const { verifyWhatsAppWebhook, receiveWhatsAppWebhook } = require("../controllers/whatsappWebhookController");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.get("/meta", verifyMetaWebhook);
router.post("/meta", asyncHandler(receiveMetaWebhook));
router.get("/whatsapp", verifyWhatsAppWebhook);
router.post("/whatsapp", asyncHandler(receiveWhatsAppWebhook));

module.exports = router;
