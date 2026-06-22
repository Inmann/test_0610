#!/usr/bin/env python3
"""
assemble.py — build the 5-minute "Act I" film from hand-made clips + free tools.

Pipeline (all ffmpeg, no paid services):
  1. Per shot: load clips_raw/{id}.mp4 (or a labeled placeholder slate if missing).
  2. Trim/pad to exactly `dur`; short clips FREEZE the last frame (no stretching).
  3. Scale to 1080p 16:9 with a blurred-fill background for odd ratios.
  4. Apply `treatment`: grayscale | color_bloom (sat 0->1) | normal.
  5. Burn a lower-third caption (vo_text) with a drop shadow; optional Spanish subtitle.
  6. Concatenate all shots in `start` order.
  7. Mix audio: each shot's VO at its `start`; music looped under it, ducked to ~25%.
  8. Export H.264 1080p to output/act1.mp4.

Segments are cached (cache/seg) so generation is resumable: re-run after adding a
clip and only that shot is rebuilt.

Usage:
    python assemble.py            # build the film from whatever clips exist
    python assemble.py --dry-run  # build the full cut with placeholder slates only
    python assemble.py --force    # rebuild every segment (ignore cache)
    python assemble.py --keep-temp
"""

import argparse
import sys

import config
import util


# ---------------------------------------------------------------------------
# Filter fragments
# ---------------------------------------------------------------------------
def base_chain(num_parts, label_out="base"):
    """
    Build a graph turning input streams [0:v]..[k:v] into one full-frame [base]
    stream (1080p 16:9, blurred-fill background, sharp clip centered). Multiple
    parts ({id}_a,{id}_b,...) are normalized then concatenated in order.
    """
    W, H, fps = config.WIDTH, config.HEIGHT, config.FPS
    parts = []
    for i in range(num_parts):
        parts.append(
            f"[{i}:v]fps={fps},setsar=1,split=2[p{i}bg][p{i}fg];"
            f"[p{i}bg]scale={W}:{H}:force_original_aspect_ratio=increase,"
            f"crop={W}:{H},gblur=sigma={config.BLUR_SIGMA}[p{i}bgb];"
            f"[p{i}fg]scale={W}:{H}:force_original_aspect_ratio=decrease[p{i}fgs];"
            f"[p{i}bgb][p{i}fgs]overlay=(W-w)/2:(H-h)/2[p{i}]"
        )
    if num_parts == 1:
        # rename [p0] -> [base]
        parts[-1] = parts[-1].replace("[p0]", f"[{label_out}]")
        return ";".join(parts)
    concat_inputs = "".join(f"[p{i}]" for i in range(num_parts))
    parts.append(f"{concat_inputs}concat=n={num_parts}:v=1:a=0[{label_out}]")
    return ";".join(parts)


def fit_to_duration(dur, label_in="base", label_out="timed"):
    """Freeze the last frame to reach `dur`, then trim to exactly `dur`."""
    return (
        f"[{label_in}]tpad=stop_mode=clone:stop_duration={dur},"
        f"trim=0:{dur},setpts=PTS-STARTPTS[{label_out}]"
    )


def treatment_chain(treatment, dur, label_in="timed", label_out="treated"):
    """grayscale | color_bloom (saturation ramps 0->1 over the shot) | normal."""
    t = (treatment or "normal").lower()
    if t == "grayscale":
        return f"[{label_in}]hue=s=0[{label_out}]"
    if t == "color_bloom":
        # per-frame saturation from 0 at t=0 to 1 at t=dur (comma escaped for the parser)
        return f"[{label_in}]hue=s=min(1\\,t/{dur})[{label_out}]"
    # normal — pass through
    return f"[{label_in}]null[{label_out}]"


