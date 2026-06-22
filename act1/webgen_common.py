#!/usr/bin/env python3
"""
webgen_common.py — shared browser engine for the free web-tool clip generators.

Both webgen_veo.py (text-to-video, t2v) and webgen_seedance.py (image-to-video,
i2v with a ref_photo) are thin wrappers over this. No paid API, no key: it opens a
real browser, you sign in once (session persisted per tool), and it drives the tool
from shots.json, saving each clip to clips_raw/{id}.mp4. Resumable (skip-if-exists).

A `Tool` bundles the per-site knobs (URL + ordered candidate selectors). Selectors
are role/text based with fallbacks; when a site ships UI changes, edit the lists in
the wrapper or grab fresh ones with `playwright codegen <url>`.

⚠️ Runs on YOUR machine — needs the open internet and your login. You're automating
   your own free-tier usage: keep the window visible (captchas), respect the tool's
   Terms of Service and daily credit caps.
"""

import argparse
import base64
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import config
import util

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    sys.exit("[fatal] playwright not installed. Run:\n  pip install playwright\n  playwright install chromium")


@dataclass
class Tool:
    """Per-site configuration for the generic engine."""
    name: str                       # short id, e.g. "veo"
    url: str                        # page that hosts the generator
    prompt_box: list                # candidate selectors for the prompt textarea
    generate_btn: list              # candidate selectors for the generate/run button
    download_btn: list              # candidate selectors for the download control
    video: str = "video"            # selector for the resulting <video>
    upload_input: list = field(default_factory=list)  # file-input selectors (i2v only)
    needs_ref_photo: bool = False   # True for image-to-video tools

    @property
    def profile_dir(self) -> Path:
        # persistent login session, one per tool (gitignored)
        return config.ROOT / f"webgen_profile_{self.name}"


def first_visible(page, selectors, timeout=8000):
    """Return the first visible locator among candidate selectors, or raise."""
    deadline = time.time() + timeout / 1000
    last = None
    while time.time() < deadline:
        for sel in selectors:
            loc = page.locator(sel).first
            try:
                if loc.is_visible():
                    return loc
            except Exception as e:
                last = e
        page.wait_for_timeout(250)
    raise PWTimeout(f"none of these became visible: {selectors} ({last})")


def ensure_ready(page, tool):
    """Open the tool and wait for the prompt box (pausing for manual login if needed)."""
    page.goto(tool.url, wait_until="domcontentloaded")
    try:
        first_visible(page, tool.prompt_box, timeout=8000)
        return
    except PWTimeout:
        print(f"\n>>> Sign in to {tool.name} in the open browser window.")
        print(">>> When the prompt box is visible, press Enter here to continue...")
        input()


def save_video(page, out_path, tool):
    """Download the generated clip. Try the download button, then fall back to the
    <video> source bytes (works for blob: and same-origin URLs) via in-page fetch."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        btn = first_visible(page, tool.download_btn, timeout=4000)
        with page.expect_download(timeout=60000) as dl:
            btn.click()
        dl.value.save_as(str(out_path))
        return out_path.exists() and out_path.stat().st_size > 0
    except Exception:
        pass
    try:
        src = page.locator(tool.video).first.get_attribute("src")
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


def _resolve_ref(shot):
    """Absolute path to a shot's ref_photo, or None."""
    rp = (shot.get("ref_photo") or "").strip()
    if not rp:
        return None
    p = Path(rp)
    if not p.is_absolute():
        p = config.ROOT / p
    return p if p.exists() else None


def _current_src(page, tool):
    try:
        return page.locator(tool.video).first.get_attribute("src")
    except Exception:
        return None


def _generate_once(page, prompt, tool, args, out_path):
    """Type the prompt, generate one clip, wait for a NEW result, and save it."""
    prev_src = _current_src(page, tool)

    box = first_visible(page, tool.prompt_box)
    box.click()
    try:
        box.fill("")
    except Exception:
        page.keyboard.press("Control+A"); page.keyboard.press("Delete")
    box.type(prompt, delay=8)

    first_visible(page, tool.generate_btn).click()

    # Wait for a video whose src differs from the previous take (so take 2+ doesn't
    # grab take 1's still-visible result).
    deadline = time.time() + args.gen_timeout
    while time.time() < deadline:
        src = _current_src(page, tool)
        if src and src != prev_src:
            break
        page.wait_for_timeout(500)
    else:
        return "timeout"
    page.wait_for_timeout(1500)  # let the src settle

    return "done" if save_video(page, out_path, tool) else "no-download"


