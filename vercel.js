import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import videoRoutes from "./routes/videos.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* MongoDB Connection */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (mongoURI) {
      await mongoose.connect(mongoURI);
      console.log("MongoDB connected ✅");
    }
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
  }
};

/* CORS */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
  "https://videohub-frontend.vercel.app",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin.includes("vercel.app")) {
        callback(null, true);
      } else if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* Static files */
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

/* Routes */
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);

/* Health check */
app.get("/health", async (_req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "OK",
    mongodb: mongoStatus,
    timestamp: new Date().toISOString(),
  });
});

/* Root */
app.get("/", (_req, res) => {
  res.send("VideoHub Backend is running 🚀");
});

/* Error handler */
app.use((err, _req, res, _next) => {
  console.error("Server error:", err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

/* Connect DB and export */
connectDB();

export default app;
