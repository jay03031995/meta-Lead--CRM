const { createApp } = require("./backend/src/app");
const { getEnv } = require("./backend/src/config/env");

const env = getEnv();
const app = createApp();

app.listen(env.port, () => {
  console.log(`Meta Leads CRM running on port ${env.port}`);
});
