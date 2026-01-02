import Article from "../models/articles.js";
import mongoose from "mongoose";
import { cloudinary } from "../util/cloudinary.js";
import fs from "fs";
import path from "path"
// Get all articles (with pagination, filtering, and sorting)
export async function getAllArticles(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    
    // Filter by category
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    // Filter by tags
    if (req.query.tags) {
      filter.tags = { $in: req.query.tags.split(',') };
    }
    
    // Filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Filter by author
    if (req.query.authorId) {
      filter.authorId = req.query.authorId;
    }

    // Search in title and content
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { content: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Build sort object
    let sort = { createdAt: -1 }; // Default: newest first
    
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'oldest':
          sort = { createdAt: 1 };
          break;
        case 'popular':
          sort = { views: -1 };
          break;
        case 'likes':
          sort = { likes: -1 };
          break;
        case 'title':
          sort = { title: 1 };
          break;
      }
    }

    const articles = await Article.find(filter)
      .populate('authorId', 'name email') // Populate author info
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const totalArticles = await Article.countDocuments(filter);
    const totalPages = Math.ceil(totalArticles / limit);

    if (!articles || articles.length === 0) {
      return res.status(404).json({ 
        message: "No articles found matching your criteria" 
      });
    }

    res.status(200).json({
      currentPage: page,
      totalPages,
      totalArticles,
      articlesPerPage: limit,
      articles,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ✅ Get articles by specific author
export async function getArticlesByAuthor(req, res) {
  try {
    const { authorId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Validate authorId format
    if (!mongoose.Types.ObjectId.isValid(authorId)) {
      return res.status(400).json({ message: "Invalid author ID format" });
    }

    const articles = await Article.find({ authorId })
      .populate('authorId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalArticles = await Article.countDocuments({ authorId });
    const totalPages = Math.ceil(totalArticles / limit);

    if (!articles || articles.length === 0) {
      return res.status(404).json({ 
        message: "No articles found for this author" 
      });
    }

    res.status(200).json({
      currentPage: page,
      totalPages,
      totalArticles,
      articlesPerPage: limit,
      articles,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get article by ID
export async function getArticleById(req, res) {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid article ID format" });
    }

    const article = await Article.findById(id)
      .populate('authorId', 'name email avatar bio createdAt')
      .populate('comments.userId', 'name email avatar')
      .populate('likedBy', 'name email');

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Increment view count
    article.views += 1;
    await article.save();

    res.status(200).json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


export async function createArticle(req, res) {
  try {

    const { title, content, excerpt, category, tags, status } = req.body;
    const authorId = req.user._id;

   
    if (!title || !content || !category || !authorId) {
      return res.status(400).json({ 
        success: false,
        message: "Required data is missing" 
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const file = req.file;

    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'banner',
          resource_type: 'image'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      const filePath = path.resolve(file.path);
      fs.createReadStream(filePath).pipe(uploadStream);
    });

    const result = await uploadPromise;

    // ✅ Save article to DB
    const article = new Article({
      authorId,
      title,
      content,
      excerpt,
      category,
      tags: Array.isArray(tags) ? tags : tags?.split(' ') || [],
      status,
      image: {
        originalName: file.originalname,
        cloudinaryUrl: result.secure_url,
        cloudinaryId: result.public_id
      }
    });

    await article.save();

    // ✅ Optionally delete the local file after upload
    fs.unlink(file.path, (err) => {
      if (err) console.error('Failed to delete local file:', err);
      else console.log('Local file deleted:', file.path);
    });

    res.status(201).json({ success: true, article });

  } catch (err) {
    console.error('❌ createArticle Error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message || 'Internal Server Error' 
    });
  }
}
// ✅ Update an article
export async function updateArticle(req, res) { 
  try {
    const { id } = req.params;
    const { title, content, excerpt, category, tags, status } = req.body;
    const userId = req.user._id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid article ID format" });
    }

    // Find article first to check ownership
    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Check authorization: user must be the author or admin
    const isAuthor = article.authorId.toString() === userId.toString();
    const isAdmin = req.user.isAdmin;

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ 
        message: "Not authorized to update this article. You can only update your own articles." 
      });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : tags?.split(' ') || [];
    if (status !== undefined) updateData.status = status;

    // Handle image upload if file is provided
    if (req.file) {
      try {
        const file = req.file;
        const uploadPromise = new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'banner',
              resource_type: 'image'
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );

          const filePath = path.resolve(file.path);
          fs.createReadStream(filePath).pipe(uploadStream);
        });

        const result = await uploadPromise;

        // Delete old image from Cloudinary if it exists
        if (article.image?.cloudinaryId) {
          try {
            await cloudinary.uploader.destroy(article.image.cloudinaryId);
          } catch (err) {
            console.error('Error deleting old image:', err);
          }
        }

        updateData.image = {
          originalName: file.originalname,
          cloudinaryUrl: result.secure_url,
          cloudinaryId: result.public_id
        };

        // Delete local file after upload
        fs.unlink(file.path, (err) => {
          if (err) console.error('Failed to delete local file:', err);
        });
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(500).json({ 
          message: "Error uploading image", 
          error: uploadError.message 
        });
      }
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Update article
    const updatedArticle = await Article.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true, // Return updated document
        runValidators: true // Run model validators
      }
    ).populate('authorId', 'name email avatar');

    res.status(200).json({
      message: "Article updated successfully",
      article: updatedArticle,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ message: "Validation error", errors });
    }
    res.status(500).json({ error: err.message });
  }
}

