const fs = require("fs");
const path = require("path");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

const width = 800;
const height = 400;
const canvasRenderService = new ChartJSNodeCanvas({ width, height });
// Create a new ChartJSNodeCanvas instance with the desired width and height
const generateNdviGraph = async () => {
  const labels = [
    "2020-06", "2020-07", "2020-08", "2020-09", "2020-10",
    "2021-01", "2021-06", "2022-06", "2023-06", "2024-06"
  ];
  const values = [0.75, 0.62, 0.45, 0.35, 0.28, 0.30, 0.42, 0.51, 0.65, 0.72];
  const max = Math.max(...values);
  const percent = values.map(v => (v / max * 100).toFixed(2));

  const config = {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "NDVI (% of Pre-Fire)",
        data: percent,
        borderColor: "green",
        fill: false
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
        }
      }
    }
  };

  // Generate PNG buffer
  const buffer = await canvasRenderService.renderToBuffer(config);

  //Save to disk for download
  const outputPath = path.join(__dirname, "..", "public", "ndvi_graph.png");
  fs.writeFileSync(outputPath, buffer);
  console.log(" Saved NDVI graph to public/ndvi_graph.png");

  return buffer;
};

module.exports = { generateNdviGraph };