def _drawtext(textfile, fontfile, fontsize, color, y_expr):
    box = ""
    if config.CAPTION_BOX:
        box = (f":box=1:boxcolor={config.CAPTION_BOX_COLOR}"
               f":boxborderw={config.CAPTION_BOX_BORDER}")
    return (
        f"drawtext=fontfile='{fontfile}':textfile='{textfile}':expansion=none"
        f":fontsize={fontsize}:fontcolor={color}"
        f":x=(w-text_w)/2:y={y_expr}"
        f":shadowcolor={config.SHADOW_COLOR}:shadowx={config.SHADOW_X}:shadowy={config.SHADOW_Y}"
        f":line_spacing=6{box}"
    )


def caption_chain(shot, seg_stub, label_in="treated", label_out="capped"):
    """
    Burn the English lower-third (vo_text) and, if present, a Spanish subtitle
    (caption_es) just beneath it. Returns (filter_or_None, [textfiles_written]).
    Anchored to the bottom using each line's own text_h so wrapping never clips.
    """
    written = []
    draws = []

    en = util.wrap_caption(shot.get("vo_text", ""))
    if en:
        f_en = f"{seg_stub}_en.txt"
        util.write_textfile(en, f_en)
        written.append(f_en)
        draws.append(_drawtext(f_en, config.FONT_FILE, config.CAPTION_SIZE,
                               config.CAPTION_COLOR, "h-text_h-110"))

    es = util.wrap_caption(shot.get("caption_es", ""))
    if es:
        f_es = f"{seg_stub}_es.txt"
        util.write_textfile(es, f_es)
        written.append(f_es)
        draws.append(_drawtext(f_es, config.FONT_FILE_ES, config.CAPTION_ES_SIZE,
                               config.CAPTION_ES_COLOR, "h-text_h-55"))

    if not draws:
        return None, written
    chain = f"[{label_in}]" + ",".join(draws) + f"[{label_out}]"
    return chain, written


# ---------------------------------------------------------------------------
# Segment builders
# ---------------------------------------------------------------------------
def _encode_args(out_path):
    return [
        "-c:v", "libx264", "-preset", config.X264_PRESET, "-crf", str(config.X264_CRF),
        "-pix_fmt", config.PIX_FMT, "-r", str(config.FPS), "-an",
        "-movflags", "+faststart", str(out_path),
    ]


def build_clip_segment(shot, out_path):
    """Normalize a real clip (one or more parts) into a cached segment."""
    parts = util.clip_inputs(shot)
    dur = float(shot["dur"])
    seg_stub = str(config.SEG_CACHE_DIR / shot["id"])

    cap_chain, _ = caption_chain(shot, seg_stub)
    graph = base_chain(len(parts))
    graph += ";" + fit_to_duration(dur)
    graph += ";" + treatment_chain(shot.get("treatment"), dur)
    if cap_chain:
        graph += ";" + cap_chain
        final = "capped"
    else:
        final = "treated"
    graph += f";[{final}]format={config.PIX_FMT}[outv]"

    cmd = ["ffmpeg", "-y"]
    for p in parts:
        cmd += ["-i", str(p)]
    cmd += ["-filter_complex", graph, "-map", "[outv]"]
    cmd += _encode_args(out_path)
    util.run(cmd)


def build_slate_segment(shot, out_path):
    """A labeled placeholder slate for a missing clip (also used in --dry-run)."""
    dur = float(shot["dur"])
    seg_stub = str(config.SEG_CACHE_DIR / shot["id"])
    W, H = config.WIDTH, config.HEIGHT

    # Slate info block (centered): id / scene / type / status / prompt preview
    prompt_preview = util.wrap_caption(shot.get("prompt", ""), width=46)
    info_lines = [
        f"[{shot['id']}]   scene: {shot.get('scene','')}",
        f"type: {shot.get('type','?')}    treatment: {shot.get('treatment','normal')}",
        f"dur: {dur:g}s    start: {float(shot['start']):g}s",
        "— CLIP MISSING · PLACEHOLDER —",
    ]
    if prompt_preview:
        info_lines += ["", prompt_preview]
    info_txt = f"{seg_stub}_slate.txt"
    util.write_textfile("\n".join(info_lines), info_txt)

    slate_draw = (
        f"drawtext=fontfile='{config.FONT_FILE}':textfile='{info_txt}':expansion=none"
        f":fontsize=40:fontcolor={config.SLATE_FG}"
        f":x=(w-text_w)/2:y=(h-text_h)/2-60:line_spacing=10"
        f":shadowcolor=black@0.8:shadowx=2:shadowy=2"
    )

    cap_chain, _ = caption_chain(shot, seg_stub, label_in="slate", label_out="capped")
    graph = (
        f"color=c={config.SLATE_BG}:s={W}x{H}:r={config.FPS}:d={dur},"
        f"{slate_draw}[slate]"
    )
    if cap_chain:
        graph += ";" + cap_chain
        final = "capped"
    else:
        final = "slate"
    graph += f";[{final}]format={config.PIX_FMT}[outv]"

    cmd = ["ffmpeg", "-y", "-f", "lavfi", "-i",
           f"color=c={config.SLATE_BG}:s={W}x{H}:r={config.FPS}:d={dur}",
           "-filter_complex", graph, "-map", "[outv]"]
    cmd += _encode_args(out_path)
    util.run(cmd)


