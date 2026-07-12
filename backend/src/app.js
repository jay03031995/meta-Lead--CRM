const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { getEnv } = require("./config/env");
const routes = require("./routes");
const { errorHandler, notFound } = require("./middleware/errorHandler");

function createApp() {
  const env = getEnv();
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        const allowed = !origin || origin === env.appOrigin || (env.nodeEnv !== "production" && origin === "null");
        callback(allowed ? null : new Error("Origin not allowed"), allowed);
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  app.use("/api", routes);
  const frontendDir = path.resolve(__dirname, "../..");
  app.use(express.static(frontendDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(frontendDir, "index.html"));
  });
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
