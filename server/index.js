import "dotenv/config";
import express from "express";
import "express-async-errors";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { SCHEDULE } from "./schedule.js";

const app = express();
app.use(cors());
app.use(express.json());

const User = mongoose.model("User", new mongoose.Schema({
  name: { type: String, required: true },
  key: { type: String, required: true, unique: true },
}, { timestamps: true }));

const entrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  morning: { type: Boolean, default: false },
  evening: { type: Boolean, default: false },
});
entrySchema.index({ user: 1, date: 1 }, { unique: true });
const Entry = mongoose.model("Entry", entrySchema);

const SECRET = process.env.JWT_SECRET || "dev-secret";
const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const valid = new Set(SCHEDULE.map((d) => d.date));

const auth = (req, res, next) => {
  try {
    req.uid = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), SECRET).id;
    next();
  } catch { res.status(401).json({ error: "Please login again" }); }
};

app.post("/api/login", async (req, res) => {
  const name = String(req.body.name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) return res.status(400).json({ error: "Enter your name (2–40 letters)" });
  const key = name.toLowerCase();
  const user = await User.findOneAndUpdate({ key }, { $setOnInsert: { name, key } }, { upsert: true, new: true });
  res.json({ token: jwt.sign({ id: user._id }, SECRET, { expiresIn: "120d" }), name: user.name });
});

app.get("/api/schedule", (req, res) => res.json({ today: todayIST(), schedule: SCHEDULE }));

app.get("/api/me", auth, async (req, res) => {
  const entries = await Entry.find({ user: req.uid }).select("date morning evening -_id");
  res.json(entries);
});

app.put("/api/entry", auth, async (req, res) => {
  const { date, morning, evening } = req.body;
  if (!valid.has(date)) return res.status(400).json({ error: "Invalid date" });
  if (date > todayIST()) return res.status(400).json({ error: "You can't mark a future day" });

  const save = () => Entry.findOneAndUpdate(
    { user: req.uid, date },
    { morning: !!morning, evening: !!evening },
    { upsert: true, new: true }
  );
  let e;
  try { e = await save(); }
  catch (err) {
    if (err.code === 11000) e = await save(); // two taps at once: retry once
    else throw err;
  }
  res.json({ date: e.date, morning: e.morning, evening: e.evening });
});

// Everyone's status for one day + total fully-completed days
app.get("/api/board", auth, async (req, res) => {
  const date = valid.has(req.query.date) ? req.query.date : todayIST();
  const [users, entries] = await Promise.all([User.find().sort("name"), Entry.find()]);
  const by = {};
  entries.forEach((e) => { (by[e.user] ||= []).push(e); });
  const rows = users.map((u) => {
    const mine = by[u._id] || [];
    const t = mine.find((e) => e.date === date);
    return {
      id: u._id,
      name: u.name,
      morning: !!t?.morning, evening: !!t?.evening,
      fullDays: mine.filter((e) => e.morning && e.evening).length,
    };
  });
  res.json({ date, rows });
});

// One member's full history (for the Fellowship detail view)
app.get("/api/member/:id", auth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid member" });
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: "Member not found" });
  const entries = await Entry.find({ user: u._id }).select("date morning evening -_id");
  res.json({ name: u.name, entries });
});

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");
app.use(express.static(dist));
app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error, please try again" });
});

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/akkini", { dbName: "akkini" })  .then(() => app.listen(process.env.PORT || 5000, () => console.log("Server running")))
  .catch((err) => { console.error("MongoDB connection failed:", err.message); process.exit(1); });

process.on("unhandledRejection", (e) => console.error("Unhandled:", e));
process.on("uncaughtException", (e) => console.error("Uncaught:", e));