const mongoose = require("mongoose");
const { getEnv } = require("./env");

async function connectDb() {
  const { mongoUri } = getEnv();
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000
  });
}

module.exports = { connectDb };
