const express = require("express");
const router = express.Router();
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const verifyToken = require("../middleware/verifyToken");

// GET - reviews for a product (public)
router.get("/product/:productId", async (req, res) => {
  try {
    const db = getDB();
    const reviews = await db
      .collection("reviews")
      .find({ productId: req.params.productId })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST - add review (private)
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { productId, rating, comment } = req.body;

    if (!productId || !rating) {
      return res.status(400).json({ message: "ProductId and rating are required" });
    }

    const reviewer = await db.collection("users").findOne({ email: req.user.email });

    const existing = await db.collection("reviews").findOne({
      productId,
      "reviewerInfo.email": req.user.email,
    });

    if (existing) {
      return res.status(400).json({ message: "You have already reviewed this product" });
    }

    const review = {
      productId,
      reviewerInfo: {
        userId: reviewer?._id?.toString(),
        name: reviewer?.name,
        email: reviewer?.email,
        photo: reviewer?.photo || "",
      },
      rating: parseInt(rating),
      comment: comment || "",
      createdAt: new Date(),
    };

    const result = await db.collection("reviews").insertOne(review);
    res.status(201).json({ message: "Review added", insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE - delete review (admin or reviewer)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const review = await db.collection("reviews").findOne({ _id: new ObjectId(req.params.id) });
    if (!review) return res.status(404).json({ message: "Review not found" });

    const user = await db.collection("users").findOne({ email: req.user.email });
    const isOwner = review.reviewerInfo.email === req.user.email;
    const isAdmin = user?.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await db.collection("reviews").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
