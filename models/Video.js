import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    title: String,
    videoUrl: String,
    filename: String, 
  },
  { timestamps: true }
);

export default mongoose.model("Video", videoSchema);
