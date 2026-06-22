#!/usr/bin/env python3
"""
webgen_veo.py — drive Google AI Studio (Veo) to auto-generate the t2v clips.

Thin wrapper over webgen_common: defines Veo's URL + selectors and runs the engine.
Veo is TEXT-to-video, so this targets t2v shots (locations, skies, the map). For the
i2v (people / ref_photo) shots, use webgen_seedance.py.

Setup (once):
    pip install playwright
    playwright install chromium

Usage:
    python webgen_veo.py --inspect          # open AI Studio paused: log in / grab selectors
    python webgen_veo.py                     # generate every t2v shot with no clip yet
    python webgen_veo.py --only t2 t11 t18   # just these shot ids
    python webgen_veo.py --gen-timeout 360
"""

from webgen_common import Tool, run

VEO = Tool(
    name="veo",
    url="https://aistudio.google.com/generate-video",
    prompt_box=[
        "textarea[placeholder*='prompt' i]",
        "textarea[aria-label*='prompt' i]",
        "textarea",
        "[contenteditable='true']",
    ],
    generate_btn=[
        "button:has-text('Generate')",
        "button:has-text('Run')",
        "button:has-text('Create')",
        "button[aria-label*='generate' i]",
    ],
    download_btn=[
        "button:has-text('Download')",
        "button[aria-label*='download' i]",
        "a[download]",
    ],
    video="video",
)

if __name__ == "__main__":
    run(VEO, default_types="t2v")