def segment_for(shot, dry_run, force):
    """
    Resolve/build the cached segment for a shot and return its path.
    Real segments: cache/seg/{id}.mp4. Slates: cache/seg/{id}.slate.mp4.
    """
    sid = shot["id"]
    real = config.SEG_CACHE_DIR / f"{sid}.mp4"
    slate = config.SEG_CACHE_DIR / f"{sid}.slate.mp4"
    parts = util.clip_inputs(shot)

    if dry_run or not parts:
        if force or not slate.exists():
            build_slate_segment(shot, slate)
        return slate, ("slate" if parts else "missing")

    # real clip present — rebuild if forced or if the clip is newer than the segment
    newest_src = max(p.stat().st_mtime for p in parts)
    stale = (not real.exists()) or (real.stat().st_mtime < newest_src)
    if force or stale:
        build_clip_segment(shot, real)
    return real, "clip"


# ---------------------------------------------------------------------------
# Concatenation
# ---------------------------------------------------------------------------
def concat_segments(seg_paths, out_path):
    """Stitch identically-encoded segments with the concat demuxer (stream copy)."""
    listfile = config.CACHE_DIR / "concat.txt"
    listfile.write_text(
        "".join(f"file '{p.resolve()}'\n" for p in seg_paths), encoding="utf-8"
    )
    util.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
        "-c", "copy", "-movflags", "+faststart", str(out_path),
    ])


def xfade_plan(durs, d):
    """
    Given each segment's duration, return (offsets, eff_starts, total) for an xfade
    chain that dissolves consecutive shots by `d` seconds.
      - offsets[k]    : xfade `offset` that brings in segment k+1
      - eff_starts[i] : where shot i begins in the dissolved timeline (for audio sync)
      - total         : dissolved runtime = sum(durs) - (n-1)*d
    """
    n = len(durs)
    offsets, eff_starts = [], [0.0]
    acc = durs[0]                       # running length of the chain built so far
    for k in range(1, n):
        offsets.append(acc - d)         # transition starts d before the chain end
        eff_starts.append(eff_starts[-1] + durs[k - 1] - d)
        acc += durs[k] - d
    return offsets, eff_starts, acc


def concat_with_xfade(seg_paths, durs, d, out_path, transition):
    """Re-encode segments into one track joined by cross-dissolves (xfade)."""
    offsets, _, _ = xfade_plan(durs, d)
    cmd = ["ffmpeg", "-y"]
    for p in seg_paths:
        cmd += ["-i", str(p)]

    filters, prev = [], "[0:v]"
    for k in range(1, len(seg_paths)):
        out = f"[x{k}]" if k < len(seg_paths) - 1 else "[vx]"
        filters.append(
            f"{prev}[{k}:v]xfade=transition={transition}:duration={d}:"
            f"offset={offsets[k - 1]:.3f}{out}"
        )
        prev = out
    filters.append(f"{prev}format={config.PIX_FMT}[vout]")

    cmd += ["-filter_complex", ";".join(filters), "-map", "[vout]"]
    cmd += ["-c:v", "libx264", "-preset", config.X264_PRESET, "-crf", str(config.X264_CRF),
            "-pix_fmt", config.PIX_FMT, "-r", str(config.FPS), "-an",
            "-movflags", "+faststart", str(out_path)]
    util.run(cmd)


