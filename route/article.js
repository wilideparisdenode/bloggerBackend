import express from "express";
import { upload } from "../util/multer.js";
import {
  getAllArticles,
  getArticlesByAuthor,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  toggleLike,
  comment,  
} from "../controllers/articleController.js";
import { protect } from "../middleware/authMiddle.js";

const router = express.Router();

// Public routes
router.get("/", getAllArticles); // Get all articles with filters & pagination
router.get("/:id", getArticleById); // Get single article by ID

// Protected routes (require authentication)
router.post("/", protect, upload.single("file") ,createArticle); // Create new article
router.put("/:id", protect,upload.single("file"), updateArticle); // Update article
router.delete("/:id", protect, deleteArticle); // Delete article
router.patch("/:id/like", protect, toggleLike); // Like/unlike article
router.patch("/:id/comment", protect, comment); // Like/unlike article
// Get articles by author
router.get("/author/:authorId", getArticlesByAuthor); // Get all articles by specific author

export default router;