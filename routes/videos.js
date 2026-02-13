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

const isServerlessRuntime =
  process.env.VERCEL === "1" ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NODE_ENV === "production";

const storage = isServerlessRuntime
  ? multer.memoryStorage() // Vercel/Lambda: do not write to project filesystem
  : multer.diskStorage({   // Local: store to disk
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
router.post("/upload", auth, (req, res, next) => {
  upload.single("video")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "Video is too large. Max size is 100MB." });
      }
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({ message: "Upload middleware failed: " + err.message });
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No video file provided" });
    }

    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    // In serverless, upload file buffer to cloud storage if configured.
    if (isServerlessRuntime) {
      if (!cloudName || !uploadPreset) {
        return res.status(501).json({
          title,
          message: "Video storage is not configured for production yet.",
          note: "Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in backend Vercel env."
        });
      }

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
      const form = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype || "application/octet-stream" });

      form.append("file", blob, req.file.originalname || "video.mp4");
      form.append("upload_preset", uploadPreset);
      form.append("resource_type", "video");

      const cloudResp = await fetch(cloudinaryUrl, {
        method: "POST",
        body: form,
      });

      const cloudData = await cloudResp.json();
      if (!cloudResp.ok || !cloudData.secure_url) {
        return res.status(502).json({
          message: cloudData?.error?.message || "Cloudinary upload failed",
        });
      }

      const video = await Video.create({
        title,
        filename: req.file.originalname,
        videoUrl: cloudData.secure_url,
      });

      return res.status(201).json(video);
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
