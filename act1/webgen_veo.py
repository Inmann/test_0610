#!/usr/bin/env python3
"""
webgen_veo.py — drive Google AI Studio (Veo) to auto-generate the t2v clips.

This is the "vibe-coded" automation for the FREE web tool. It does NOT use a paid
API: it opens a real browser, you sign in to YOUR Google account once (the session
is saved), and the script then types each shot's prompt into Veo, generates the
video, and downloads it to clips_raw/{id}.mp4 — resumable (skips shots already done).

⚠️ Runs on YOUR machine, not in any sandbox: it needs the open internet and your
   Google login. It can't run where outbound web access is blocked.
⚠️ Selectors below are role/text based (resilient), but Google ships UI changes.
   If a step can't find its element, run with --inspect to open the page paused so
   you can grab the right selector (or use:  playwright codegen aistudio.google.com).
⚠️ You are automating your own free-tier usage; respect the tool's Terms of Service
   and its daily credit limits. Keep the browser visible so you can solve any captcha.

Setup (once):
    pip install playwright
    playwright install chromium

Usage:
    python webgen_veo.py --inspect          # open AI Studio paused: log in / grab selectors
    python webgen_veo.py                     # generate every t2v shot that has no clip yet
    python webgen_veo.py --types all         # generate ALL shots (i2v too — Veo is t2v-only, so prefer t2v)
    python webgen_veo.py --only t2 t11 t18   # just these shot ids
    python webgen_veo.py --gen-timeout 360   # seconds to wait per generation
"""

import argparse
import base64
import re
import sys
import time
from pathlib import Path

import config
import util

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    sys.exit("[fatal] playwright not installed. Run:\n  pip install playwright\n  playwright install chromium")

# ---------------------------------------------------------------------------
# Knobs — adjust here if the UI moves. Prefer role/text selectors (stable).
# ---------------------------------------------------------------------------
VEO_URL = "https://aistudio.google.com/generate-video"   # Veo video generation page
PROFILE_DIR = config.ROOT / "webgen_profile"             # persistent login (gitignored)

# Candidate selectors, tried in order until one is visible. Add/replace as needed.
PROMPT_BOX = [
    "textarea[placeholder*='prompt' i]",
    "textarea[aria-label*='prompt' i]",
    "textarea",
    "[contenteditable='true']",
]
GENERATE_BTN = [
    "button:has-text('Generate')",
    "button:has-text('Run')",
    "button:has-text('Create')",
    "button[aria-label*='generate' i]",
]
DOWNLOAD_BTN = [
    "button:has-text('Download')",
    "button[aria-label*='download' i]",
    "a[download]",
]
RESULT_VIDEO = "video"


def first_visible(page, selectors, timeout=8000):
    """Return the first visible locator from a list of candidate selectors."""
    deadline = time.time() + timeout / 1000
    while time.time() < deadline:
        for sel in selectors:
            loc = page.locator(sel).first
            try:
                if loc.is_visible():
                    return loc
            except Exception:
                pass
        page.wait_for_timeout(250)
    raise PWTimeout(f"none of these became visible: {selectors}")


def ensure_logged_in(page):
    """Open Veo and wait until the prompt box is reachable (manual login if needed)."""
    page.goto(VEO_URL, wait_until="domcontentloaded")
    try:
        first_visible(page, PROMPT_BOX, timeout=8000)
        return
    except PWTimeout:
        print("\n>>> Please sign in to Google in the open browser window.")
        print(">>> Once Veo's prompt box is visible, press Enter here to continue...")
        input()


