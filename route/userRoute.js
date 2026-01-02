import express from "express";
import {
  getAllUsers,
  getUserById,
  createNewUser,
  deleteUser,
  login,
  updatePersonalInfo,
  changePassword,
} from "../controllers/user.js";
import { protect } from "../middleware/authMiddle.js";

const router = express.Router();

// Public routes
router.post("/auth/register", createNewUser); // Register new user
router.post("/auth/login", login); // Login

// Protected routes (require authentication)
router.put("/users/profile", protect, updatePersonalInfo); // Update own profile
router.put("/users/:id/password", protect, changePassword); // Change password
router.delete("/users/:id", protect, deleteUser); // Delete user (self or admin)

// Admin only routes
router.get("/users", protect, getAllUsers); // Get all users (admin only)

// Public user info (can be accessed by anyone)
router.get("/users/:id", getUserById); // Get user by ID

export default router;