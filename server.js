const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));

app.post("/process-map", upload.single("mapFile"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No map file uploaded.");
  }

  const originalPath = req.file.path;
  const extension = path.extname(req.file.originalname) || ".w3m";
  const processedFileName = `amai_${Date.now()}${extension}`;
  const targetPath = path.join(__dirname, "uploads", processedFileName);

  // Give the uploaded map file its correct extension (.w3m or .w3x)
  fs.renameSync(originalPath, targetPath);

  const version = req.body.version || "REFORGED"; // Options: ROC, TFT, REFORGED
  const commanderMode = req.body.commander || "1"; // 0: No commander, 1: Commander, 2: VS Vanilla

  const amaiBatPath = path.join(
    __dirname,
    "AMAI",
    `Install${version}ToMap.bat`,
  );

  // Execute via Wine inside the container environment
  const command = `wine cmd.exe /c "${amaiBatPath}" "${targetPath}" ${commanderMode}`;

  console.log(`Executing command: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Execution error: ${error.message}`);
      console.error(`stderr: ${stderr}`);
      return res
        .status(500)
        .send(`Failed to process map via AMAI: ${stderr || error.message}`);
    }

    res.download(targetPath, `AMAI_${req.file.originalname}`, (err) => {
      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch (cleanupErr) {
        console.error("Cleanup error:", cleanupErr);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AMAI Docker Web Frontend running on port ${PORT}`);
});