def save_video(page, out_path):
    """
    Get the generated clip to out_path. Try a Download button first; fall back to
    fetching the <video> src (works for blob: and same-origin URLs) via in-page fetch.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # 1) Download button
    try:
        btn = first_visible(page, DOWNLOAD_BTN, timeout=4000)
        with page.expect_download(timeout=60000) as dl:
            btn.click()
        dl.value.save_as(str(out_path))
        return True
    except Exception:
        pass
    # 2) Fall back to the <video> source bytes
    try:
        src = page.locator(RESULT_VIDEO).first.get_attribute("src")
        if not src:
            return False
        b64 = page.evaluate(
            """async (url) => {
                const r = await fetch(url);
                const buf = new Uint8Array(await r.arrayBuffer());
                let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
                return btoa(s);
            }""",
            src,
        )
        out_path.write_bytes(base64.b64decode(b64))
        return out_path.stat().st_size > 0
    except Exception as e:
        print(f"    [warn] could not save video: {e}")
        return False


def generate_shot(page, shot, gen_timeout):
    """Type the prompt, generate, wait for the result, and download it."""
    sid, prompt = shot["id"], (shot.get("prompt") or "").strip()
    if not prompt:
        print(f"  - {sid}: no prompt, skipping")
        return "no-prompt"

    box = first_visible(page, PROMPT_BOX)
    box.click()
    # clear any existing text, then type the prompt
    try:
        box.fill("")
    except Exception:
        page.keyboard.press("Control+A")
        page.keyboard.press("Delete")
    box.type(prompt, delay=8)

    first_visible(page, GENERATE_BTN).click()

    # Wait for a fresh <video> to render (poll up to gen_timeout seconds)
    print(f"  · {sid}: generating … (up to {gen_timeout}s)")
    try:
        page.locator(RESULT_VIDEO).first.wait_for(state="visible", timeout=gen_timeout * 1000)
    except PWTimeout:
        print(f"    [warn] {sid}: no video appeared within {gen_timeout}s — check the page / credits")
        return "timeout"
    page.wait_for_timeout(1500)  # let the src settle

    out = config.CLIPS_DIR / f"{sid}.mp4"
    if save_video(page, out):
        print(f"    ✓ {sid}: saved {out}")
        return "done"
    print(f"    [warn] {sid}: generated but download failed (grab it manually, or fix DOWNLOAD_BTN)")
    return "no-download"


def main():
    ap = argparse.ArgumentParser(description="Auto-generate Veo clips for the Act I shots.")
    ap.add_argument("--types", default="t2v",
                    help="comma list of shot types to generate, or 'all' (default: t2v — Veo is text-to-video)")
    ap.add_argument("--only", nargs="*", help="restrict to these shot ids")
    ap.add_argument("--gen-timeout", type=int, default=300, help="seconds to wait per generation")
    ap.add_argument("--between", type=float, default=3.0, help="pause between shots (seconds)")
    ap.add_argument("--headless", action="store_true", help="run without a visible window (not recommended)")
    ap.add_argument("--inspect", action="store_true",
                    help="open AI Studio paused so you can log in / grab selectors, then exit")
    args = ap.parse_args()

    shots = util.load_shots()
    want_types = None if args.types.lower() == "all" else {t.strip() for t in args.types.split(",")}
    only = set(args.only) if args.only else None

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(PROFILE_DIR), headless=args.headless,
            args=["--disable-blink-features=AutomationControlled"],
            accept_downloads=True, viewport={"width": 1440, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        if args.inspect:
            page.goto(VEO_URL, wait_until="domcontentloaded")
            print("Inspect mode: log in and/or use the devtools to grab selectors.")
            print("Tip: run `playwright codegen aistudio.google.com` to record selectors.")
            page.pause()  # opens the Playwright Inspector
            ctx.close()
            return

        ensure_logged_in(page)

        counts = {}
        for shot in shots:
            if only and shot["id"] not in only:
                continue
            if want_types is not None and shot.get("type") not in want_types:
                continue
            if (config.CLIPS_DIR / f"{shot['id']}.mp4").exists():
                counts["cached"] = counts.get("cached", 0) + 1
                continue
            try:
                status = generate_shot(page, shot, args.gen_timeout)
            except Exception as e:
                status = "error"
                print(f"    [error] {shot['id']}: {e}")
            counts[status] = counts.get(status, 0) + 1
            page.wait_for_timeout(int(args.between * 1000))

        ctx.close()
        print("\nSummary:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
        print("Next:  python tts.py  &&  python assemble.py")


if __name__ == "__main__":
    main()
