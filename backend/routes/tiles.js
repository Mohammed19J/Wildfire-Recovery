const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

// Route to get monthly tiles
router.get("/", (req, res) => {
  const filePath = path.join(__dirname, "..", "data", "monthly_tiles.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading tile file:", err);
      return res.status(500).json({ error: "Failed to read tile data" });
    }
    try {
      const json = JSON.parse(data);
      res.json(json);
    } catch (parseErr) {
      console.error("Error parsing tile file:", parseErr);
      res.status(500).json({ error: "Invalid tile data format" });
    }
  });
});

module.exports = router;
