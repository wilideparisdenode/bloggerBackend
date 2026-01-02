import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import articleRoutes from "./route/article.js";
import userRoutes from "./route/userRoute.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// ============================================
// VALIDATION
// ============================================

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env file");
  process.exit(1);
}

// ============================================
// MIDDLEWARE
// ============================================

// Logging
app.use(morgan("dev")); // Use "dev" for better formatting

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// DATABASE CONNECTION
// ============================================

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// Handle connection errors after initial connection
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection lost:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected");
});

// ============================================
// ROUTES
// ============================================

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to the Blogger API!",
    version: "1.0.0",
    status: "running"
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use("/api/articles", articleRoutes);
app.use("/api", userRoutes); // Changed from "/api" to "/api/users"

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Global error:", err);
  
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  
  res.status(status).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📍 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`); 
});