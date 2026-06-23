#!/usr/bin/env python3
"""
webgen_flow.py — drive Google **Flow** (labs.google/flow) Veo with a paid Google AI
subscription (AI Plus / Pro / Ultra). Thin wrapper over webgen_common.

Flow is Google's web filmmaking tool where a consumer AI subscription unlocks Veo. It
does BOTH text-to-video and image-to-video, so this one adapter handles every shot:
for an i2v shot (one with a `ref_photo`) it uploads the image first, otherwise it runs
pure t2v. Output goes to clips_raw/{id}.mp4; resumable (skip-if-exists). Sign in once
with your subscription account (the session persists in webgen_profile_flow/).

⚠️ Confirm your subscription tier actually includes Flow/Veo and check its monthly
   generation limits before relying on this — the lower tiers can be Veo-limited.
⚠️ Runs on YOUR machine (open internet + your Google login). Selectors here are
   role/text based and best-effort; Flow's UI changes, so on first run use --inspect
   to log in and grab the right selectors (or `playwright codegen labs.google/flow`).

Setup (once):
    pip install playwright
    playwright install chromium

Usage:
    python webgen_flow.py --inspect          # open Flow paused: sign in / grab selectors
    python webgen_flow.py                      # generate every shot with no clip yet
    python webgen_flow.py --only t2 t5         # just these shot ids
    python webgen_flow.py --takes 2            # A/B best-take per shot
    python webgen_flow.py --model "Veo 3 Fast" --aspect "16:9" --length "8s"
    python webgen_flow.py --gen-timeout 360

Model / aspect / length: pass the EXACT visible label from Flow's UI. They're applied
once after login (the picker selectors live in FLOW.settings_controls below). For this
film use --aspect "16:9" (matches the 1920×1080 assemble). Veo caps clip length (≈8s),
so long shots are generated in parts ({id}_a.mp4 + {id}_b.mp4) — both are supported.
"""

from webgen_common import Tool, run

FLOW = Tool(
    name="flow",
    url="https://labs.google/flow",
    # Flow does t2v and i2v; upload only fires when a shot has a ref_photo (not required).
    upload_input=[
        "input[type='file']",
        "input[accept*='image' i]",
    ],
    needs_ref_photo=False,
    prompt_box=[
        "textarea[placeholder*='prompt' i]",
        "textarea[placeholder*='describe' i]",
        "textarea[placeholder*='video' i]",
        "textarea",
        "[contenteditable='true']",
    ],
    generate_btn=[
        "button:has-text('Generate')",
        "button:has-text('Create')",
        "button[aria-label*='generate' i]",
        "button[type='submit']",
    ],
    # Flow often hides Download behind a per-clip "…/More" menu — open it first.
    menu_btn=[
        "button[aria-label*='more' i]",
        "button[aria-label*='options' i]",
        "button:has-text('⋯')",
        "button:has-text('More')",
    ],
    download_btn=[
        "button:has-text('Download')",
        "a[download]",
        "menuitem:has-text('Download')",
        "[role='menuitem']:has-text('Download')",
        "button[aria-label*='download' i]",
    ],
    video="video",
    # Controls that open each settings picker. The chosen value (e.g. --model
    # 'Veo 3 Fast', --aspect '16:9', --length '8s') is then clicked by its visible
    # text. Selectors are best-effort — refine with --inspect if a control is missed.
    settings_controls={
        "model": [
            "button[aria-label*='model' i]",
            "button:has-text('Veo')",
            "button:has-text('Model')",
            "[role='combobox'][aria-label*='model' i]",
        ],
        "aspect": [
            "button[aria-label*='aspect' i]",
            "button[aria-label*='ratio' i]",
            "button:has-text('Aspect')",
            "button:has-text('16:9')",
            "button:has-text('9:16')",
        ],
        "length": [
            "button[aria-label*='length' i]",
            "button[aria-label*='duration' i]",
            "button:has-text('Length')",
            "button:has-text('sec')",
            "button:has-text('s ')",
        ],
    },
)

if __name__ == "__main__":
    # default_types "all": Flow is your one subscription tool, so it picks up every
    # untagged shot (t2v and i2v). Shots pinned to another tool via "tool" still route there.
    run(FLOW, default_types="all")
