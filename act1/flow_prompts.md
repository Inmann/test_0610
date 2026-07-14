# Flow (Veo 3) Shooting Prompts — "Act I" (≈5:05)

Ready-to-paste prompts for **Google Labs Flow** (Veo 3, included with Google AI Pro),
matching the 18-shot story in `shots.json`. Generate each clip, download it, drop it in
`clips_raw/`, then run `python assemble.py`.

---

## How to use this in Flow

1. **Settings (once):** Model = **Veo 3** (or **Veo 3 Fast** to save credits) · Aspect = **16:9** · highest quality you can afford.
2. **Per shot:** paste the prompt. For a **person shot (i2v)**, add your reference photo as an **Ingredient** (or "Frames to Video") so the character stays consistent. For **location shots (t2v)**, just paste the prompt.
3. **Length:** Veo makes ~8s per clip. Each shot below lists how many ~8s clips it needs. Two ways to reach the length:
   - **Extend** (recommended): generate the first clip, hit **Extend** to continue it, download the whole thing as one file → save as `clips_raw/{id}.mp4`.
   - **Parts:** generate 2–3 separate ~8s clips → save as `clips_raw/{id}_a.mp4`, `{id}_b.mp4`, `{id}_c.mp4` (the pipeline concatenates them in order).
   - Slightly short is fine — `assemble.py` freezes the last frame to hit the exact duration.
4. **Ignore Veo's audio** — `assemble.py` strips clip audio and adds our music + voiceover. Prompts say "no dialogue" so you don't get baked-in speech.
5. **No on-screen text** — captions/subtitles are burned in later by the pipeline.

> **t12 & t18** are tagged `"tool":"luma"` in `shots.json`, which only matters for the
> auto-scripts. Since you're generating in Flow by hand, just save those clips to
> `clips_raw/t12.mp4` / `t18.mp4` like the rest — the tag is ignored for manual drops.

---

## Global style block (already folded into each prompt)

> Cinematic live-action, photoreal, shot on 35mm film with fine grain, anamorphic-style
> shallow depth of field, 16:9. Natural motivated lighting, restrained camera motion,
> 24 fps filmic motion blur, elegant and understated. No on-screen text. No spoken
> dialogue — ambient sound only.

## Characters (edit to your leads; use the SAME description/photo every time)

- **LEAD_H** — the narrator, the one left behind: *a man in his early 30s, tired kind eyes, dark tousled hair, worn grey sweater.* (replace with your `refs/*.jpg` person)
- **LEAD_E** — the partner who leaves and returns: *a woman in her late 20s, warm expressive face, shoulder-length dark hair, mustard coat.* (replace with your `refs/*.jpg` person)

> Keep each lead visually identical across shots — same face, hair, wardrobe. In Flow,
> reuse the same **Ingredient** photo for that person every time.

---

## ACT 1 — Together (warm, hopeful)

### t1 · Prologue — the apartment at dawn · 14s · i2v · ~2 clips
> A small, lived-in apartment at first light. Dust motes drift through a warm shaft of window light. Two coffee cups rest on a wooden table. **LEAD_H** stands half-lit at the window, back to camera, still. Slow smooth push-in toward the table. Tender, nostalgic, quiet. Soft golden morning light, gentle long shadows, 35mm, shallow focus, 16:9, no dialogue.
**Ingredient:** LEAD_H photo. **Camera:** slow dolly push-in.

### t2 · The map on the wall · 12s · t2v · ~2 clips
> Close on a hand-drawn travel map pinned to a wall, coloured pins joined by red thread across distant places. Slow lateral dolly drifting across the map, soft warm lamp light catching the paper texture. Intimate, wistful, hopeful. 35mm, shallow depth of field, 16:9, no text on the map, no dialogue.
**Camera:** slow dolly left-to-right.

