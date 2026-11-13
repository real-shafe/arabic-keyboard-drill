// Voices every letter name in scripts/names.mjs with ElevenLabs and writes
// public/audio/<code point>.mp3, which the page plays on a correct answer.
// Same voice, model and processing as Arabic Sound Lab: raw 24 kHz PCM,
// silence trimmed, loudness normalized to -18 LUFS, 64 kbps mono MP3.
//
//   npm run audio                 voice any letter without a clip
//   npm run audio -- --force      re-request everything (ignores the PCM cache)
//   npm run audio -- --only ح ه   re-render just these letters
//   npm run audio -- --only ط --seed 3   try another seed (then record it in SEEDS)
//   npm run audio -- --check      transcribe each clip with Scribe and compare
//
// The key comes from ELEVENLABS_API_KEY; npm run audio loads it from
// ../arabic-sound-lab/.env.local. Raw responses are cached in
// node_modules/.cache/tts so reprocessing costs no characters.

import { existsSync, createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyFades, normalizeLoudness, pcm16leToFloat32, trimSilence } from "./lib/dsp.mjs";
import { encodeMp3 } from "./lib/mp3.mjs";
import { NAMES, clipName } from "./names.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "audio");
const CACHE = join(ROOT, "node_modules", ".cache", "tts");
const VOICE_ID = "G1HOkzin3NMwRHSq60UI"; // Chaouki, as in Arabic Sound Lab
const SAMPLE_RATE = 24000;
const DEFAULT_SEED = 1234;
// When a name comes out wrong, give it another seed here and rerun with --only.
const SEEDS = { "ذ": 2, "س": 3, "ف": 3, "ق": 2, "ط": 1 };

const args = process.argv.slice(2);
const force = args.includes("--force");
const check = args.includes("--check");
const onlyAt = args.indexOf("--only");
const seedAt = args.indexOf("--seed");
const seedOverride = seedAt >= 0 ? Number(args[seedAt + 1]) : null;
const only = onlyAt >= 0 ? new Set(args.slice(onlyAt + 1).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--seed").filter(a => !/^\d+$/.test(a))) : null;

const sha1 = d => createHash("sha1").update(d).digest("hex");
async function writeAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, data);
  await rename(`${path}.tmp`, path);
}

function request(ch) {
  return {
    text: NAMES[ch].normalize("NFC"),
    modelId: "eleven_v4",
    languageCode: "ar",
    voiceSettings: { stability: 0.75, similarityBoost: 0.75 },
    outputFormat: "pcm_24000",
    seed: seedOverride ?? SEEDS[ch] ?? DEFAULT_SEED,
  };
}

function render(pcm) {
  const trimmed = trimSilence(pcm16leToFloat32(pcm), { sampleRate: SAMPLE_RATE, leadMs: 40, tailMs: 100, fadeMs: 5, frameMs: 10, relativeDb: -40, floorDb: -60 });
  if (trimmed.silent) throw new Error("the audio is silent");
  const norm = normalizeLoudness(trimmed.signal, { sampleRate: SAMPLE_RATE, targetLufs: -18, ceilingDb: -1 });
  applyFades(norm.signal, { sampleRate: SAMPLE_RATE, fadeMs: 5 });
  return { mp3: encodeMp3(norm.signal, { sampleRate: SAMPLE_RATE, kbps: 64 }), seconds: norm.signal.length / SAMPLE_RATE, lufs: norm.lufs };
}

let client;
async function getClient() {
  if (client) return client;
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not set (npm run audio loads it from ../arabic-sound-lab/.env.local).");
  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  return (client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY }));
}

async function synthesize(ch) {
  const body = request(ch);
  const cachePath = join(CACHE, `${sha1(JSON.stringify({ VOICE_ID, ...body })).slice(0, 20)}.pcm`);
  if (!force && existsSync(cachePath)) return { pcm: await readFile(cachePath), source: "cache" };
  const c = await getClient();
  for (let attempt = 1; ; attempt++) {
    try {
      const stream = await c.textToSpeech.convert(VOICE_ID, body, { timeoutInSeconds: 60, maxRetries: 0 });
      const pcm = Buffer.from(await new Response(stream).arrayBuffer());
      await writeAtomic(cachePath, pcm);
      return { pcm, source: "api" };
    } catch (err) {
      const status = err?.statusCode ?? err?.status;
      if (!(status === 429 || status >= 500 || status === undefined) || attempt >= 4) throw err;
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

async function transcribe(path) {
  const res = await (await getClient()).speechToText.convert({ file: createReadStream(path), modelId: "scribe_v3", languageCode: "ar", tagAudioEvents: false });
  return (res.text || "").trim();
}

const strip = s => s.normalize("NFC").replace(/[ً-ْٰ.،,؟?!\s]/g, "").replace(/[أإآ]/g, "ا");

async function main() {
  const letters = Object.keys(NAMES).filter(ch => !only || only.has(ch));
  if (only) for (const ch of only) if (!NAMES[ch]) throw new Error(`No name for "${ch}" in scripts/names.mjs`);

  if (check) {
    let ok = 0;
    for (const ch of letters) {
      const path = join(OUT, clipName(ch));
      if (!existsSync(path)) { console.log(`  ${ch}  no clip`); continue; }
      const heard = await transcribe(path);
      const match = strip(heard) === strip(NAMES[ch]);
      ok += match;
      console.log(`  ${match ? "ok " : "?? "} ${ch}  ${NAMES[ch]}  heard: ${heard}`);
    }
    console.log(`${ok}/${letters.length} transcribe as intended`);
    return;
  }

  let chars = 0;
  let failed = 0;
  const queue = letters.filter(ch => force || only || !existsSync(join(OUT, clipName(ch))));
  console.log(`${letters.length} letters, ${queue.length} to render`);
  const worker = async () => {
    for (let ch; (ch = queue.shift()); ) {
      try {
        const { pcm, source } = await synthesize(ch);
        if (source === "api") chars += NAMES[ch].length;
        const r = render(pcm);
        await writeAtomic(join(OUT, clipName(ch)), r.mp3);
        console.log(`  ${ch}  ${NAMES[ch]}  ${r.seconds.toFixed(2)} s  ${r.lufs.toFixed(1)} LUFS  [${source}]`);
      } catch (err) {
        failed++;
        console.error(`  failed ${ch} ${NAMES[ch]}: ${err.message}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]); // Starter plan allows 3 at once
  console.log(`${chars} characters used, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch(err => {
  console.error(err?.message || err);
  process.exitCode = 1;
});
