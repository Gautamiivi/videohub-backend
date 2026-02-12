import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import Video from "../models/Video.js";
import auth from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================
   Multer configuration
   Use memory storage for Vercel serverless compatibility
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = process.env.NODE_ENV === "production" 
  ? multer.memoryStorage()  // Vercel serverless: store in memory
  : multer.diskStorage({    // Local: store to disk
      destination: (req, file, cb) => {
        cb(null, path.resolve(__dirname, "../uploads"));
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
      },
    });

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

/* =========================
   GET ALL VIDEOS
========================= */
router.get("/", auth, async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
  } catch (err) {
    console.error("Error fetching videos:", err);
    res.status(500).json({ message: "Failed to fetch videos" });
  }
});

/* =========================
   UPLOAD VIDEO
========================= */
router.post("/upload", auth, upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No video file provided" });
    }

    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    // For Vercel serverless, we can't save files to disk
    // In production, you'd upload to cloud storage (AWS S3, Cloudinary, etc.)
    if (process.env.NODE_ENV === "production") {
      // For Vercel: Just save metadata, file would need cloud storage
      console.log("Video upload in Vercel - file would need cloud storage");
      return res.status(201).json({
        title,
        message: "Video upload requires cloud storage configuration",
        note: "Configure AWS S3 or Cloudinary for production video storage"
      });
    }

    // For local development: save to disk
    const video = await Video.create({
      title,
      filename: req.file.filename,
      videoUrl: `/uploads/${req.file.filename}`,
    });

    res.status(201).json(video);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed: " + err.message });
  }
});

/* =========================
   DELETE VIDEO
========================= */
router.delete("/:id", auth, async (req, res) => {
  try {
    await Video.findByIdAndDelete(req.params.id);
    res.json({ message: "Video deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;
