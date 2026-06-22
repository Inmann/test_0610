#!/usr/bin/env python3
"""
smoke_test.py — fast end-to-end sanity check of the assembly pipeline.

Builds a tiny 3-shot film from placeholder slates (no clips, no music, no network)
exercising the real assemble.py code paths, and asserts the outputs are valid:

  - per-shot slate segments build
  - hard-cut concat (stream copy) → duration == sum(durs), has video
  - xfade concat with MIXED per-cut transitions (fade + fadeblack) → duration shrinks
    by (n-1)*d, has video
  - ducked audio mix builds with no music file (silent bed) and no voiceover
  - final mux has both a video and an audio stream

Runs in a couple of seconds, so it's cheap to run in CI (needs ffmpeg). Exits non-zero
on any failure. This is the integration counterpart to validate_shots.py's static checks.

Usage:  python smoke_test.py
"""

import sys
import tempfile
from pathlib import Path

import assemble
import config
import util

D = 0.5  # dissolve seconds for the xfade leg


def approx(a, b, tol=0.25):
    return abs(a - b) <= tol


def streams(path):
    """Set of codec types present (e.g. {'video', 'audio'})."""
    import subprocess
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True,
    ).stdout.split()
    return set(out)


def main():
    shots = [
        {"id": "s1", "scene": "open", "start": 0, "dur": 2, "type": "t2v",
         "prompt": "a", "ref_photo": "", "treatment": "normal", "transition": "",
         "vo_text": "First line.", "vo_voice": config.DEFAULT_VOICE, "caption_es": ""},
        {"id": "s2", "scene": "mid", "start": 2, "dur": 2, "type": "t2v",
         "prompt": "b", "ref_photo": "", "treatment": "grayscale", "transition": "fadeblack",
         "vo_text": "", "vo_voice": config.DEFAULT_VOICE, "caption_es": ""},
        {"id": "s3", "scene": "end", "start": 4, "dur": 2, "type": "t2v",
         "prompt": "c", "ref_photo": "", "treatment": "color_bloom", "transition": "dissolve",
         "vo_text": "Last line.", "vo_voice": config.DEFAULT_VOICE, "caption_es": ""},
    ]
    durs = [float(s["dur"]) for s in shots]
    total = sum(durs)

    # slates write helper textfiles next to the segment stub; keep them in the temp dir
    config.SEG_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        checks = []

        # 1) slate segments
        segs = []
        for s in shots:
            p = tmp / f"{s['id']}.mp4"
            assemble.build_slate_segment(s, p)
            segs.append(p)
        checks.append(("slates build + non-empty", all(p.stat().st_size > 0 for p in segs)))

        # 2) hard-cut concat
        hard = tmp / "hard.mp4"
        assemble.concat_segments(segs, hard)
        checks.append(("hard concat duration == sum",
                       approx(util.ffprobe_duration(hard) or 0, total)))
        checks.append(("hard concat has video", "video" in streams(hard)))

        # 3) xfade concat with MIXED per-cut transitions
        transitions = [shots[1]["transition"], shots[2]["transition"]]  # fadeblack, dissolve
        _, eff_starts, xtotal = assemble.xfade_plan(durs, D)
        xf = tmp / "xfade.mp4"
        assemble.concat_with_xfade(segs, durs, D, xf, transitions)
        checks.append((f"xfade duration == sum-(n-1)*d ({xtotal:g}s)",
                       approx(util.ffprobe_duration(xf) or 0, xtotal)))
        checks.append(("xfade has video", "video" in streams(xf)))

        # 4) audio mix (no music file, no VO → silent bed), on the dissolved timeline
        start_of = {s["id"]: es for s, es in zip(shots, eff_starts)}
        aud = tmp / "audio.m4a"
        assemble.build_audio(shots, xtotal, aud, start_of=start_of)
        checks.append(("audio mix has audio", "audio" in streams(aud)))

        # 5) final mux has both streams
        final = tmp / "final.mp4"
        assemble.mux(xf, aud, xtotal, final)
        checks.append(("final mux has video+audio", {"video", "audio"} <= streams(final)))

    ok = True
    for name, passed in checks:
        print(f"  [{'PASS' if passed else 'FAIL'}] {name}")
        ok = ok and passed
    print("-" * 50)
    print("smoke test:", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
