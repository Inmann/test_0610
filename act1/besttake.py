#!/usr/bin/env python3
"""
besttake.py — A/B (or N-way) best-take selection for generated clips.

The web tools are non-deterministic: the same prompt can give a great take or a dud.
This ranks multiple candidate takes per shot and installs the best one as
clips_raw/{id}.mp4. Candidates live in clips_raw/_takes/{id}/*.mp4 — the generators
write them there when run with `--takes N` (e.g. `python webgen_veo.py --takes 2`).

Ranking reuses qc.measure_files()/score(): any valid take beats an invalid one
(too-short/corrupt/black/static), and among valid takes the cleanest + most dynamic
wins (least black, least frozen). It's the same yardstick as qc.py, so a clip that
wins here will also pass QC.

Usage:
    python besttake.py                 # pick the best installed take for every shot
    python besttake.py --only t5 t12
    python besttake.py --keep          # keep the losing takes in _takes/ (default: kept)
    python besttake.py --prune         # delete the losing takes after picking
"""

import argparse
import shutil
from pathlib import Path

import config
import qc
import util

TAKES_DIR = config.CLIPS_DIR / "_takes"


def take_dir(sid):
    return TAKES_DIR / sid


def candidates(sid):
    """All candidate take files for a shot, sorted by name."""
    d = take_dir(sid)
    return sorted(d.glob("*.mp4")) if d.exists() else []


def rank(cands):
    """Return [(score, metrics, path), ...] best first."""
    scored = []
    for c in cands:
        m = qc.measure_files([c])
        scored.append((qc.score(m), m, c))
    scored.sort(key=lambda x: (x[0], x[1]["duration"]), reverse=True)
    return scored


def pick_for_shot(shot, prune=False, verbose=True):
    """Install the best candidate take as clips_raw/{id}.mp4. Returns the dest or None."""
    sid = shot["id"]
    cands = candidates(sid)
    if not cands:
        if verbose:
            print(f"  {sid}: no takes in {take_dir(sid)} — skip")
        return None

    ranked = rank(cands)
    best_score, best_m, best = ranked[0]
    if best_score < 0:
        if verbose:
            print(f"  {sid}: all {len(cands)} takes invalid "
                  f"({','.join(best_m['flags']) or 'corrupt'}) — not installing")
        return None

    dest = config.CLIPS_DIR / f"{sid}.mp4"
    shutil.copy2(best, dest)
    if verbose:
        others = ", ".join(f"{p.name}={s:.2f}" for s, _, p in ranked[1:]) or "—"
        print(f"  {sid}: ✓ {best.name} (score {best_score:.2f}, "
              f"black {best_m['black']}, static {best_m['static']}, {best_m['duration']:.1f}s) "
              f"| beat: {others}")

    if prune:
        for _, _, p in ranked:
            if p != best:
                p.unlink(missing_ok=True)
    return dest


def main():
    ap = argparse.ArgumentParser(description="Pick the best of multiple generated takes per shot.")
    ap.add_argument("--only", nargs="*", help="restrict to these shot ids")
    ap.add_argument("--prune", action="store_true", help="delete losing takes after picking")
    ap.add_argument("--keep", action="store_true", help="keep losing takes (default)")
    args = ap.parse_args()

    shots = util.load_shots()
    only = set(args.only) if args.only else None

    print(f"Scanning {TAKES_DIR} for candidate takes …")
    picked = 0
    for shot in shots:
        if only and shot["id"] not in only:
            continue
        if candidates(shot["id"]):
            if pick_for_shot(shot, prune=args.prune):
                picked += 1
    print(f"\nInstalled best take for {picked} shot(s).")


if __name__ == "__main__":
    main()