# ---------------------------------------------------------------------------
# Audio
# ---------------------------------------------------------------------------
def duck_volume_expr(windows):
    """
    Music volume as a per-frame expression: MUSIC_BASE_VOL normally, dropping to
    DUCK_LEVEL during VO windows, with a short DUCK_RAMP fade on each edge.
    """
    base, duck, r = config.MUSIC_BASE_VOL, config.DUCK_LEVEL, config.DUCK_RAMP
    if not windows:
        return str(base)
    terms = []
    for s, e in windows:
        # trapezoid in [0,1]: ramps up over r at the start, down over r at the end
        terms.append(f"max(0,min(1,min((t-{s:.3f})/{r},({e:.3f}-t)/{r})))")
    duckamt = "min(1," + "+".join(terms) + ")" if len(terms) > 1 else terms[0]
    # volume = base - (base-duck)*duckamt
    return f"{base}-({base - duck})*({duckamt})"


def build_audio(shots, total, out_path, start_of=None):
    """
    Lay each VO at its start over looped, ducked music. Returns out_path or None.
    `start_of` maps shot id -> start seconds; defaults to each shot's own `start`
    (overridden with the dissolved-timeline starts when --xfade is used).
    """
    def shot_start(s):
        return float(start_of[s["id"]]) if start_of else float(s["start"])

    vo_items = []  # (input_index, shot, vo_path, start, length)
    inputs = ["-stream_loop", "-1", "-i", str(config.MUSIC_PATH)]  # input 0 = music
    idx = 1
    for shot in shots:
        vo = util.vo_audio_for(shot)
        if not vo:
            continue
        length = util.ffprobe_duration(vo) or 0.0
        inputs += ["-i", str(vo)]
        vo_items.append((idx, shot, vo, shot_start(shot), length))
        idx += 1

    if not config.MUSIC_PATH.exists():
        print(f"  [warn] music not found at {config.MUSIC_PATH} — film will have VO only "
              f"(or silence).")

    windows = []
    for _, _, _, start, length in vo_items:
        end = min(start + length, total)
        if length > 0:
            windows.append((start, end))

    chains = []
    sr = "aformat=sample_rates=44100:channel_layouts=stereo"

    # music (input 0): ducked + trimmed to total. If no music file, synth silence.
    if config.MUSIC_PATH.exists():
        chains.append(
            f"[0:a]{sr},volume='{duck_volume_expr(windows)}':eval=frame,"
            f"atrim=0:{total},asetpts=PTS-STARTPTS[music]"
        )
    else:
        # silent bed so amix still works
        chains.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{total}[music]")

    # each VO delayed to its start
    vo_labels = []
    for n, (i, shot, vo, start, length) in enumerate(vo_items):
        ms = int(round(start * 1000))
        lbl = f"vo{n}"
        chains.append(f"[{i}:a]{sr},adelay={ms}:all=1[{lbl}]")
        vo_labels.append(lbl)

    if vo_labels:
        if len(vo_labels) == 1:
            chains.append(f"[{vo_labels[0]}]volume={config.VO_VOL}[voall]")
        else:
            mix_in = "".join(f"[{l}]" for l in vo_labels)
            chains.append(
                f"{mix_in}amix=inputs={len(vo_labels)}:normalize=0:dropout_transition=0,"
                f"volume={config.VO_VOL}[voall]"
            )
        chains.append(
            f"[music][voall]amix=inputs=2:normalize=0:dropout_transition=0,"
            f"atrim=0:{total},alimiter=limit=0.97[aout]"
        )
    else:
        chains.append(f"[music]atrim=0:{total}[aout]")

    graph = ";".join(chains)
    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", graph, "-map", "[aout]",
        "-c:a", "aac", "-b:a", "192k", str(out_path),
    ]
    util.run(cmd)
    return out_path


