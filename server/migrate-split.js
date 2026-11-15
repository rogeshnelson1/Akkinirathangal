// OPTIONAL one-time script: for Day 53+ (Oct 23 onwards) people who had already
// ticked the single "evening" box (10 chapters) get the new "morning" box ticked too.
// Run once:  node migrate-split.js
import "dotenv/config";
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/akkini");
const r = await mongoose.connection.collection("entries").updateMany(
  { date: { $gte: "2026-10-23" }, evening: true, morning: false },
  { $set: { morning: true } }
);
console.log("Updated entries:", r.modifiedCount);
await mongoose.disconnect();
