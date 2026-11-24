import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { isDatabaseReady } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import placesRoutes from "./routes/places.routes.js";
import tripRoutes from "./routes/trip.routes.js";

const app = express();

// Trust only Render's load-balancer hop, not the full forwarded-header chain.
app.set("trust proxy", 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  })
);
app.use(express.json());
app.use(limiter);

app.get("/api/health", (_req, res) => {
  const databaseReady = isDatabaseReady();

  return res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? "ok" : "not_ready",
    checks: {
      database: databaseReady ? "connected" : "unavailable",
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/trips", tripRoutes);

export default app;
