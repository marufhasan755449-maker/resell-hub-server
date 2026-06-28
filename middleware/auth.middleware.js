const jwt = require("jsonwebtoken");

// Verify JWT Token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: "Forbidden: Invalid or expired token" });
  }
};

// Verify Admin Role
const verifyAdmin = async (req, res, next) => {
  const { db } = req.app.locals;
  const { email } = req.user;
  try {
    const user = await db.users.findOne({ email });
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admins only" });
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Verify Seller Role
const verifySeller = async (req, res, next) => {
  const { db } = req.app.locals;
  const { email } = req.user;
  try {
    const user = await db.users.findOne({ email });
    if (!user || (user.role !== "seller" && user.role !== "admin")) {
      return res.status(403).json({ success: false, message: "Forbidden: Sellers only" });
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { verifyToken, verifyAdmin, verifySeller };
