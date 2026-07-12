const WhatsAppAccount = require("../models/WhatsAppAccount");
const { getEnv } = require("../config/env");
const { httpError } = require("../utils/httpError");

async function registerWhatsAppAccount(req, res) {
  const env = getEnv();
  if (!env.metaSystemUserToken || !env.whatsappPhoneNumberId || !env.whatsappBusinessAccountId) {
    throw httpError(503, "WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID and META_ACCESS_TOKEN must be configured");
  }

  const phoneResponse = await fetch(
    `https://graph.facebook.com/${env.metaGraphVersion}/${env.whatsappPhoneNumberId}?fields=display_phone_number&access_token=${encodeURIComponent(env.metaSystemUserToken)}`
  );
  const phoneData = await phoneResponse.json();
  if (!phoneResponse.ok) throw httpError(502, phoneData.error?.message || "Failed to read WhatsApp phone number");

  const account = await WhatsAppAccount.findOneAndUpdate(
    { phoneNumberId: env.whatsappPhoneNumberId },
    {
      organizationId: req.user.organizationId,
      wabaId: env.whatsappBusinessAccountId,
      phoneNumberId: env.whatsappPhoneNumberId,
      displayPhoneNumber: phoneData.display_phone_number
    },
    { upsert: true, new: true, runValidators: true }
  );

  const subscribeResponse = await fetch(
    `https://graph.facebook.com/${env.metaGraphVersion}/${env.whatsappBusinessAccountId}/subscribed_apps?access_token=${encodeURIComponent(env.metaSystemUserToken)}`,
    { method: "POST" }
  );
  const subscribeData = await subscribeResponse.json();
  if (subscribeResponse.ok && subscribeData.success) {
    account.subscribed = true;
    await account.save();
  }

  res.json({ account: { phoneNumberId: account.phoneNumberId, displayPhoneNumber: account.displayPhoneNumber, subscribed: account.subscribed } });
}

module.exports = { registerWhatsAppAccount };