### t3 · Her letter · 16s · i2v · ~2 clips
> Extreme close on **LEAD_E**'s hands folding a handwritten letter at a kitchen table, soft morning light from the side. Delicate, intimate, unhurried. Shallow depth of field on the fingertips and paper, warm tones, faint dust in the light, 35mm, 16:9, no legible text, no dialogue.
**Ingredient:** LEAD_E photo (hands/forearms). **Camera:** locked-off, tiny breathing handheld.

---

## ACT 2 — Betrayal (cold, desaturated — the pipeline greys these)

> For t4–t9 keep lighting **cold and low**; the pipeline desaturates to grayscale, so shoot for mood, not colour.

### t4 · The phone call · 18s · i2v · ~3 clips
> **LEAD_H** stands by a rain-streaked window holding a phone to his ear, his expression slowly falling as he listens. Rain begins outside, grey daylight. Subtle handheld, intimate, the moment the news lands. Cold muted light, 35mm, shallow focus on his face, 16:9, no dialogue (silent reaction only).
**Ingredient:** LEAD_H photo. **Camera:** slow handheld push toward his face.

### t5 · Betrayal — the empty chair · 20s · i2v · ~3 clips
> A quiet interior: an empty chair across a table, one coffee cup pushed aside and gone cold. **LEAD_H** sits opposite, motionless, staring at the empty seat. Cold flat light, slow zoom in on the empty chair. Melancholic, still, aching. 35mm, shallow focus, 16:9, no dialogue.
**Ingredient:** LEAD_H photo. **Camera:** slow zoom-in on the empty chair.

### t6 · Rain on the window · 16s · t2v · ~2 clips
> Rain streaking down a dark window at night, out-of-focus city lights as soft bokeh behind the glass. Slow, moody, reflective. Cold blue tones, water beading and running, 35mm, very shallow focus racking between droplets and city lights, 16:9, no dialogue.
**Camera:** locked-off, slow focus rack.

### t7 · Walking the city at night · 18s · t2v · ~3 clips
> A lone figure walks away down wet, empty streets at night under sodium streetlights, reflections shimmering on the asphalt. Long lens, compressed perspective, isolated and small in the frame. Cold, cinematic, lonely. 35mm, shallow focus, gentle steadicam follow from behind, 16:9, no dialogue.
**Camera:** long-lens steadicam follow from behind.

### t8 · The old photographs · 16s · i2v · ~2 clips
> **LEAD_H**'s hands spread a scatter of old photographs across a bed under a dim lamp, pausing on one. Nostalgic, sorrowful, intimate. Warm-dim practical light against surrounding darkness, shallow focus on the photos, 35mm, 16:9, no legible faces in the photos, no dialogue.
**Ingredient:** LEAD_H photo (hands). **Camera:** slow overhead push-in.

### t9 · Sleepless · 18s · i2v · ~3 clips
> **LEAD_H** lies awake on his back, eyes open, as faint shadows shift across the ceiling. Pre-dawn blue light, very still, only breathing. Intimate, quiet despair. Cold soft light, 35mm, shallow focus, near-static slow drift above the bed, 16:9, no dialogue. End on the ceiling for a clean fade-to-black.
**Ingredient:** LEAD_H photo. **Camera:** near-static slow rise toward the ceiling.

---

## ACT 3 — The turn (colour tentatively returns)

### t10 · A message arrives · 16s · i2v · ~2 clips
> Dark bedroom, pre-dawn. A phone screen suddenly lights up on the nightstand, a single glowing message illuminating the dark. **LEAD_H**'s face turns toward the light, a flicker of hope. Warm glow against cold darkness, close-up, shallow focus, 35mm, 16:9, no legible text on screen, no dialogue.
**Ingredient:** LEAD_H photo. **Camera:** close-up, slow push toward the phone.

### t11 · The train station · 18s · t2v · ~3 clips
> An empty train platform at golden hour, warm low sun raking down the tracks. A train slides in from the distance, light flaring. Wide cinematic composition, anticipation, warmth returning. 35mm, shallow depth of field, slow dolly forward along the platform, 16:9, no dialogue.
**Camera:** slow dolly forward down the platform.

