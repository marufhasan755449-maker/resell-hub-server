const express = require("express");
const router = express.Router();
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const verifyToken = require("../middleware/verifyToken");

// GET - buyer's wishlist (private)
router.get("/", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const wishlist = await db
      .collection("wishlist")
      .find({ userEmail: req.user.email })
      .sort({ addedAt: -1 })
      .toArray();
    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST - add to wishlist (private)
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { productId, productTitle, productImage, productPrice, sellerEmail } = req.body;

    const existing = await db.collection("wishlist").findOne({
      userEmail: req.user.email,
      productId,
    });

    if (existing) {
      return res.status(400).json({ message: "Already in wishlist" });
    }

    const item = {
      userEmail: req.user.email,
      productId,
      productTitle,
      productImage,
      productPrice,
      sellerEmail,
      addedAt: new Date(),
    };

    const result = await db.collection("wishlist").insertOne(item);
    res.status(201).json({ message: "Added to wishlist", insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE - remove from wishlist (private)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const item = await db.collection("wishlist").findOne({ _id: new ObjectId(req.params.id) });

    if (!item) return res.status(404).json({ message: "Wishlist item not found" });
    if (item.userEmail !== req.user.email) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await db.collection("wishlist").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Removed from wishlist" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