// ✅ Delete an article
export async function deleteArticle(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid article ID format" });
    }

    // Find article first to check ownership
    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Check authorization: user must be the author or admin
    const isAuthor = article.authorId.toString() === userId.toString();
    const isAdmin = req.user.isAdmin;

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ 
        message: "Not authorized to delete this article. You can only delete your own articles." 
      });
    }

    // Delete image from Cloudinary if it exists
    if (article.image?.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(article.image.cloudinaryId);
      } catch (err) {
        console.error('Error deleting image from Cloudinary:', err);
        // Continue with article deletion even if image deletion fails
      }
    }

    // Delete the article
    await Article.findByIdAndDelete(id);

    res.status(200).json({
      message: "Article deleted successfully",
      deletedArticle: {
        id: article._id,
        title: article.title
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const toggleLike = async (req, res) => {
  try {
    const articleId = req.params.id;
    const userId = req.user._id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({ message: "Invalid article ID format" });
    }

    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Check if already liked
    const userIdString = userId.toString();
    const alreadyLiked = article.likedBy.some(
      id => id.toString() === userIdString
    );

    if (alreadyLiked) {
      // Unlike - remove user from likedBy array
      article.likedBy = article.likedBy.filter(
        id => id.toString() !== userIdString
      );
      article.likes = Math.max(0, article.likes - 1);
    } else {
      // Like - add user to likedBy array
      article.likedBy.push(userId);
      article.likes = article.likedBy.length;
    }

    await article.save();
    
    res.status(200).json({ 
      success: true, 
      liked: !alreadyLiked,
      likes: article.likedBy.length,
      likedBy: article.likedBy 
    });
  } catch (err) {
    console.error('Toggle like error:', err);
    res.status(500).json({ message: err.message });
  }
};

export async function comment(req, res){
  try {
    const id = req.params.id;
    const { comment } = req.body;
    const userId = req.user._id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid article ID format" });
    }

    // Validate comment text
    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Add comment
    article.comments.push({
      text: comment.trim(),
      userId
    });

    const savedArticle = await article.save();
    
    // Populate the newly added comment's user info
    await savedArticle.populate('comments.userId', 'name email avatar');
    
    // Get the last comment (the one we just added)
    const newComment = savedArticle.comments[savedArticle.comments.length - 1];

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: newComment,
      totalComments: savedArticle.comments.length
    });
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ 
      message: error.message || "Error adding comment" 
    });
  }
}