const mongoose = require("mongoose");
const { Schema } = mongoose;

const postSchema = new mongoose.Schema({
  title: String,
  summary: String,
  content: String,
  cover: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Post", postSchema);
