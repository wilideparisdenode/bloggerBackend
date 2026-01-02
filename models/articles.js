import mongoose from "mongoose";

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"]
    },
    
    content: {
      type: String,
      required: [true, "Content is required"],
      minlength: [20, "Content must be at least 20 characters"]
    },
    
    excerpt: {
      type: String,
      trim: true,
      maxlength: [500, "Excerpt cannot exceed 500 characters"]
    },
    
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ["Technology", "Programming", "Design", "Business", "Lifestyle", "Education"],
        message: "Category must be one of: Technology, Programming, Design, Business, Lifestyle, Education"
      }
    },
    
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
      minlength: [2, "Tag must be at least 2 characters"],
      maxlength: [30, "Tag cannot exceed 30 characters"]
    }],
    
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author ID is required"],
      index: true
    },
    
    status: {
      type: String,
      enum: {
        values: ["draft", "published"],
        message: "Status must be either 'draft' or 'published'"
      },
      default: "published",
      index: true
    },
    
    views: {
      type: Number,
      default: 0,
      min: [0, "Views cannot be negative"]
    },
    
    likes: {
      type: Number,
      default: 0,
      min: [0, "Likes cannot be negative"]
    },
    
    likedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    
    comments: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      text: {
        type: String,
        required: true,
        maxlength: [1000, "Comment cannot exceed 1000 characters"]
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    isPublished: {
      type: Boolean,
      default: true,
      index: true
    },
    image: {
    originalName: { type: String, required: true },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryId: { type: String, required: true }
  },
    publishedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Composite index for author articles sorted by date
articleSchema.index({ authorId: 1, createdAt: -1 });

// Single field indexes
articleSchema.index({ category: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ status: 1 });
articleSchema.index({ isPublished: 1 });

// Text index for full-text search
articleSchema.index({ title: "text", content: "text", excerpt: "text" });

// ============================================
// VIRTUALS
// ============================================

// Word count
articleSchema.virtual("wordCount").get(function() {
  if (!this.content) return 0;
  return this.content.trim().split(/\s+/).filter(word => word.length > 0).length;
});

// Character count
articleSchema.virtual("characterCount").get(function() {
  return this.content ? this.content.length : 0;
});

// Reading time (average 200 words per minute)
articleSchema.virtual("readingTime").get(function() {
  const wordCount = this.wordCount;
  const readingTimeMinutes = Math.ceil(wordCount / 200);
  return `${readingTimeMinutes} min read`;
});

// Comment count
articleSchema.virtual("commentCount").get(function() {
  return this.comments ? this.comments.length : 0;
});

// Is liked by user (helper for frontend)
articleSchema.virtual("isLikedByUser").get(function(userId) {
  if (!userId || !this.likedBy) return false;
  return this.likedBy.some(id => id.toString() === userId.toString());
});

// ============================================
// MIDDLEWARE
// ============================================

// Set publishedAt timestamp when article is published
articleSchema.pre("save", function(next) {
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

// ============================================
// METHODS
// ============================================

// Method to add a like
articleSchema.methods.addLike = function(userId) {
  if (!this.likedBy.includes(userId)) {
    this.likedBy.push(userId);
    this.likes += 1;
  }
  return this.save();
};

// Method to remove a like
articleSchema.methods.removeLike = function(userId) {
  const index = this.likedBy.indexOf(userId);
  if (index > -1) {
    this.likedBy.splice(index, 1);
    this.likes = Math.max(0, this.likes - 1);
  }
  return this.save();
};

// Method to add a comment
articleSchema.methods.addComment = function(userId, text) {
  this.comments.push({
    userId,
    text
  });
  return this.save();
};

// Method to remove a comment
articleSchema.methods.removeComment = function(commentId) {
  this.comments = this.comments.filter(comment => 
    comment._id.toString() !== commentId.toString()
  );
  return this.save();
};

// Method to increment views
articleSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

export default mongoose.model("Article", articleSchema);