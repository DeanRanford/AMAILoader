const express = require("express");
const multer = require("multer");
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

app.use(express.static("public"));

app.post(
  "/process-map",
  upload.fields([{ name: "mapFiles" }, { name: "mapFile" }]),
  (req, res) => {
    const uploadedFiles = [
      ...(req.files?.mapFiles || []),
      ...(req.files?.mapFile || []),
    ];

    if (uploadedFiles.length === 0) {
      return res.status(400).send("No map files uploaded.");
    }

    const unsupportedFile = uploadedFiles.find(
      (file) => ![".w3m", ".w3x"].includes(path.extname(file.originalname).toLowerCase()),
    );
    if (unsupportedFile) {
      uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
      return res
        .status(400)
        .send(`Unsupported map file: ${unsupportedFile.originalname}`);
    }

    const version = req.body.version || "REFORGED";
    const commanderMode = req.body.commander || "1";
    if (!["ROC", "TFT", "REFORGED"].includes(version)) {
      uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
      return res.status(400).send("Unsupported Warcraft III version.");
    }
    if (!["0", "1", "2"].includes(commanderMode)) {
      uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
      return res.status(400).send("Unsupported commander mode.");
    }

    const jobDir = fs.mkdtempSync(path.join(uploadsDir, "job_"));
    const mapPaths = [];
    const usedNames = new Set();

    try {
      for (const file of uploadedFiles) {
        const originalName = path.posix.basename(file.originalname.replace(/\\/g, "/"));
        const extension = path.extname(originalName);
        const baseName = path
          .basename(originalName, extension)
          .replace(/[^A-Za-z0-9._() -]/g, "_");
        let mapName = `${baseName || "map"}${extension}`;
        let suffix = 2;
        while (usedNames.has(mapName.toLowerCase())) {
          mapName = `${baseName} (${suffix++})${extension}`;
        }
        usedNames.add(mapName.toLowerCase());

        const mapPath = path.join(jobDir, mapName);
        fs.renameSync(file.path, mapPath);
        mapPaths.push(mapPath);
      }

      const amaiDir = path.join(__dirname, "AMAI");
      const wineJobDir = `Z:${jobDir.replace(/\//g, "\\")}\\`;
      const winePrefix =
        process.env.WINEPREFIX ||
        path.join(process.env.HOME || "/root", ".wine");
      const perlBin = path.join(
        winePrefix,
        "drive_c",
        "strawberry",
        "perl",
        "bin",
      );
      const args = [
        "C:/strawberry/perl/bin/perl.exe",
        "InstallToDir.pl",
        version,
        wineJobDir,
        commanderMode,
      ];
      const env = {
        ...process.env,
        WINEPREFIX: winePrefix,
        WINEDEBUG: process.env.WINEDEBUG || "-all",
        WINEPATH: [
          process.env.WINEPATH,
          "C:\\strawberry\\perl\\bin",
        ]
          .filter(Boolean)
          .join(";"),
        PATH: `${perlBin}:${process.env.PATH || ""}`,
      };

      console.log(`Executing via Wine: wine ${args.join(" ")} in ${amaiDir}`);
      let output;
      try {
        output = execFileSync("wine", args, {
          cwd: amaiDir,
          env,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        const details = [error.stdout, error.stderr]
          .filter(Boolean)
          .map((value) => value.toString())
          .join("\n");
        throw new Error(
          `AMAI execution failed: ${details || error.message}`,
        );
      }
      console.log(output);

      if (/^(?:ERROR:|Unable to spawn MPQEditor process)/m.test(output)) {
        throw new Error(`AMAI reported an installation failure:\n${output}`);
      }

      const missingMap = mapPaths.find((mapPath) => !fs.existsSync(mapPath));
      if (missingMap) {
        throw new Error(`AMAI did not produce the expected map: ${path.basename(missingMap)}`);
      }

      let downloadPath = mapPaths[0];
      let downloadName = `AMAI_${path.basename(mapPaths[0])}`;
      if (mapPaths.length > 1) {
        downloadPath = path.join(jobDir, "AMAI_maps.zip");
        execFileSync("zip", ["-q", "-j", downloadPath, ...mapPaths], {
          cwd: jobDir,
        });
        downloadName = "AMAI_maps.zip";
      }

      res.download(downloadPath, downloadName, (err) => {
        if (err) {
          console.error("Download error:", err);
        }
        try {
          fs.rmSync(jobDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.error("Cleanup error:", cleanupErr);
        }
      });
    } catch (err) {
      console.error("AMAI processing error:", err.message);
      fs.rmSync(jobDir, { recursive: true, force: true });
      uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
      return res.status(500).send(err.message);
    }
  },
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AMAI Web Frontend running on port ${PORT}`);
});
