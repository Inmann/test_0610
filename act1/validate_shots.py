#!/usr/bin/env python3
"""
validate_shots.py — sanity-check shots.json before you spend time generating/assembling.

Catches the mistakes that silently break the cut: missing/duplicate ids, bad field
values, a clip that can't be generated (no prompt / no ref_photo), and timeline
problems — overlaps, gaps, or a total runtime that drifts from the target.

Errors fail the run (exit 1). Warnings are advisory (exit 0) unless --strict.

Usage:
    python validate_shots.py                 # validate, print a report
    python validate_shots.py --expect 305    # also assert total runtime ≈ 305s
    python validate_shots.py --strict         # treat warnings as errors too
"""

import argparse
import sys

import config
import util

VALID_TYPES = {"t2v", "i2v"}
VALID_TREATMENTS = {"normal", "grayscale", "color_bloom"}
VALID_TOOLS = {"veo", "seedance", "luma"}
GAP_TOL = 0.05        # seconds; smaller gaps/overlaps are ignored (float noise)
TOTAL_TOL = 0.5       # seconds tolerance for --expect


def validate(shots, expect_total=None):
    """Return (errors, warnings) as lists of human-readable strings."""
    errors, warnings = [], []

    # --- per-shot field checks ---
    for s in shots:
        sid = s.get("id", "?")

        # numeric start/dur
        try:
            start, dur = float(s["start"]), float(s["dur"])
        except (TypeError, ValueError):
            errors.append(f"{sid}: start/dur must be numbers (got {s.get('start')!r}/{s.get('dur')!r})")
            continue
        if dur <= 0:
            errors.append(f"{sid}: dur must be > 0 (got {dur})")
        if start < 0:
            errors.append(f"{sid}: start must be >= 0 (got {start})")

        # type
        typ = (s.get("type") or "").strip()
        if typ not in VALID_TYPES:
            warnings.append(f"{sid}: type {typ!r} not in {sorted(VALID_TYPES)} (will need a clip by hand)")

        # treatment
        treat = (s.get("treatment") or "normal").strip()
        if treat not in VALID_TREATMENTS:
            errors.append(f"{sid}: treatment {treat!r} not in {sorted(VALID_TREATMENTS)}")

        # tool routing (optional)
        tool = (s.get("tool") or "").strip().lower()
        if tool and tool not in VALID_TOOLS:
            errors.append(f"{sid}: tool {tool!r} not in {sorted(VALID_TOOLS)}")

        # voice
        voice = (s.get("vo_voice") or "").strip()
        if voice and voice not in config.VOICES:
            warnings.append(f"{sid}: vo_voice {voice!r} unknown — will fall back to {config.DEFAULT_VOICE!r}")

        # generatability
        if not (s.get("prompt") or "").strip():
            (warnings if typ != "t2v" else errors).append(
                f"{sid}: empty prompt — a {typ or 'clip'} can't be auto-generated without one")
        if typ == "i2v" and not (s.get("ref_photo") or "").strip():
            warnings.append(f"{sid}: i2v shot has no ref_photo — Seedance needs a reference image")

    # --- timeline checks (shots come back sorted by start) ---
    prev_end, prev_id = 0.0, None
    for s in shots:
        try:
            start, dur = float(s["start"]), float(s["dur"])
        except (TypeError, ValueError):
            continue  # already reported above
        if prev_id is not None:
            if start < prev_end - GAP_TOL:
                errors.append(f"timeline: {s['id']} (start {start:g}) overlaps {prev_id} (ends {prev_end:g})")
            elif start > prev_end + GAP_TOL:
                warnings.append(f"timeline: gap of {start - prev_end:g}s between {prev_id} and {s['id']}")
        elif start > GAP_TOL:
            warnings.append(f"timeline: first shot {s['id']} starts at {start:g}s, not 0")
        prev_end, prev_id = start + dur, s["id"]

    # --- total runtime ---
    total = util.total_runtime(shots)
    if expect_total is not None and abs(total - expect_total) > TOTAL_TOL:
        errors.append(f"total runtime {total:g}s != expected {expect_total:g}s")

    return errors, warnings, total


def main():
    ap = argparse.ArgumentParser(description="Validate shots.json.")
    ap.add_argument("--expect", type=float, metavar="SECONDS",
                    help="assert the total runtime equals this (within 0.5s)")
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    args = ap.parse_args()

    shots = util.load_shots()  # already enforces id/start/dur presence + uniqueness
    errors, warnings, total = validate(shots, expect_total=args.expect)

    for w in warnings:
        print(f"  ⚠ warning: {w}")
    for e in errors:
        print(f"  ✗ error:   {e}")

    print("-" * 60)
    print(f"{len(shots)} shots · total runtime {total:g}s · "
          f"{len(errors)} error(s), {len(warnings)} warning(s)")

    fail = bool(errors) or (args.strict and bool(warnings))
    if not fail:
        print("✓ shots.json looks good.")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
