# Arabic Keyboard Drill

Learn where the letters sit on the iOS Arabic keyboard. Find the key for a described letter, or name a highlighted key; missed keys come back more often, and a slider limits the quiz to the most common letters. When you get a letter right, you hear its Arabic name.

Live at **https://arabic-keyboard-drill.shafe.dev**

The letter names are synthetic speech generated ahead of time with [ElevenLabs](https://elevenlabs.io) and served as plain MP3 files, so the page is a single static HTML file and no API key reaches the browser.

## Run it locally

```bash
npm run dev        # http://localhost:8795 (python3 static server)
```

## Regenerating the audio

The spoken names live in `scripts/names.mjs`; clips are written to `public/audio/<code point>.mp3` (e.g. `062C.mp3` for ج).

```bash
npm install
npm run audio                    # voice any letter without a clip
npm run audio -- --only ط        # re-render one letter
npm run audio -- --only ط --seed 3   # try another seed, then record it in SEEDS
npm run audio:check              # transcribe every clip with Scribe and compare
```

The scripts read `ELEVENLABS_API_KEY` from `../arabic-sound-lab/.env.local`. Voice, model (`eleven_v4`) and processing (silence trim, -18 LUFS, 64 kbps mono MP3) match [Arabic Sound Lab](https://github.com/real-shafe/arabic-sound-lab), whose DSP and MP3 helpers are copied into `scripts/lib/`. Speech-to-text is unreliable on single short words, so a failed check means "listen to it", not "it's wrong". ظ is voiced as "حَرْفُ الظَّاء" because the bare name kept coming out wrong.

## Deploy

```bash
npx wrangler deploy
```

Serves `public/` from a Cloudflare static-assets Worker (`wrangler.jsonc`).

## License

MIT
