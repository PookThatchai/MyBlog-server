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
const uploadMiddleware = multer({ dest: "uploads/" });
require("dotenv").config();
app.use("/uploads", express.static("uploads"));

const secret = process.env.JWT_SECRET || "23498ewfshrui23rwhdf";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const corsOptions = {
  origin: process.env.FRONTEND_URL,
};
app.use(cors(corsOptions));

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

    res.json({ user: userDoc, frontendUrl: process.env.FRONTEND_URL });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
