const { getDB } = require("../config/db");

const verifySeller = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) return res.status(401).json({ message: "Unauthorized" });

    const db = getDB();
    const user = await db.collection("users").findOne({ email });

    if (!user || (user.role !== "seller" && user.role !== "admin")) {
      return res.status(403).json({ message: "Forbidden: Sellers only" });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = verifySeller;
