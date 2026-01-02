import User from "../models/user.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Get all users (Admin only)
export async function getAllUsers(req, res) {
  try {
    const users = await User.find()
      .select('-password')
      .populate('articleCount')
      .sort({ createdAt: -1 });
      
    res.status(200).json({
      totalUsers: users.length,
      users
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Error fetching users",
      error: err.message 
    });
  }
}

// Get user by ID
export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-password')
      .populate('articleCount');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ 
      message: "Error fetching user",
      error: err.message 
    });
  }
}

// Register new user
export async function createNewUser(req, res) {
  try {
    const { name, email, password, isAdmin } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: "Name, email, and password are required" 
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      isAdmin: isAdmin || false,
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser._id },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        isAdmin: newUser.isAdmin
      },
      token,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ 
      message: "Error creating user",
      error: error.message 
    });
  }
}

// ✅ Login user
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required" 
      });
    }

    // Find user
    const foundUser = await User.findOne({ email });
    if (!foundUser) {
      return res.status(404).json({ message: "Invalid email or password" });
    }

    // Check password
    const match = await bcrypt.compare(password, foundUser.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: foundUser._id },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      user: {
        id: foundUser._id,
        name: foundUser.name,
        email: foundUser.email,
        isAdmin: foundUser.isAdmin,
        avatar: foundUser.avatar,
        bio: foundUser.bio
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Error logging in",
      error: err.message 
    });
  }
}

// ✅ Update user profile
export async function updatePersonalInfo(req, res) {
  try {
    const { name, email, bio, avatar, socialLinks } = req.body;
    const userId = req.user._id;

    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fields
    if (name) userDoc.name = name;
    if (bio !== undefined) userDoc.bio = bio;
    if (avatar) userDoc.avatar = avatar;
    
    // Check if email is being changed and if it's already taken
    if (email && email !== userDoc.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: "Email already in use" });
      }
      userDoc.email = email;
    }

    // Update social links
    if (socialLinks) {
      userDoc.socialLinks = {
        ...userDoc.socialLinks,
        ...socialLinks
      };
    }

    const updatedUser = await userDoc.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        socialLinks: updatedUser.socialLinks
      },
    });
  } catch (err) {
    console.error("Error in updatePersonalInfo:", err);
    res.status(500).json({ 
      message: "Error updating profile",
      error: err.message 
    });
  }
}

// ✅ Change password
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: "Current password and new password are required" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: "New password must be at least 6 characters" 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const saltRounds = 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    res.status(200).json({
      message: "Password changed successfully"
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Error changing password",
      error: err.message 
    });
  }
}

// ✅ Delete user (Admin or self)
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Check if user is deleting their own account or is admin
    if (req.user._id.toString() !== id && !req.user.isAdmin) {
      return res.status(403).json({ 
        message: "Not authorized to delete this user" 
      });
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ 
      message: "User deleted successfully" 
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Error deleting user",
      error: err.message 
    });
  }
}