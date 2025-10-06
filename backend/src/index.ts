import express from "express";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import characterRoutes from "./routes/characters";

dotenv.config();
console.log("Loaded MONGO_URI:", process.env.MONGO_URI);


const app = express();
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/characters", characterRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI as string;

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI environment variable");
  process.exit(1);
}
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 10000, // optional: timeout if cluster not reachable
})
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => console.error("MongoDB connection error:", err));