import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import videoRoutes from "./routes/videos.js";

/* Load environment variables */
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* MongoDB Connection for Vercel Serverless */
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log("MongoDB already connected");
    return;
  }

  try {
    const mongoURI = process.env.MONGO_URI;
    
    if (!mongoURI) {
      console.error("MONGO_URI not defined in environment variables");
      return;
    }

    console.log("Attempting MongoDB connection...");
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("MongoDB connected successfully ✅");
    
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected");
    });

  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
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
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      // Allow Vercel preview deployments
      if (origin && origin.includes("vercel.app")) {
        callback(null, true);
        return;
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
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

/* Static uploads with CORS headers */
app.use("/uploads", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.resolve(__dirname, "uploads")));

/* Routes */
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);

/* Health check with DB status */
app.get("/health", async (_req, res) => {
  let mongoStatus = "disconnected";
  try {
    if (mongoose.connection.readyState === 1) {
      mongoStatus = "connected";
    } else if (mongoose.connection.readyState === 2) {
      mongoStatus = "connecting";
    } else if (mongoose.connection.readyState === 3) {
      mongoStatus = "disconnecting";
    }
  } catch (e) {
    mongoStatus = "error";
  }
  
  res.json({
    status: "OK",
    backendVersion: "cloudinary-v2",
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

/* Connect to DB and start server for local development only */
const PORT = process.env.PORT || 5002;
if (process.env.NODE_ENV !== "production") {
  connectDB().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`   MongoDB: ${mongoose.connection.readyState === 1 ? "Connected" : "Not connected"}`);
    });
  });
}

/* Export for Vercel serverless with DB connection */
export default async function handler(req, res) {
  // Connect to DB on each request for serverless
  await connectDB();
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  // Handle request
  return app(req, res);
}
