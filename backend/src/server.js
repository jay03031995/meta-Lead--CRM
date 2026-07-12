const { connectDb } = require("./config/db");
const { getEnv } = require("./config/env");
const { createApp } = require("./app");

async function main() {
  const env = getEnv();
  await connectDb();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Meta Leads CRM API running on http://localhost:${env.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