def mux(video, audio, total, out_path):
    util.run([
        "ffmpeg", "-y", "-i", str(video), "-i", str(audio),
        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy",
        "-t", f"{total}", "-movflags", "+faststart", str(out_path),
    ])


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Assemble the Act I film (free tools only).")
    ap.add_argument("--dry-run", action="store_true",
                    help="build the full cut using placeholder slates for every shot")
    ap.add_argument("--force", action="store_true",
                    help="rebuild every segment, ignoring the cache")
    ap.add_argument("--xfade", nargs="?", type=float, const=config.XFADE_DUR, default=None,
                    metavar="SECONDS",
                    help=f"cross-dissolve between shots (default {config.XFADE_DUR}s); "
                         f"re-encodes video and shortens total by (shots-1)*SECONDS")
    ap.add_argument("--keep-temp", action="store_true", help="keep intermediate files")
    args = ap.parse_args()

    for d in (config.VO_CACHE_DIR, config.SEG_CACHE_DIR, config.OUTPUT_DIR):
        d.mkdir(parents=True, exist_ok=True)

    shots = util.load_shots()
    total = util.total_runtime(shots)
    mode = "DRY RUN (placeholders)" if args.dry_run else "FULL BUILD"
    print(f"=== Act I assembly · {mode} ===")
    print(f"shots: {len(shots)}   runtime: {total:.1f}s ({total/60:.2f} min)\n")

    seg_paths, missing = [], []
    for shot in shots:
        path, status = segment_for(shot, args.dry_run, args.force)
        seg_paths.append(path)
        flag = {"clip": "✓ clip ", "slate": "▢ slate", "missing": "… MISSING"}[status]
        if status == "missing":
            missing.append(shot["id"])
        print(f"  {flag}  {shot['id']:>5}  start={float(shot['start']):>6.1f}s  "
              f"dur={float(shot['dur']):>4.1f}s  {shot.get('treatment','normal'):<11} "
              f"{shot.get('scene','')}")

    # --xfade: dissolve between shots. Re-encodes the video, shifts the audio
    # timeline to match, and shortens the total runtime by (shots-1)*d.
    start_of, video_total = None, total
    d = args.xfade
    if d:
        durs = [float(s["dur"]) for s in shots]
        too_short = [s["id"] for s, du in zip(shots, durs) if du <= 2 * d]
        if too_short:
            d = min(min(durs) / 2 - 0.01, d)
            print(f"  [warn] --xfade reduced to {d:.2f}s so it fits the shortest shot(s): "
                  f"{', '.join(too_short)}")
        _, eff_starts, video_total = xfade_plan(durs, d)
        start_of = {s["id"]: es for s, es in zip(shots, eff_starts)}
        print(f"  cross-dissolve {d:.2f}s × {len(shots) - 1} cuts → "
              f"runtime {video_total:.1f}s (was {total:.1f}s)")

    print("\n[1/3] building video track …")
    video_concat = config.CACHE_DIR / "video_concat.mp4"
    if d:
        concat_with_xfade(seg_paths, [float(s["dur"]) for s in shots], d,
                          video_concat, config.XFADE_TRANSITION)
    else:
        concat_segments(seg_paths, video_concat)

    print("[2/3] building ducked audio mix …")
    audio_mix = config.CACHE_DIR / "audio_mix.m4a"
    build_audio(shots, video_total, audio_mix, start_of=start_of)

    print("[3/3] muxing final film …")
    mux(video_concat, audio_mix, video_total, config.OUTPUT_FILE)

    if not args.keep_temp and not args.dry_run:
        for f in (video_concat, audio_mix, config.CACHE_DIR / "concat.txt"):
            f.unlink(missing_ok=True)

    print(f"\n✅ wrote {config.OUTPUT_FILE}  ({video_total:.1f}s)")
    if missing and not args.dry_run:
        print(f"\n⚠  {len(missing)} shot(s) still need clips (placeholder slates used): "
              f"{', '.join(missing)}")
        print("   Generate them by hand (see README), drop into clips_raw/, and re-run.")


if __name__ == "__main__":
    main()
