const express = require("express");
const app = express();
const PORT = process.env.PORT || 4444;
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/Post");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const uploadMiddleware = multer({ dest: "uploads/" }); // ใช้ multer เพื่อจัดการไฟล์ที่อัปโหลด
require("dotenv").config();
app.use("/uploads", express.static("uploads"));

const secret = process.env.JWT_SECRET || "23498ewfshrui23rwhdf";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, secret, (error, decoded) => {
    if (error) {
      return res.status(401).json({ message: "Failed to authenticate token" });
    }
    req.user = decoded;
    next();
  });
};

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.log("MongoDB connection error:", error));

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const userDoc = await User.create({
      username,
      password: hashedPassword,
    });

    res.json(userDoc);
  } catch (error) {
    res.status(400).json(error);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });

  if (!userDoc) {
    return res.status(400).json("User not found");
  }

  const isPasswordOk = await bcrypt.compare(password, userDoc.password);

  if (isPasswordOk) {
    jwt.sign(
      { username, id: userDoc._id },
      secret,
      { expiresIn: "1h" },
      (error, token) => {
        if (error) {
          return res.status(500).json("Error generating token");
        }
        res.json({ message: "ok", token });
      }
    );
  } else {
    res.status(400).json("Incorrect information");
  }
});

app.get("/profile", verifyToken, (req, res) => {
  const userProfile = {
    id: req.user.id,
    username: req.user.username,
  };
  res.json(userProfile);
});

app.post("/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

app.post("/createpost", uploadMiddleware.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  cloudinary.uploader.upload(req.file.path, async (error, result) => {
    if (error) {
      return res
        .status(500)
        .json({ message: "Error uploading image to Cloudinary", error });
    }

    const imageUrl = result.secure_url;

    const { title, summary, content } = req.body;
    if (!title || !summary || !content) {
      return res.status(400).json({ message: "Incomplete data" });
    }

    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, secret);
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: imageUrl,
        author: decoded.id,
      });
      res.json(postDoc);
    } catch (error) {
      return res.status(401).json({ message: "Failed to authenticate token" });
    }
  });
});

// ดึงข้อมูลโพสต์
app.get("/createpost", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createAt: -1 })
      .populate("author", "username")
      .limit(20);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

app.get("/createpost/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const postDoc = await Post.findById(id).populate("author", ["username"]);

    if (!postDoc) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(postDoc);
  } catch (error) {
    res.status(500).json({ message: "Error fetching post", error });
  }
});

// แก้ไขโพสต์
app.put(
  "/createpost/:id",
  uploadMiddleware.single("file"),
  async (req, res) => {
    const { id } = req.params; // ดึง id ของโพสต์จาก URL
    const { title, summary, content } = req.body; // ดึงข้อมูลโพสต์จาก request body
    let cover = req.body.cover; // ค่า cover หากไม่มีการอัปโหลดใหม่จะใช้ค่าเดิม

    if (!title || !summary || !content) {
      return res.status(400).json({ message: "Incomplete data" });
    }

    if (req.file) {
      try {
        const cloudinaryResult = await cloudinary.uploader.upload(
          req.file.path
        );
        cover = cloudinaryResult.secure_url; // อัปเดต URL ของไฟล์ที่อัปโหลดใหม่
      } catch (error) {
        return res
          .status(500)
          .json({ message: "Error uploading image to Cloudinary", error });
      }
    }

    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, secret);

      const postDoc = await Post.findById(id);

      if (!postDoc) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (postDoc.author.toString() !== decoded.id) {
        return res
          .status(403)
          .json({ message: "You are not authorized to edit this post" });
      }
      postDoc.title = title;
      postDoc.summary = summary;
      postDoc.content = content;
      postDoc.cover = cover;
      await postDoc.save();

      res.json({ message: "Post updated successfully", post: postDoc });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Error during post update", error });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
