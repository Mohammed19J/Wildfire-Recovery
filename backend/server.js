const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// routes
const ndviRoute = require("./routes/ndvi");
const earthRoute = require("./routes/earth");
const tilesRoute = require("./routes/tiles");

app.use("/api/monthly-tiles", tilesRoute);
app.use("/api/ndvi-graph", ndviRoute);
app.use("/api/earth", earthRoute);

// STATIC FILES FOR IMAGE PREVIEW
app.use("/api/prediction", express.static(path.join(__dirname, "public")));
app.use("/api/ndvi-graph/preview", express.static(path.join(__dirname, "public")));

// DOWNLOAD Predicted NDVI Graph
app.get("/api/prediction/download", (req, res) => {
  const filePath = path.join(__dirname, "public", "predicted_ndvi.png");
  res.download(filePath, "predicted_ndvi.png", (err) => {
    if (err) {
      console.error("Download error (prediction):", err);
      res.status(500).send("Failed to download the prediction graph");
    }
  });
});

// DOWNLOAD Real NDVI Graph 
app.get("/api/ndvi-graph/download", (req, res) => {
  const filePath = path.join(__dirname, "public", "ndvi_graph.png");
  res.download(filePath, "ndvi_graph.png", (err) => {
    if (err) {
      console.error("Download error (ndvi):", err);
      res.status(500).send("Failed to download the NDVI graph");
    }
  });
});

// SERVER
app.listen(port, () => {
  console.log('Backend running at http://localhost:${port}');
});
