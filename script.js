import mongoose from "mongoose";
import dotenv from "dotenv";
import Article from "./models/articles.js";

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function deleteAllArticles() {
  try {
    if (!MONGO_URI) {
      console.error("❌ MONGO_URI is not defined in .env file");
      process.exit(1);
    }

    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    console.log("🗑️ Deleting all articles...");
    const result = await Article.deleteMany({});
    console.log(`✅ Successfully deleted ${result.deletedCount} articles.`);

  } catch (error) {
    console.error("❌ Error deleting articles:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

deleteAllArticles();
