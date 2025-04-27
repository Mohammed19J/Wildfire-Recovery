const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Serve precomputed monthly tile URLs
router.get("/monthly-tiles", (req, res) => {
  const filePath = path.join(__dirname, "../data/monthly_tiles.json");
  try {
    const tiles = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json(tiles);
  } catch (err) {
    console.error("Failed to read monthly tiles JSON:", err);
    res.status(500).json({ error: "Could not load monthly tile data" });
  }
});

module.exports = router;
