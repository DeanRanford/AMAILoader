const express = require("express");
const multer = require("multer");
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });
const supportedLanguages = new Set([
  "Chinese",
  "Deutsch",
  "English",
  "French",
  "Norwegian",
  "Portuguese",
  "Romanian",
  "Russian",
  "Spanish",
  "Swedish",
]);

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
    const language = req.body.language || "English";
    const forceLanguage = req.body.forceLanguage === "true";
    const disableChat = req.body.disableChat === "true";
    if (!["ROC", "TFT", "REFORGED"].includes(version)) {
      uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
      return res.status(400).send("Unsupported Warcraft III version.");
    }
    if (!["0", "1", "2"].includes(commanderMode)) {
      uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
      return res.status(400).send("Unsupported commander mode.");
    }
    if (!supportedLanguages.has(language)) {
      uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
      return res.status(400).send("Unsupported AI chat language.");
    }
    if (
      (req.body.forceLanguage !== undefined &&
        req.body.forceLanguage !== "true") ||
      (req.body.disableChat !== undefined && req.body.disableChat !== "true")
    ) {
      uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
      return res.status(400).send("Invalid AI chat setting.");
    }

    const jobDir = fs.mkdtempSync(path.join(uploadsDir, "job_"));
    const mapPaths = [];
    const usedNames = new Set();
    let installerDir;

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
      const scriptsDir = path.join(amaiDir, "Scripts", `OPT${version}`);
      const selectedVersion = `OPT${version}`;
      const commonAiPath = path.join(scriptsDir, "common.ai");
      const commanderScript = commanderMode === "2"
        ? path.join(scriptsDir, "vsai", "Blizzard.j")
        : path.join(scriptsDir, "Blizzard.j");

      if (!fs.existsSync(scriptsDir)) {
        throw new Error(`Compiled AMAI scripts are missing: ${scriptsDir}`);
      }
      installerDir = fs.mkdtempSync(path.join(uploadsDir, "installer_"));
      fs.copyFileSync(path.join(amaiDir, "InstallToDir.pl"), path.join(installerDir, "InstallToDir.pl"));
      fs.copyFileSync(path.join(amaiDir, "MPQEditor.exe"), path.join(installerDir, "MPQEditor.exe"));
      fs.copyFileSync(path.join(amaiDir, "SFmpq.dll"), path.join(installerDir, "SFmpq.dll"));
      fs.mkdirSync(path.join(installerDir, "Scripts"), { recursive: true });
      fs.cpSync(scriptsDir, path.join(installerDir, "Scripts", selectedVersion), {
        recursive: true,
      });

      if (disableChat) {
        const commonAi = fs.readFileSync(commonAiPath, "utf8");
        const chatSetting = /(^\s*set\s+chatting\s*=\s*)(true|false)(\s*$)/gm;
        if ([...commonAi.matchAll(chatSetting)].length !== 1) {
          throw new Error("Expected one chat initialization setting in common.ai.");
        }
        fs.writeFileSync(
          path.join(installerDir, "Scripts", selectedVersion, "common.ai"),
          commonAi.replace(chatSetting, "$1false$3"),
          "utf8",
        );
      }

      if (forceLanguage) {
        const languageFiles = [
          path.join(installerDir, "Scripts", selectedVersion, "common.ai"),
          ...(commanderMode === "0"
            ? []
            : [path.join(
                installerDir,
                "Scripts",
                selectedVersion,
                path.relative(scriptsDir, commanderScript),
              )]),
        ];
        for (const stagedPath of languageFiles) {
          const data = fs.readFileSync(stagedPath, "utf8");
          const languageDeclaration = /\bstring\s+language\s*=\s*"[^"]*"/;
          if (!languageDeclaration.test(data)) {
            throw new Error(`Language setting was not found in ${path.basename(stagedPath)}.`);
          }
          fs.writeFileSync(
            stagedPath,
            data.replace(languageDeclaration, `string language = "${language}"`),
            "utf8",
          );
        }
      }

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
        selectedVersion,
        wineJobDir,
        commanderMode,
      ];
      const env = {
        ...process.env,
        WINEPREFIX: winePrefix,
        WINEDEBUG: process.env.WINEDEBUG || "-all",
        WINEPATH: [
          process.env.WINEPATH,
          `Z:${installerDir.replace(/\//g, "\\")}`,
          "C:\\strawberry\\perl\\bin",
        ]
          .filter(Boolean)
          .join(";"),
        PATH: `${perlBin}:${process.env.PATH || ""}`,
      };

      console.log(`Executing via Wine: wine ${args.join(" ")} in ${installerDir}`);
      let output;
      try {
        output = execFileSync("wine", args, {
          cwd: installerDir,
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
          fs.rmSync(installerDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.error("Cleanup error:", cleanupErr);
        }
      });
    } catch (err) {
      console.error("AMAI processing error:", err.message);
      fs.rmSync(jobDir, { recursive: true, force: true });
      if (installerDir) {
        fs.rmSync(installerDir, { recursive: true, force: true });
      }
      uploadedFiles.forEach((file) => fs.rmSync(file.path, { force: true }));
      return res.status(500).send(err.message);
    }
  },
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AMAI Web Frontend running on port ${PORT}`);
});
