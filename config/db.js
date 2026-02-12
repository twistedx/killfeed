// config/db.js
const mongoose = require("mongoose");

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing.");
  }

  // Fail fast instead of buffering forever
  mongoose.set("bufferCommands", false);

  // Optional: nicer logs
  mongoose.connection.on("connected", () => console.log("✅ Mongoose connected"));
  mongoose.connection.on("error", (err) => console.error("❌ Mongoose connection error:", err));
  mongoose.connection.on("disconnected", () => console.log("⚠️  Mongoose disconnected"));

  // IMPORTANT: no legacy options here — they’re removed in newer drivers
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  return mongoose.connection;
};
