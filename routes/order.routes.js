const express = require("express");
const router = express.Router();
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const verifyToken = require("../middleware/verifyToken");
const verifySeller = require("../middleware/verifySeller");
const verifyAdmin = require("../middleware/verifyAdmin");

// GET - buyer's own orders (private)
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const orders = await db
      .collection("orders")
      .find({ "buyerInfo.email": req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - seller's incoming orders (private - seller)
router.get("/seller-orders", verifyToken, verifySeller, async (req, res) => {
  try {
    const db = getDB();
    const orders = await db
      .collection("orders")
      .find({ "sellerInfo.email": req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - all orders (admin only)
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = status ? { orderStatus: status } : {};
    const total = await db.collection("orders").countDocuments(query);
    const orders = await db
      .collection("orders")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    res.json({ orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - single order (private)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const order = await db.collection("orders").findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST - create order (private - buyer, created after payment)
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { productId, sellerInfo, amount, deliveryInfo, transactionId } = req.body;

    const buyer = await db.collection("users").findOne({ email: req.user.email });

    const newOrder = {
      buyerInfo: {
        userId: buyer?._id?.toString(),
        name: buyer?.name,
        email: buyer?.email,
        phone: buyer?.phone || "",
      },
      sellerInfo,
      productId,
      amount: parseInt(amount),
      deliveryInfo: deliveryInfo || {},
      transactionId,
      paymentStatus: "paid",
      orderStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("orders").insertOne(newOrder);
    res.status(201).json({ message: "Order created", insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PATCH - cancel order (buyer - only pending orders)
router.patch("/:id/cancel", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const order = await db.collection("orders").findOne({ _id: new ObjectId(req.params.id) });

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.buyerInfo.email !== req.user.email) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (order.orderStatus !== "pending") {
      return res.status(400).json({ message: "Cannot cancel order that is not pending" });
    }

    const result = await db.collection("orders").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { orderStatus: "cancelled", updatedAt: new Date() } }
    );
    res.json({ message: "Order cancelled", modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PATCH - update order status (seller)
router.patch("/:id/status", verifyToken, verifySeller, async (req, res) => {
  try {
    const db = getDB();
    const { orderStatus } = req.body;

    const validStatuses = ["pending", "accepted", "processing", "shipped", "delivered", "rejected"];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const result = await db.collection("orders").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { orderStatus, updatedAt: new Date() } }
    );
    res.json({ message: "Order status updated", modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
