const express = require("express");
const router = express.Router();
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const { upload } = require("../config/cloudinary");
const verifyToken = require("../middleware/verifyToken");
const verifySeller = require("../middleware/verifySeller");
const verifyAdmin = require("../middleware/verifyAdmin");

// GET - all products (public) with search, filter, sort, pagination
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const {
      search,
      category,
      condition,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 12,
      status = "approved",
    } = req.query;

    const query = { status };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (category) query.category = category;
    if (condition) query.condition = condition;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    else if (sort === "price_desc") sortOption = { price: -1 };
    else if (sort === "newest") sortOption = { createdAt: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await db.collection("products").countDocuments(query);
    const products = await db
      .collection("products")
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    res.json({
      products,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - featured/latest products (public)
router.get("/featured", async (req, res) => {
  try {
    const db = getDB();
    const products = await db
      .collection("products")
      .find({ status: "approved" })
      .sort({ createdAt: -1 })
      .limit(8)
      .toArray();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - categories with count (public)
router.get("/categories", async (req, res) => {
  try {
    const db = getDB();
    const categories = await db
      .collection("products")
      .aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - stats for home page (public)
router.get("/stats", async (req, res) => {
  try {
    const db = getDB();
    const totalProducts = await db.collection("products").countDocuments({ status: "approved" });
    const totalSellers = await db.collection("users").countDocuments({ role: "seller" });
    const totalBuyers = await db.collection("users").countDocuments({ role: "buyer" });
    const completedOrders = await db.collection("orders").countDocuments({ orderStatus: "delivered" });

    res.json({ totalProducts, totalSellers, totalBuyers, completedOrders });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - seller's own products (private - seller)
router.get("/my-products", verifyToken, verifySeller, async (req, res) => {
  try {
    const db = getDB();
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { "sellerInfo.email": req.user.email };
    if (search) query.title = { $regex: search, $options: "i" };

    const total = await db.collection("products").countDocuments(query);
    const products = await db
      .collection("products")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    res.json({ products, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - seller dashboard stats (private - seller)
router.get("/seller-stats", verifyToken, verifySeller, async (req, res) => {
  try {
    const db = getDB();
    const email = req.user.email;

    const totalProducts = await db.collection("products").countDocuments({ "sellerInfo.email": email });
    const completedOrders = await db.collection("orders").countDocuments({
      "sellerInfo.email": email,
      orderStatus: "delivered",
    });
    const pendingOrders = await db.collection("orders").countDocuments({
      "sellerInfo.email": email,
      orderStatus: "pending",
    });

    const revenueResult = await db
      .collection("orders")
      .aggregate([
        { $match: { "sellerInfo.email": email, paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .toArray();

    const totalRevenue = revenueResult[0]?.total || 0;

    res.json({ totalProducts, completedOrders, pendingOrders, totalRevenue });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - all products for admin (private - admin)
router.get("/admin-all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = status ? { status } : {};
    const total = await db.collection("products").countDocuments(query);
    const products = await db
      .collection("products")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    res.json({ products, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - single product (public)
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const product = await db.collection("products").findOne({ _id: new ObjectId(req.params.id) });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST - add product with image upload (private - seller)
router.post("/", verifyToken, verifySeller, upload.single("image"), async (req, res) => {
  try {
    const db = getDB();
    const { title, description, category, condition, price, stock } = req.body;

    if (!title || !category || !condition || !price) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const seller = await db.collection("users").findOne({ email: req.user.email });

    const newProduct = {
      title,
      description: description || "",
      category,
      condition,
      price: parseInt(price),
      stock: parseInt(stock) || 1,
      image: req.file?.path || "",
      sellerInfo: {
        userId: seller?._id?.toString(),
        name: seller?.name,
        email: seller?.email,
        phone: seller?.phone || "",
        verified: seller?.verified || false,
      },
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("products").insertOne(newProduct);
    res.status(201).json({ message: "Product added successfully", insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PUT - update product (private - seller)
router.put("/:id", verifyToken, verifySeller, upload.single("image"), async (req, res) => {
  try {
    const db = getDB();
    const { title, description, category, condition, price, stock } = req.body;

    const product = await db.collection("products").findOne({ _id: new ObjectId(req.params.id) });
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.sellerInfo.email !== req.user.email) {
      return res.status(403).json({ message: "Forbidden: Not your product" });
    }

    const updateDoc = {
      $set: {
        ...(title && { title }),
        ...(description && { description }),
        ...(category && { category }),
        ...(condition && { condition }),
        ...(price && { price: parseInt(price) }),
        ...(stock && { stock: parseInt(stock) }),
        ...(req.file?.path && { image: req.file.path }),
        updatedAt: new Date(),
      },
    };

    const result = await db.collection("products").updateOne(
      { _id: new ObjectId(req.params.id) },
      updateDoc
    );
    res.json({ message: "Product updated", modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PATCH - approve/reject product (admin only)
router.patch("/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const result = await db.collection("products").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, updatedAt: new Date() } }
    );
    res.json({ message: "Product status updated", modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE - delete product (seller or admin)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const product = await db.collection("products").findOne({ _id: new ObjectId(req.params.id) });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const user = await db.collection("users").findOne({ email: req.user.email });
    const isOwner = product.sellerInfo.email === req.user.email;
    const isAdmin = user?.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await db.collection("products").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
