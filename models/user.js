import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"]
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"]
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"]
    },
    avatar: {
      type: String,
      default: ""
    },
    socialLinks: {
      twitter: String,
      linkedin: String,
      github: String,
      website: String
    }
  },
  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.password; // Don't send password in responses
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Add index for email
userSchema.index({ email: 1 });

// Virtual for article count
userSchema.virtual('articleCount', {
  ref: 'Article',
  localField: '_id',
  foreignField: 'authorId',
  count: true
});

export default mongoose.model("User", userSchema);