### t12 · Crossing the bridge · 16s · t2v · ~2 clips
> A lone figure crosses a long bridge toward camera at dawn, a river glinting far below, soft mist. Hopeful, expansive. Slow aerial pull-back rising away from the figure as they walk forward. Warm dawn light, cinematic, 35mm, 16:9, no dialogue.
**Camera:** slow aerial pull-back / crane up.

---

## ACT 4 — Forgiveness (colour blooms — the pipeline saturates these)

> For t13–t17 light **warm and bright**; the pipeline ramps saturation up, so lean into golden, glowing light.

### t13 · Her face again · 18s · i2v · ~3 clips
> A close portrait of **LEAD_E** turning slowly toward warm window light, a faint smile just beginning, eyes softening. Colour and warmth returning to her skin. Tender, luminous, intimate. Golden soft light, 35mm, very shallow focus, tiny handheld breath, 16:9, no dialogue.
**Ingredient:** LEAD_E photo. **Camera:** slow push-in as she turns to the light.

### t14 · Forgiveness — the embrace · 20s · i2v · ~3 clips
> **LEAD_H** and **LEAD_E** meet in a doorway and fold into a long embrace as warm light floods in behind them. Emotional, cathartic, unhurried — shoulders releasing, a held breath. Golden backlight, lens bloom, 35mm, shallow focus, slow arc around the couple, 16:9, no dialogue.
**Ingredients:** both LEAD_H and LEAD_E photos. **Camera:** slow arc/orbit around the embrace.

### t15 · Morning returns · 16s · t2v · ~2 clips
> The same apartment from the prologue, now flooded with bright morning sun — alive, warm, dust glowing in the light, the two coffee cups together again. Gentle push-in. Joyful, serene, renewed. Golden hour interior, 35mm, shallow focus, 16:9, no dialogue.
**Camera:** gentle slow push-in (mirrors t1).

### t16 · The map, redrawn · 14s · t2v · ~2 clips
> The same wall map, now with fresh bright pins and new thread added across new places. Warm lamp light, hopeful, forward-looking. Slow close dolly across the new routes. 35mm, shallow focus, 16:9, no legible text, no dialogue.
**Camera:** slow close dolly across the map (mirrors t2).

### t17 · Together, the doorway · 18s · i2v · ~3 clips
> **LEAD_H** and **LEAD_E** stand together as two silhouettes in a bright doorway, looking out at the light beyond. Warm backlight halo around them, peaceful, whole. Wide composition, slow push toward the doorway. 35mm, shallow focus, 16:9, no dialogue.
**Ingredients:** both LEAD_H and LEAD_E photos. **Camera:** slow push toward the backlit doorway.

---

## EPILOGUE

### t18 · The open road · 21s · t2v · ~3 clips
> An open road at sunrise stretching straight to the horizon, warm light spilling across empty asphalt and fields, expansive and hopeful. Slow aerial move forward down the road toward the rising sun. Cinematic finale, lens flare, 35mm, 16:9, no dialogue. Hold on the horizon to end.
**Camera:** slow aerial forward toward the sunrise.

---

## Credit-saving tips (Pro has a monthly cap)

- Use **Veo 3 Fast** for first passes; re-generate only the keepers on **Veo 3**.
- Start with **1 take** per shot; only re-roll the ones that fail `python qc.py`.
- Prefer **Extend** over many separate clips to reduce re-prompts.
- Rough total: 18 shots × ~2–3 clips ≈ **40–50 generations** for one clean pass — budget your monthly credits accordingly.

## After you have the clips
```bash
python validate_shots.py --expect 305
python qc.py --quarantine       # cull black/frozen/too-short, then re-generate those
python tts.py                   # voiceover (free)
python assemble.py              # → output/act1.mp4   (add --xfade for dissolves)
```
