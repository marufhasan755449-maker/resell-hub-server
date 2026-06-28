const express = require("express");
const router = express.Router();
const { upload, cloudinary } = require("../config/cloudinary");
const verifyToken = require("../middleware/verifyToken");

// POST - upload single image (private)
router.post("/image", verifyToken, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    res.json({
      message: "Image uploaded successfully",
      url: req.file.path,
      publicId: req.file.filename,
    });
  } catch (error) {
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});

module.exports = router;
