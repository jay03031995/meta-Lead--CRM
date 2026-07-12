const crypto = require("crypto");
const WhatsAppAccount = require("../models/WhatsAppAccount");
const { getEnv } = require("../config/env");
const { upsertWhatsAppAdLead } = require("../utils/metaLeads");
const { httpError } = require("../utils/httpError");

function verifyWhatsAppWebhook(req, res) {
  const env = getEnv();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token && env.metaVerifyToken && token === env.metaVerifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

function isValidSignature(env, req) {
  const signatureHeader = req.get("x-hub-signature-256") || "";
  const [, signature] = signatureHeader.split("sha256=");
  if (!signature || !req.rawBody) return false;
  const expected = crypto.createHmac("sha256", env.metaAppSecret).update(req.rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function ingestWhatsAppMessage(value, message) {
  const referral = message.referral;
  if (!referral || referral.source_type !== "ad") return;

  const account = await WhatsAppAccount.findOne({ phoneNumberId: value.metadata?.phone_number_id });
  if (!account) {
    console.error(`WhatsApp webhook: no connected account for phoneNumberId ${value.metadata?.phone_number_id}`);
    return;
  }

  const contact = (value.contacts || []).find((entry) => entry.wa_id === message.from);

  await upsertWhatsAppAdLead({
    organizationId: account.organizationId,
    clientId: account.clientId,
    externalId: `whatsapp:${value.metadata.phone_number_id}:${message.from}`,
    phone: message.from,
    name: contact?.profile?.name,
    message: message.text?.body || referral.headline || "",
    campaignId: referral.source_id,
    receivedAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date()
  });

  await WhatsAppAccount.updateOne({ _id: account._id }, { $set: { lastMessageAt: new Date() } });
}

async function receiveWhatsAppWebhook(req, res) {
  const env = getEnv();
  if (!isValidSignature(env, req)) throw httpError(401, "Invalid webhook signature");

  const entries = req.body?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      for (const message of change.value?.messages || []) {
        try {
          await ingestWhatsAppMessage(change.value, message);
        } catch (error) {
          console.error("WhatsApp webhook: failed to ingest message", error);
        }
      }
    }
  }

  res.sendStatus(200);
}

module.exports = { verifyWhatsAppWebhook, receiveWhatsAppWebhook };
