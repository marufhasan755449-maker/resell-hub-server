const express = require("express");
const router = express.Router();
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

// GET - check if user is admin
router.get("/admin/:email", verifyToken, async (req, res) => {
  try {
    if (req.user.email !== req.params.email) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const db = getDB();
    const user = await db.collection("users").findOne({ email: req.params.email });
    res.json({ admin: user?.role === "admin" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - check if user is seller
router.get("/seller/:email", verifyToken, async (req, res) => {
  try {
    if (req.user.email !== req.params.email) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const db = getDB();
    const user = await db.collection("users").findOne({ email: req.params.email });
    res.json({ seller: user?.role === "seller" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - get all users (admin only)
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = search
      ? { $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
      : {};

    const total = await db.collection("users").countDocuments(query);
    const users = await db.collection("users").find(query).skip(skip).limit(parseInt(limit)).toArray();

    res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - get user by email (private)
router.get("/:email", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const user = await db.collection("users").findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PATCH - update user profile (private)
router.patch("/:email", verifyToken, async (req, res) => {
  try {
    if (req.user.email !== req.params.email) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const db = getDB();
    const { name, photo, phone, location } = req.body;

    const updateDoc = {
      $set: {
        ...(name && { name }),
        ...(photo && { photo }),
        ...(phone && { phone }),
        ...(location && { location }),
        updatedAt: new Date(),
      },
    };

    const result = await db.collection("users").updateOne({ email: req.params.email }, updateDoc);
    res.json({ message: "Profile updated", modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PATCH - update user role (admin only)
router.patch("/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { role } = req.body;

    if (!["buyer", "seller", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { role, updatedAt: new Date() } }
    );
    res.json({ message: "Role updated", modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PATCH - update user status (admin only)
router.patch("/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { status } = req.body;

    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, updatedAt: new Date() } }
    );
    res.json({ message: "Status updated", modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE - delete user (admin only)
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const result = await db.collection("users").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "User deleted", deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
