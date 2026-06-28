const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");

// Generate JWT token
router.post("/jwt", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Token generation failed", error: error.message });
  }
});

// Register or login user (save to DB after Firebase Auth)
router.post("/register", async (req, res) => {
  try {
    const { name, email, photo, phone, location } = req.body;
    if (!name || !email) return res.status(400).json({ message: "Name and email are required" });

    const db = getDB();
    const existingUser = await db.collection("users").findOne({ email });

    if (existingUser) {
      return res.json({ message: "User already exists", user: existingUser });
    }

    const newUser = {
      name,
      email,
      photo: photo || "",
      phone: phone || "",
      location: location || "",
      role: "buyer",
      status: "active",
      createdAt: new Date(),
    };

    const result = await db.collection("users").insertOne(newUser);
    res.status(201).json({ message: "User registered", insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
});

// Get current user info
router.get("/me", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const user = await db.collection("users").findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
