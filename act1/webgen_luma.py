#!/usr/bin/env python3
"""
webgen_luma.py — drive Luma Dream Machine to auto-generate t2v clips.

Thin wrapper over webgen_common. Luma is great for big camera moves (dolly, aerial,
pull-back), so it's a strong choice for those t2v shots. Text-to-video: it types each
shot's `prompt`, generates, and downloads to clips_raw/{id}.mp4. Resumable.

Because both Veo and Luma are text-to-video, pin specific shots to Luma either with
--only, or by adding "tool": "luma" to those shots in shots.json (the engine then
routes only those shots here). Luma's free tier is ~1 generation/day, so spread it out.

Setup (once):
    pip install playwright
    playwright install chromium

Usage:
    python webgen_luma.py --inspect          # open Luma paused: log in / grab selectors
    python webgen_luma.py --only t12 t18      # the big-camera-move shots
    python webgen_luma.py                      # every shot tagged "tool": "luma" (or all t2v)
    python webgen_luma.py --gen-timeout 360
"""

from webgen_common import Tool, run

LUMA = Tool(
    name="luma",
    url="https://lumalabs.ai/dream-machine",
    prompt_box=[
        "textarea[placeholder*='prompt' i]",
        "textarea[placeholder*='describe' i]",
        "textarea",
        "[contenteditable='true']",
    ],
    generate_btn=[
        "button:has-text('Generate')",
        "button:has-text('Create')",
        "button[aria-label*='generate' i]",
        "button[type='submit']",
    ],
    download_btn=[
        "button:has-text('Download')",
        "a[download]",
        "button[aria-label*='download' i]",
    ],
    video="video",
)

if __name__ == "__main__":
    run(LUMA, default_types="t2v")
