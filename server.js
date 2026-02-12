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

/* CORS */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

let isConnected =false;
async function connectDB(){
  try {
    await mongoose.connect(process.env.MONGO_URI,{
      useNewUrlParser : true,
      useUnifiedTopology:true
    });
    isConnected=true;
    console.log('connected to mongoDB');
  } catch (error) {
    console.error('Error connecting to mongoDB',error);
  }
}

app.use((req,res,next)=>{
  if(!isConnected){
    connectDB();
  }
  next();
})

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* MongoDB */
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is missing in environment variables");
      return;
    }
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
};

connectDB();

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

/* Health check */
app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
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

/* Start server */
// const PORT = process.env.PORT || 5001;
// app.listen(PORT, "0.0.0.0", () => {
//   console.log(`🚀 Server running on port ${PORT}`);
//   console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
//   console.log(
//     `   MongoDB: ${mongoose.connection.readyState === 1 ? "Connected" : "Connecting..."}`
//   );
// });

module.exports=app