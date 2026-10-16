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

  // Create an isolated temporary directory for this request
  const jobDir = path.join(__dirname, "uploads", `job_${Date.now()}`);
  fs.mkdirSync(jobDir, { recursive: true });

  const targetPath = path.join(jobDir, req.file.originalname);
  fs.renameSync(originalPath, targetPath);

  const version = req.body.version || "REFORGED"; // Options: ROC, TFT, REFORGED
  const commanderMode = req.body.commander || "1"; // 0: No commander, 1: Commander, 2: VS Vanilla

  const amaiDir = path.join(__dirname, "AMAI");
  const batName = `Install${version}ToMap.bat`;

  // Convert the target file path to a Windows-style path under Wine (e.g. Z:\app\uploads\job_...\map.w3m)
  const wineTargetPath = `Z:${targetPath.replace(/\//g, "\\")}`;

  // Execute the batch script directly using cmd.exe under Wine
  const command = `wine cmd.exe /c "${batName}" "${wineTargetPath}" ${commanderMode}`;

  console.log(`Executing Wine Batch Script: ${command} in ${amaiDir}`);

  exec(command, { cwd: amaiDir }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Execution error: ${error.message}`);
      console.error(`stderr: ${stderr}`);
      fs.rmSync(jobDir, { recursive: true, force: true });
      return res
        .status(500)
        .send(
          `Failed to process map via Wine batch: ${stderr || error.message}`,
        );
    }

    if (!fs.existsSync(targetPath)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
      return res
        .status(500)
        .send(
          "AMAI execution finished, but the modified map file was missing.",
        );
    }

    res.download(targetPath, `AMAI_${req.file.originalname}`, (err) => {
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error("Cleanup error:", cleanupErr);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AMAI Wine Web Frontend running on port ${PORT}`);
});
