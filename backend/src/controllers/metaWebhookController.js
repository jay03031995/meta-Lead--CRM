const crypto = require("crypto");
const MetaPage = require("../models/MetaPage");
const { getEnv } = require("../config/env");
const { decryptSecret } = require("../utils/encryption");
const { upsertMetaLead } = require("../utils/metaLeads");
const { httpError } = require("../utils/httpError");

function verifyMetaWebhook(req, res) {
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

async function ingestLeadgenEvent(env, value) {
  const page = await MetaPage.findOne({ pageId: value.page_id }).select("+encryptedPageAccessToken");
  if (!page) {
    console.error(`Meta webhook: no connected page found for pageId ${value.page_id}`);
    return;
  }

  const pageAccessToken = decryptSecret(page.encryptedPageAccessToken);
  const leadResponse = await fetch(
    `https://graph.facebook.com/${env.metaGraphVersion}/${value.leadgen_id}?fields=field_data,created_time,ad_id,form_id,campaign_id&access_token=${encodeURIComponent(pageAccessToken)}`
  );
  const leadData = await leadResponse.json();
  if (!leadResponse.ok) {
    console.error("Meta webhook: failed to fetch lead detail", leadData.error?.message);
    return;
  }

  await upsertMetaLead({
    organizationId: page.organizationId,
    clientId: page.clientId,
    externalId: value.leadgen_id,
    fieldData: leadData.field_data,
    createdTime: leadData.created_time,
    campaignId: leadData.campaign_id,
    formId: value.form_id
  });

  await MetaPage.updateOne({ _id: page._id }, { $set: { lastLeadAt: new Date() } });
}

async function receiveMetaWebhook(req, res) {
  const env = getEnv();
  if (!isValidSignature(env, req)) throw httpError(401, "Invalid webhook signature");

  const entries = req.body?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.field !== "leadgen") continue;
      try {
        await ingestLeadgenEvent(env, change.value);
      } catch (error) {
        console.error("Meta webhook: failed to ingest leadgen event", error);
      }
    }
  }

  res.sendStatus(200);
}

module.exports = { verifyMetaWebhook, receiveMetaWebhook };
