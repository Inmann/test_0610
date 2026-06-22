#!/usr/bin/env python3
"""
qc.py — quality-check the generated clips before you assemble the film.

Free web-tool clips sometimes come back broken: a near-empty render, a black frame,
or a single static frame. This scans clips_raw/{id}.mp4 for each shot and flags:

  - missing    : no clip generated yet
  - corrupt    : unreadable / ~zero duration
  - too-short  : shorter than --min-dur seconds
  - black      : more than --black fraction of the clip is black
  - static     : more than --freeze fraction of the clip is a frozen frame

With --quarantine, flagged clips are MOVED to clips_raw/_rejected/ so the resumable
generators (webgen_*.py) will re-make them on the next run — re-roll the bad shots
without touching the good ones.

Usage:
    python qc.py                      # report only
    python qc.py --only t5 t14
    python qc.py --quarantine         # move flagged clips aside for regeneration
    python qc.py --json cache/qc.json # also write a machine-readable report
    python qc.py --min-dur 2 --black 0.4 --freeze 0.9
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import config
import util

# Defaults (override on the CLI)
MIN_DUR = 1.0      # seconds; shorter => "too-short"
BLACK_MAX = 0.5    # >50% black => "black"
FREEZE_MAX = 0.95  # >95% frozen => "static"

_BLACK_DUR = re.compile(r"black_duration:\s*([\d.]+)")
_FREEZE_START = re.compile(r"freeze_start:\s*([\d.]+)")
_FREEZE_END = re.compile(r"freeze_end:\s*([\d.]+)")


def _ffmpeg_stderr(path, vf):
    """Run a detection filter over a clip and return ffmpeg's stderr text."""
    return subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-vf", vf, "-map", "0:v", "-an", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr


def black_ratio(path, total):
    if total <= 0:
        return 0.0
    err = _ffmpeg_stderr(path, "blackdetect=d=0.05:pic_th=0.98")
    black = sum(float(x) for x in _BLACK_DUR.findall(err))
    return min(black / total, 1.0)


def freeze_ratio(path, total):
    if total <= 0:
        return 0.0
    err = _ffmpeg_stderr(path, "freezedetect=n=0.003:d=0.3")
    starts = [float(x) for x in _FREEZE_START.findall(err)]
    ends = [float(x) for x in _FREEZE_END.findall(err)]
    frozen = 0.0
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else total  # unterminated freeze runs to EOF
        frozen += max(0.0, e - s)
    return min(frozen / total, 1.0)


def check_shot(shot, args):
    """Return a result dict for one shot."""
    sid = shot["id"]
    files = util.clip_inputs(shot)
    res = {"id": sid, "files": [str(p) for p in files], "flags": [], "status": "ok"}

    if not files:
        res["status"] = "missing"
        return res

    total = sum(util.ffprobe_duration(p) or 0.0 for p in files)
    res["duration"] = round(total, 2)
    if total <= 0.05:
        res["status"], res["flags"] = "fail", ["corrupt"]
        return res

    if total < args.min_dur:
        res["flags"].append("too-short")
    # aggregate detection across parts (worst case)
    res["black"] = round(max(black_ratio(p, util.ffprobe_duration(p) or 0.0) for p in files), 2)
    res["static"] = round(max(freeze_ratio(p, util.ffprobe_duration(p) or 0.0) for p in files), 2)
    if res["black"] > args.black:
        res["flags"].append("black")
    if res["static"] > args.freeze:
        res["flags"].append("static")

    res["status"] = "fail" if res["flags"] else "ok"
    return res


def quarantine(shot):
    """Move a shot's clip files to clips_raw/_rejected/ so they get regenerated."""
    dest = config.CLIPS_DIR / "_rejected"
    dest.mkdir(parents=True, exist_ok=True)
    moved = []
    for p in util.clip_inputs(shot):
        target = dest / p.name
        Path(p).replace(target)
        moved.append(target.name)
    return moved


def main():
    ap = argparse.ArgumentParser(description="Quality-check generated clips.")
    ap.add_argument("--only", nargs="*", help="restrict to these shot ids")
    ap.add_argument("--quarantine", action="store_true",
                    help="move flagged clips to clips_raw/_rejected/ for regeneration")
    ap.add_argument("--json", metavar="PATH", help="also write the report as JSON")
    ap.add_argument("--min-dur", type=float, default=MIN_DUR)
    ap.add_argument("--black", type=float, default=BLACK_MAX)
    ap.add_argument("--freeze", type=float, default=FREEZE_MAX)
    args = ap.parse_args()

    shots = util.load_shots()
    only = set(args.only) if args.only else None

    results, failed, missing = [], [], []
    print(f"{'shot':>5}  {'status':<8} {'dur':>6} {'black':>6} {'static':>6}  flags")
    print("-" * 60)
    for shot in shots:
        if only and shot["id"] not in only:
            continue
        r = check_shot(shot, args)
        results.append(r)
        dur = f"{r.get('duration', 0):.1f}s" if "duration" in r else "—"
        blk = f"{r.get('black', 0):.2f}" if "black" in r else "—"
        stc = f"{r.get('static', 0):.2f}" if "static" in r else "—"
        mark = {"ok": "✓", "fail": "✗", "missing": "…"}[r["status"]]
        print(f"{r['id']:>5}  {mark} {r['status']:<6} {dur:>6} {blk:>6} {stc:>6}  {','.join(r['flags'])}")
        if r["status"] == "fail":
            failed.append(shot)
        elif r["status"] == "missing":
            missing.append(r["id"])

    print("-" * 60)
    print(f"ok={sum(1 for r in results if r['status']=='ok')}  "
          f"fail={len(failed)}  missing={len(missing)}")

    if args.quarantine and failed:
        print("\nQuarantining flagged clips → clips_raw/_rejected/ :")
        for shot in failed:
            moved = quarantine(shot)
            print(f"  ✗ {shot['id']}: moved {', '.join(moved)}")
        print("Re-run the generator (webgen_*.py) to regenerate them.")
    elif failed:
        print(f"\nFlagged: {', '.join(s['id'] for s in failed)}  "
              f"(re-run with --quarantine to move them aside for regeneration)")

    if args.json:
        Path(args.json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json).write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"\nwrote {args.json}")

    # non-zero exit if anything needs attention (handy in scripts)
    sys.exit(1 if (failed or missing) else 0)


if __name__ == "__main__":
    main()
