const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

// POST - create payment intent (private)
router.post("/create-payment-intent", verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 1) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to paisa (BDT smallest unit)
      currency: "bdt",
      payment_method_types: ["card"],
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ message: "Payment intent creation failed", error: error.message });
  }
});

// POST - save payment record (private)
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { orderId, transactionId, amount, paymentMethod } = req.body;

    const buyer = await db.collection("users").findOne({ email: req.user.email });

    const paymentRecord = {
      orderId,
      transactionId,
      buyerId: buyer?._id?.toString(),
      buyerEmail: req.user.email,
      amount: parseInt(amount),
      paymentStatus: "success",
      paymentMethod: paymentMethod || "card",
      paymentDate: new Date(),
    };

    const result = await db.collection("payments").insertOne(paymentRecord);
    res.status(201).json({ message: "Payment saved", insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - buyer's payment history (private)
router.get("/my-payments", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const payments = await db
      .collection("payments")
      .find({ buyerEmail: req.user.email })
      .sort({ paymentDate: -1 })
      .toArray();
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET - all payments (admin only)
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = getDB();
    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = status ? { paymentStatus: status } : {};
    const total = await db.collection("payments").countDocuments(query);
    const payments = await db
      .collection("payments")
      .find(query)
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    res.json({ payments, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
