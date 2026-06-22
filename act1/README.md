# Act I — FREE ($0) Assembly Pipeline

Assemble a **5-minute (~305s) short film** from clips you generate by hand, using
**only free tools — no paid APIs, no API keys**.

> **The split that makes this free:** AI clip *generation* can't be automated for
> free, so you make the ~30 clips by hand in free web tools (playbook below).
> Everything *after* that — voiceover, music, captions, color treatments, and the
> final stitch — is automated here with only **free** tools (`edge-tts` + `ffmpeg`).
> Total cost: **$0**.

---

## What's here

| File | Role |
|---|---|
| `shots.json` | **Single source of truth.** The shot list (a sample is included — replace it with yours). |
| `config.py` | All the knobs: voice IDs, resolution, caption style, ducking level, paths. |
| `tts.py` | Synthesize voiceover with **edge-tts** (free, no key). Caches to `cache/vo/{id}.mp3`. |
| `assemble.py` | Build the film with **ffmpeg**: trim/pad, scale, treatments, captions, concat, ducked mix, export. |
| `util.py` | Shared helpers (used by both scripts). |
| `clips_raw/{id}.mp4` | **You** drop your hand-made clips here. |
| `vo/{id}.wav` | *(optional)* your **own** voice recordings — used instead of TTS when present. |
| `assets/music/miss_misery.mp3` | The music bed. |
| `cache/`, `output/` | Generated. `output/act1.mp4` is the final film. |

---

## Setup

**1. Python 3.11 + edge-tts (free, no API key):**
```bash
pip install edge-tts
```

**2. ffmpeg (free system install):**
- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt-get install ffmpeg`
- Windows: `winget install Gyan.FFmpeg` (or download a static build and add it to PATH)

Verify: `ffmpeg -version` and `python -c "import edge_tts"` should both succeed.

**3. Drop in your music:** put your track at `assets/music/miss_misery.mp3`.

> **Behind a corporate proxy / TLS gateway?** edge-tts pins its own CA bundle.
> `tts.py` honors the standard `SSL_CERT_FILE` env var — point it at your CA
> bundle (`export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt`) and TTS will
> trust the proxy. No effect in normal environments.

---

## Run order

```bash
# 0. Generate clips into clips_raw/ — by hand (playbook below) OR semi-automated for
#    the t2v shots with webgen_veo.py (drives Google AI Studio Veo — see next section).
#    You do NOT need them all to start; the dry run uses placeholders.

# 1. Synthesize voiceover (free, resumable — skips cached/own recordings)
python tts.py

# 2. Preview the FULL 5-min cut with placeholder slates for any missing clips.
#    Lock timing, captions, voiceover, and music before you spend hours generating.
python assemble.py --dry-run        # → output/act1.mp4 (all slates)

# 3. Review. Then fill in clips_raw/ over a few days (re-roll bad shots freely).
#    (optional) auto-check generated clips and cull broken ones:
python qc.py                        # report; add --quarantine to move bad clips aside

