const { createApp } = require("../backend/src/app");
const { connectDb } = require("../backend/src/config/db");

const app = createApp();

module.exports = async function handler(req, res) {
  try {
    await connectDb();
    return app(req, res);
  } catch (error) {
    console.error("API startup failed", error);
    return res.status(503).json({
      error: {
        message: "Database connection unavailable"
      }
    });
  }
};
