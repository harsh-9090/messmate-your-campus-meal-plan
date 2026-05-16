import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.js";
import memberRoutes from "./routes/members.js";
import qrRoutes from "./routes/qr.js";
import scanRoutes from "./routes/scan.js";
import usageRoutes from "./routes/usage.js";
import reportRoutes from "./routes/reports.js";
import configRoutes from "./routes/config.js";
import paymentRoutes from "./routes/payments.js";
import staffRoutes from "./routes/staff.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") ?? "*", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true, service: "messmate-api", time: new Date().toISOString() }));

const v1 = express.Router();
v1.use("/auth", authRoutes);
v1.use("/members", memberRoutes);
v1.use("/qr", qrRoutes);
v1.use("/scan", scanRoutes);
v1.use("/usage", usageRoutes);
v1.use("/reports", reportRoutes);
v1.use("/config", configRoutes);
v1.use("/payments", paymentRoutes);
v1.use("/staff", staffRoutes);
app.use("/api/v1", v1);

app.use(errorHandler);