# 4. Build the real film. Re-run any time — only changed/new shots rebuild.
python assemble.py                  # → output/act1.mp4
```

Helpful flags:
```bash
python tts.py --voices              # list all edge-tts voices
python tts.py --voices spanish      # filter the voice list
python tts.py --force               # re-synthesize everything
python assemble.py --force          # rebuild every segment (ignore cache)
python assemble.py --keep-temp      # keep the intermediate video/audio files
```

---

## Semi-automating clip generation — `webgen_*` (optional)

Generating clips is the one step with no free *API*, so it's normally done by hand.
These scripts automate it by driving the free web tools in a **real browser** — no
paid API, no key. They read `shots.json`, drive the tool per shot, and save each clip
to `clips_raw/{id}.mp4`. **Resumable** (skips shots that already have a clip).

| Script | Tool | Shots | Input |
|---|---|---|---|
| `webgen_veo.py` | Google AI Studio (**Veo**) | `t2v` — locations, skies, the map | `prompt` (text-to-video) |
| `webgen_seedance.py` | **Seedance** | `i2v` — people / couple shots | `ref_photo` + `prompt` (image-to-video) |
| `webgen_luma.py` | **Luma** Dream Machine | `t2v` — big camera moves (dolly/aerial) | `prompt` (text-to-video) |

All three share one engine (`webgen_common.py`); the wrappers just hold each site's
URL and selectors.

**Routing a shot to a specific tool.** Veo and Luma are both text-to-video. By
default a generator picks up the shots matching its type; to pin a shot to one tool,
add a `"tool"` field in `shots.json` (e.g. `"tool": "luma"` on a big-aerial shot).
Tagged shots go *only* to that tool; untagged `t2v` shots go to whichever t2v
generator you run first (the others skip them — clips are skip-if-exists). You can
also just target shots ad hoc with `--only`.

> **These run on YOUR machine, not in a CI sandbox.** They need the open internet and
> your login. You're automating your own free-tier usage — keep the browser window
> visible (to solve any captcha) and respect each tool's daily credit caps and Terms
> of Service. Sign in once per tool; the session persists in
> `webgen_profile_<tool>/` (gitignored).

**Setup (once):**
```bash
pip install playwright
playwright install chromium
```

**Run — Veo (t2v / places):**
```bash
python webgen_veo.py --inspect      # opens AI Studio paused: sign in once, and/or grab selectors
python webgen_veo.py                # generate every t2v shot that has no clip yet
python webgen_veo.py --only t2 t11  # just these shot ids
```

**Run — Seedance (i2v / people):** put each shot's reference photo where its
`ref_photo` field points (e.g. `refs/t5.jpg`), then:
```bash
python webgen_seedance.py --inspect # sign in once / grab selectors
python webgen_seedance.py           # generate every i2v shot that has no clip yet
python webgen_seedance.py --only t5 t14
```

**Run — Luma (t2v / big camera moves):**
```bash
python webgen_luma.py --inspect     # sign in once / grab selectors
python webgen_luma.py --only t12 t18 # the aerial / pull-back shots
```

**If a step can't find its element** (these sites ship UI changes), the selectors are
ordered candidate lists (role/text based) at the top of each wrapper — edit them, or
record fresh ones with:
```bash
playwright codegen aistudio.google.com     # or: playwright codegen seedance.com
```

Then continue the normal run order: `python qc.py` → `python tts.py` → `python assemble.py`.

---

## Quality-checking the clips — `qc.py`

Free web-tool clips occasionally come back broken (an empty render, a black frame, a
single frozen frame). `qc.py` scans `clips_raw/{id}.mp4` for every shot and flags:

| Flag | Meaning |
|---|---|
| `missing` | no clip generated yet |
| `corrupt` | unreadable / ~zero duration |
| `too-short` | shorter than `--min-dur` seconds (default 1.0) |
| `black` | more than `--black` of the clip is black (default 0.5) |
| `static` | more than `--freeze` of the clip is a frozen frame (default 0.95) |

```bash
python qc.py                       # report table + summary (exits non-zero if anything is flagged)
python qc.py --json cache/qc.json  # also write a machine-readable report
python qc.py --quarantine          # MOVE flagged clips to clips_raw/_rejected/ …
```

With `--quarantine`, flagged clips are moved aside, so the resumable generators
re-make exactly those shots on the next run. The loop to re-roll bad shots is:

```bash
python webgen_veo.py     # (and/or seedance/luma) → generate
python qc.py --quarantine # → cull the bad ones
python webgen_veo.py     # → regenerate only what was culled
```

---

## How `shots.json` works

Each shot:

```json
{
  "id": "t5",                       // file name: clips_raw/t5.mp4, vo/t5.wav, cache/vo/t5.mp3
  "scene": "Betrayal — empty chair",
  "start": 60,                      // seconds; shots are assembled in start order
  "dur": 20,                        // exact on-screen seconds (clip is trimmed/frozen to fit)
  "type": "i2v",                    // i2v = image-to-video, t2v = text-to-video (picks the tool)
  "prompt": "An empty chair ...",   // the generation prompt (shown on placeholder slates)
  "ref_photo": "refs/t5.jpg",       // reference photo for i2v shots
  "treatment": "grayscale",         // grayscale | color_bloom | normal
  "vo_text": "You left the way ...",// voiceover line + burned-in lower-third caption
  "vo_voice": "henry",              // henry | erika (mapped to edge-tts voices in config.py)
  "caption_es": "Te fuiste ...",    // optional Spanish subtitle (second line)
  "tool": "luma"                    // optional: pin this shot's generator (veo | seedance | luma)
}
```

Total runtime is derived as `max(start + dur)` across shots (~305s by design).

**Treatments:**
- `grayscale` — full desaturation (the betrayal).
- `color_bloom` — saturation ramps **0 → 1** across the shot (color returning in forgiveness).
- `normal` — untouched.

**Voices** (edit IDs freely in `config.py`):
- `henry` → `en-US-ChristopherNeural` (warm, measured male).
- `erika` → `en-US-AvaNeural` (warm female). For a real Spanish-accented read,
  set it to `es-ES-ElviraNeural`.

**Voiceover priority:** if `vo/{id}.wav` (your own recording) exists, it's used
instead of TTS. Otherwise `tts.py` synthesizes `cache/vo/{id}.mp3`.

---

## What `assemble.py` does to each shot

1. Loads `clips_raw/{id}.mp4` — or, if it's missing, inserts a **labeled placeholder
   slate** and warns (it never crashes). Supports a two-part clip
   `{id}_a.mp4` + `{id}_b.mp4` (concatenated in order).
2. **Trims or freezes** to exactly `dur`. If a clip is shorter than `dur`, the last
   frame is **held** (no speed-stretching).
3. **Scales to 1080p 16:9.** Portrait/odd-ratio sources get a **blurred-fill**
   background (sharp clip centered, blurred copy behind) — same look across the film.
4. Applies the **treatment** (grayscale / color_bloom / normal).
5. Burns a **lower-third caption** from `vo_text` with a subtle drop shadow, plus an
   optional **Spanish subtitle** from `caption_es`.
6. Concatenates all shots in `start` order into one ~305s track.
7. **Audio:** lays each shot's VO at its `start`, loops the music under it, and
   **ducks the music to ~25%** whenever a VO line plays (scripted volume automation
   with short fades — precise and click-free).
8. Exports **H.264 1080p** to `output/act1.mp4`.

Per-shot segments are cached in `cache/seg/`, so the build is **resumable**: add a
clip, re-run, and only that shot is rebuilt.

---

## Free clip-generation playbook

Generate each `clips_raw/{id}.mp4` by hand in a free, **no-watermark** tool, picked
by the shot's `type`:

| Shot type | Free tool | How |
|---|---|---|
| `i2v` (couple shots) | **Seedance 2.0** (sign in with Google) | Upload the shot's `ref_photo`, paste the `prompt`, generate image-to-video. Free, 1080p, no watermark, ~daily credits. |
| `t2v` (locations, skies, the map) | **Google AI Studio → Veo 3.1** (ai.google.dev/aistudio) | Paste the `prompt`. Free with a Google account, no watermark, best cinematic quality. |
| `t2v` needing big camera moves | **Luma Dream Machine** (free, ~1/day) | Paste the `prompt`; great for dolly/aerial. |
| any (drafts only) | **Kling 3.0** free (66 daily credits) | Watermarked — use only to test, never for final clips. |

Notes:
- **Free clips are short (≈5–10s).** For shots longer than the tool allows, generate
  at max free length — the pipeline **freezes the last frame** to reach `dur`. Or
  generate two clips and drop them as `clips_raw/{id}_a.mp4` and `{id}_b.mp4`; they're
  concatenated automatically.
- **Daily credit caps** mean you'll spread generation over a few days and re-roll bad
  shots — everything here is **resumable** (cached, skip-if-exists), so just re-run.
- **Generated audio from these tools is ignored** — this pipeline supplies the
  voiceover and music.

---

## Cost

| Component | Tool | Cost |
|---|---|---|
| Clip generation | Seedance / Veo / Luma (free tiers, by hand) | $0 |
| Voiceover | edge-tts | $0 |
| Music, captions, color, stitch, mix | ffmpeg | $0 |
| **Total** | | **$0** |
