"""
util.py — shared helpers: load shots, find files, run ffmpeg/ffprobe, escape text.
Kept dependency-free (stdlib only) so tts.py and assemble.py can both import it.
"""

import json
import shlex
import subprocess
import sys
import textwrap
from pathlib import Path

import config


# ---------------------------------------------------------------------------
# Shots
# ---------------------------------------------------------------------------
REQUIRED_FIELDS = ("id", "start", "dur")


def load_shots():
    """Load shots.json, validate lightly, and return shots sorted by `start`."""
    if not config.SHOTS_JSON.exists():
        sys.exit(f"[fatal] {config.SHOTS_JSON} not found. Drop your shot list there first.")
    data = json.loads(config.SHOTS_JSON.read_text(encoding="utf-8"))
    # Accept either a bare list or {"shots": [...]}
    shots = data["shots"] if isinstance(data, dict) else data
    seen = set()
    for s in shots:
        for f in REQUIRED_FIELDS:
            if f not in s:
                sys.exit(f"[fatal] shot {s.get('id', '?')} is missing required field '{f}'")
        if s["id"] in seen:
            sys.exit(f"[fatal] duplicate shot id: {s['id']}")
        seen.add(s["id"])
        # normalize/default optional fields
        s.setdefault("scene", "")
        s.setdefault("type", "")
        s.setdefault("prompt", "")
        s.setdefault("ref_photo", "")
        s.setdefault("treatment", "normal")
        s.setdefault("vo_text", "")
        s.setdefault("vo_voice", config.DEFAULT_VOICE)
        s.setdefault("caption_es", "")
    return sorted(shots, key=lambda s: float(s["start"]))


def total_runtime(shots):
    """Film length in seconds = the furthest (start + dur)."""
    return max((float(s["start"]) + float(s["dur"])) for s in shots) if shots else 0.0


# ---------------------------------------------------------------------------
# Per-shot file resolution
# ---------------------------------------------------------------------------
def clip_inputs(shot):
    """
    Return the list of raw clip files for a shot, in order.
    Supports a single clips_raw/{id}.mp4 OR a two-part {id}_a.mp4 + {id}_b.mp4.
    Returns [] if nothing is present yet.
    """
    sid = shot["id"]
    single = config.CLIPS_DIR / f"{sid}.mp4"
    if single.exists():
        return [single]
    parts = []
    for suffix in ("_a", "_b", "_c", "_d"):
        p = config.CLIPS_DIR / f"{sid}{suffix}.mp4"
        if p.exists():
            parts.append(p)
    return parts


def vo_audio_for(shot):
    """
    Resolve the voiceover audio for a shot.
    Priority: my own recording (vo/{id}.wav) > edge-tts cache (cache/vo/{id}.mp3).
    Returns a Path or None.
    """
    sid = shot["id"]
    own = config.VO_OWN_DIR / f"{sid}.wav"
    if own.exists():
        return own
    cached = config.VO_CACHE_DIR / f"{sid}.mp3"
    if cached.exists():
        return cached
    return None


# ---------------------------------------------------------------------------
# ffmpeg / ffprobe
# ---------------------------------------------------------------------------
def run(cmd, quiet=True):
    """Run a command (list of args). Raise with stderr tail on failure."""
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-25:])
        raise RuntimeError(
            f"command failed ({proc.returncode}):\n  {' '.join(shlex.quote(c) for c in cmd)}\n--- stderr ---\n{tail}"
        )
    return proc


def ffprobe_duration(path):
    """Duration of a media file in seconds (float), or None if unknown."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        return float(out)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# drawtext text handling
# ---------------------------------------------------------------------------
def wrap_caption(text, width=None):
    """Word-wrap a caption to N chars/line so it fits the lower third."""
    width = width or config.CAPTION_WRAP
    text = " ".join(text.split())
    if not text:
        return ""
    return "\n".join(textwrap.wrap(text, width=width)) or text


def write_textfile(text, path):
    """Write caption text for drawtext's textfile= (avoids shell-escaping hell)."""
    Path(path).write_text(text, encoding="utf-8")
    return path
