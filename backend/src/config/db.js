const mongoose = require("mongoose");
const { getEnv } = require("./env");

async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (global.__metaLeadsMongoPromise) return global.__metaLeadsMongoPromise;
  const { mongoUri } = getEnv();
  mongoose.set("strictQuery", true);
  global.__metaLeadsMongoPromise = mongoose.connect(mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000
  });
  try {
    await global.__metaLeadsMongoPromise;
    return mongoose.connection;
  } catch (error) {
    global.__metaLeadsMongoPromise = null;
    throw error;
  }
}

module.exports = { connectDb };
