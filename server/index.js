const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const rootDir = path.join(__dirname, "..");
const uploadsDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "output");
const sfxDir = path.join(rootDir, "public", "sfx");
const manifestPath = path.join(sfxDir, "sfx-manifest.json");
const distDir = path.join(rootDir, "dist");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 150 * 1024 * 1024
  }
});

function loadManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function findSfxByFile(fileName) {
  const manifest = loadManifest();
  const cleanFile = path.basename(String(fileName || ""));
  const item = manifest.find((sfx) => sfx.file === cleanFile);
  if (!item) return null;

  const fullPath = path.join(sfxDir, item.file);
  if (!fs.existsSync(fullPath)) return null;

  return { ...item, fullPath };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "IRUNGU SOUNDS backend is running." });
});

app.get("/api/sfx", (req, res) => {
  try {
    res.json(loadManifest());
  } catch {
    res.status(500).json({ error: "Could not load SFX manifest." });
  }
});

app.post("/api/mix-audio", upload.single("audio"), async (req, res) => {
  let uploadedFilePath = null;

  try {
    const audioFile = req.file;
    if (!audioFile) return res.status(400).json({ error: "No narration audio file uploaded." });

    uploadedFilePath = audioFile.path;

    let effects = [];
    try {
      effects = JSON.parse(req.body.effects || "[]");
    } catch {
      return res.status(400).json({ error: "Effects must be valid JSON." });
    }

    const sfxMaster = Math.max(0, Math.min(150, Number(req.body.sfxMaster || 100))) / 100;

    if (!Array.isArray(effects) || effects.length === 0) {
      return res.status(400).json({ error: "Add or generate at least one sound effect." });
    }

    if (effects.length > 180) {
      return res.status(400).json({ error: "Too many SFX at once. Keep it under 180 for stable mixing." });
    }

    const validEffects = effects.map((effect) => {
      const sfx = findSfxByFile(effect.file);
      if (!sfx) throw new Error(`Missing or invalid SFX file: ${effect.file}`);

      const timestampSeconds = Number(effect.timestampSeconds);
      const volume = Number(effect.volume);

      if (!Number.isFinite(timestampSeconds) || timestampSeconds < 0) {
        throw new Error(`Invalid timestamp for effect: ${sfx.name}`);
      }

      if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
        throw new Error(`Invalid volume for effect: ${sfx.name}`);
      }

      return { ...sfx, timestampSeconds, volume };
    });

    const outputFile = path.join(outputDir, `mixed-${Date.now()}.mp3`);
    const ffmpegArgs = ["-i", uploadedFilePath];

    validEffects.forEach((effect) => ffmpegArgs.push("-i", effect.fullPath));

    const filterParts = [`[0:a]anull[voice]`];
    let mixInputs = "[voice]";

    validEffects.forEach((effect, index) => {
      const inputIndex = index + 1;
      const delayMs = Math.round(effect.timestampSeconds * 1000);
      const volumeValue = (effect.volume / 100) * sfxMaster;
      filterParts.push(
        `[${inputIndex}:a]volume=${volumeValue},adelay=${delayMs}|${delayMs}[sfx${index}]`
      );
      mixInputs += `[sfx${index}]`;
    });

    const totalInputs = validEffects.length + 1;
    const filterComplex =
      `${filterParts.join(";")};` +
      `${mixInputs}amix=inputs=${totalInputs}:duration=longest:dropout_transition=0:normalize=0,` +
      `alimiter=limit=0.98[out]`;

    ffmpegArgs.push(
      "-filter_complex", filterComplex,
      "-map", "[out]",
      "-ac", "2",
      "-b:a", "192k",
      "-y", outputFile
    );

    execFile("ffmpeg", ffmpegArgs, { maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
      if (error) {
        console.error("FFmpeg failed:", stderr);
        return res.status(500).json({
          error: "Audio mixing failed. Check FFmpeg and try fewer effects or a shorter audio test."
        });
      }

      res.download(outputFile, "irungu-sounds-final.mp3", (downloadError) => {
        if (downloadError) console.error("Download error:", downloadError);

        try { if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath); } catch {}

        setTimeout(() => {
          try { if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); } catch {}
        }, 60_000);
      });
    });
  } catch (error) {
    console.error(error);
    try { if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath); } catch {}
    res.status(500).json({ error: error.message || "Server error." });
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`IRUNGU SOUNDS running on port ${PORT}`);
});