def generate_shot(page, shot, tool, args):
    """Upload ref_photo (i2v), then generate 1 (or --takes N) clips and install one."""
    sid, prompt = shot["id"], (shot.get("prompt") or "").strip()
    if not prompt:
        print(f"  - {sid}: no prompt, skipping")
        return "no-prompt"

    # image-to-video: upload the reference photo once before generating
    if tool.needs_ref_photo:
        ref = _resolve_ref(shot)
        if not ref:
            print(f"    [warn] {sid}: i2v needs ref_photo but '{shot.get('ref_photo')}' not found — skipping")
            return "no-ref"
        try:
            page.locator(tool.upload_input[0]).first.set_input_files(str(ref))
            page.wait_for_timeout(1500)
        except Exception as e:
            print(f"    [warn] {sid}: ref_photo upload failed ({e}) — check upload_input selectors")
            return "upload-failed"

    takes = max(1, getattr(args, "takes", 1))

    # Single take: write straight to the installed path.
    if takes == 1:
        print(f"  · {sid}: generating … (up to {args.gen_timeout}s)")
        status = _generate_once(page, prompt, tool, args, config.CLIPS_DIR / f"{sid}.mp4")
        if status == "done":
            print(f"    ✓ {sid}: saved {config.CLIPS_DIR / f'{sid}.mp4'}")
        else:
            print(f"    [warn] {sid}: {status}")
        return status

    # A/B (N-way): generate N candidates, then auto-pick the best.
    import besttake
    tdir = besttake.take_dir(sid)
    tdir.mkdir(parents=True, exist_ok=True)
    made = 0
    for k in range(takes):
        print(f"  · {sid}: take {k + 1}/{takes} …")
        if _generate_once(page, prompt, tool, args, tdir / f"take{k + 1}.mp4") == "done":
            made += 1
    if made == 0:
        print(f"    [warn] {sid}: no usable takes")
        return "timeout"
    return "done" if besttake.pick_for_shot(shot) else "no-download"


def build_argparser(tool, default_types):
    ap = argparse.ArgumentParser(description=f"Auto-generate {tool.name} clips for the Act I shots.")
    ap.add_argument("--types", default=default_types,
                    help=f"comma list of shot types to generate, or 'all' (default: {default_types})")
    ap.add_argument("--only", nargs="*", help="restrict to these shot ids")
    ap.add_argument("--gen-timeout", type=int, default=300, help="seconds to wait per generation")
    ap.add_argument("--takes", type=int, default=1,
                    help="generate N takes per shot and auto-pick the best (A/B best-take)")
    ap.add_argument("--between", type=float, default=3.0, help="pause between shots (seconds)")
    ap.add_argument("--headless", action="store_true", help="run without a visible window (not recommended)")
    ap.add_argument("--inspect", action="store_true",
                    help="open the tool paused so you can log in / grab selectors, then exit")
    return ap


def run(tool, default_types):
    """Full CLI entry point for a given Tool."""
    args = build_argparser(tool, default_types).parse_args()
    shots = util.load_shots()
    want_types = None if args.types.lower() == "all" else {t.strip() for t in args.types.split(",")}
    only = set(args.only) if args.only else None

    tool.profile_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(tool.profile_dir), headless=args.headless,
            args=["--disable-blink-features=AutomationControlled"],
            accept_downloads=True, viewport={"width": 1440, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        if args.inspect:
            page.goto(tool.url, wait_until="domcontentloaded")
            print(f"Inspect mode: log in and/or grab selectors. "
                  f"Tip: `playwright codegen {tool.url}`")
            page.pause()
            ctx.close()
            return

        ensure_ready(page, tool)

        counts = {}
        for shot in shots:
            if only and shot["id"] not in only:
                continue
            # Routing: a shot may pin its generator via an optional "tool" field
            # (e.g. "tool": "luma" for a big-camera-move shot). When set, only the
            # matching generator handles it; otherwise fall back to the type filter.
            explicit = (shot.get("tool") or "").strip().lower()
            if explicit:
                if explicit != tool.name:
                    continue
            elif want_types is not None and shot.get("type") not in want_types:
                continue
            if (config.CLIPS_DIR / f"{shot['id']}.mp4").exists():
                counts["cached"] = counts.get("cached", 0) + 1
                continue
            try:
                status = generate_shot(page, shot, tool, args)
            except Exception as e:
                status = "error"
                print(f"    [error] {shot['id']}: {e}")
            counts[status] = counts.get(status, 0) + 1
            page.wait_for_timeout(int(args.between * 1000))

        ctx.close()
        print("\nSummary:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
        print("Next:  python tts.py  &&  python assemble.py")
