const express = require("express");
const router = express.Router();
const { generateNdviGraph } = require("../utils/ndviPlotter");

// Route to get NDVI graph
router.get("/", async (req, res) => {
  const imageBuffer = await generateNdviGraph();
  res.set("Content-Type", "image/png");
  res.send(imageBuffer);
});

module.exports = router;
