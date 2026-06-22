#!/usr/bin/env python3
"""
webgen_seedance.py — drive Seedance to auto-generate the i2v (people) clips.

Thin wrapper over webgen_common. Seedance is IMAGE-to-video: for each i2v shot it
uploads the shot's `ref_photo`, types the `prompt`, generates, and downloads the clip
to clips_raw/{id}.mp4. Resumable (skip-if-exists). Sign in with Google once; the
session is persisted in webgen_profile_seedance/ (gitignored).

Put each shot's reference photo where its `ref_photo` field points (e.g. refs/t5.jpg).

Setup (once):
    pip install playwright
    playwright install chromium

Usage:
    python webgen_seedance.py --inspect      # open Seedance paused: log in / grab selectors
    python webgen_seedance.py                 # generate every i2v shot with no clip yet
    python webgen_seedance.py --only t5 t14
    python webgen_seedance.py --gen-timeout 360
"""

from webgen_common import Tool, run

SEEDANCE = Tool(
    name="seedance",
    # Update if your Seedance entry point differs (e.g. the i2v / generate page).
    url="https://seedance.com/",
    upload_input=[
        "input[type='file']",
        "input[accept*='image' i]",
    ],
    needs_ref_photo=True,
    prompt_box=[
        "textarea[placeholder*='prompt' i]",
        "textarea[placeholder*='describe' i]",
        "textarea",
        "[contenteditable='true']",
    ],
    generate_btn=[
        "button:has-text('Generate')",
        "button:has-text('Create')",
        "button:has-text('Animate')",
        "button[aria-label*='generate' i]",
    ],
    download_btn=[
        "button:has-text('Download')",
        "a[download]",
        "button[aria-label*='download' i]",
    ],
    video="video",
)

if __name__ == "__main__":
    run(SEEDANCE, default_types="i2v")
