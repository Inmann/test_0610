#!/usr/bin/env python3
"""
tts.py — synthesize voiceover lines with edge-tts (Microsoft Edge TTS, FREE, no API key).

For each shot that has `vo_text` and NO own recording (vo/{id}.wav), synthesize the
line using the voice mapped from `vo_voice` and cache it to cache/vo/{id}.mp3.

Resumable by design: skips anything already cached or already recorded by hand.

Usage:
    python tts.py                 # synthesize all missing voiceover lines
    python tts.py --force         # re-synthesize even if cached
    python tts.py --only t5 t12   # only these shot ids
    python tts.py --voices        # print available edge-tts voices and exit
    python tts.py --voices erika  # filter the voice list (substring match)
"""

import argparse
import asyncio
import os
import ssl
import sys

import config
import util

try:
    import edge_tts
except ImportError:
    sys.exit("[fatal] edge-tts not installed. Run:  pip install edge-tts")


def _apply_ca_override():
    """
    edge-tts pins its TLS trust store to certifi only. Behind a corporate proxy
    or TLS-inspecting gateway that breaks. If SSL_CERT_FILE (the standard env var)
    points to a CA bundle, build the SSL context from it instead. No-op in normal
    environments where SSL_CERT_FILE is unset.
    """
    ca = os.environ.get("SSL_CERT_FILE")
    if not ca or not os.path.isfile(ca):
        return
    try:
        ctx = ssl.create_default_context(cafile=ca)
        from edge_tts import communicate as _c, voices as _v
        _c._SSL_CTX = ctx
        _v._SSL_CTX = ctx
        print(f"[tls] using CA bundle from SSL_CERT_FILE: {ca}")
    except Exception as e:  # never let a TLS tweak crash synthesis
        print(f"[tls] CA override skipped: {e}")


def resolve_voice(vo_voice):
    """Map a shot's vo_voice ('henry'/'erika'/...) to a real edge-tts voice id."""
    if not vo_voice:
        return config.VOICES[config.DEFAULT_VOICE]
    # allow either a friendly name from config.VOICES or a raw edge-tts id
    if vo_voice in config.VOICES:
        return config.VOICES[vo_voice]
    if "-" in vo_voice and "Neural" in vo_voice:
        return vo_voice  # looks like a raw edge-tts id, pass through
    print(f"  [warn] unknown vo_voice '{vo_voice}', falling back to {config.DEFAULT_VOICE}")
    return config.VOICES[config.DEFAULT_VOICE]


async def synth_one(shot, force=False):
    sid = shot["id"]
    text = (shot.get("vo_text") or "").strip()
    if not text:
        return "no-vo"

    own = config.VO_OWN_DIR / f"{sid}.wav"
    if own.exists():
        return "own-recording"

    out = config.VO_CACHE_DIR / f"{sid}.mp3"
    if out.exists() and not force:
        return "cached"

    voice = resolve_voice(shot.get("vo_voice"))
    out.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(
        text, voice, rate=config.VOICE_RATE, volume=config.VOICE_VOLUME
    )
    tmp = out.with_suffix(".part")
    await communicate.save(str(tmp))
    tmp.replace(out)
    return f"synth[{voice}]"


async def synth_all(shots, force=False, only=None):
    counts = {}
    for shot in shots:
        if only and shot["id"] not in only:
            continue
        try:
            status = await synth_one(shot, force=force)
        except Exception as e:
            status = "ERROR"
            print(f"  [error] {shot['id']}: {e}")
        counts[status] = counts.get(status, 0) + 1
        if status.startswith("synth"):
            print(f"  ✓ {shot['id']:>5}  {status}")
    print("\nSummary:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))


async def list_voices(filter_str=None):
    voices = await edge_tts.list_voices()
    voices.sort(key=lambda v: (v["Locale"], v["ShortName"]))
    f = (filter_str or "").lower()
    shown = 0
    for v in voices:
        line = f"{v['ShortName']:<34} {v['Gender']:<7} {v['Locale']}"
        if not f or f in line.lower():
            print(line)
            shown += 1
    print(f"\n{shown} voices listed."
          + ("" if not f else f"  (filtered by '{filter_str}')"))


def main():
    ap = argparse.ArgumentParser(description="Synthesize voiceover with edge-tts (free).")
    ap.add_argument("--force", action="store_true", help="re-synthesize even if cached")
    ap.add_argument("--only", nargs="*", help="restrict to these shot ids")
    ap.add_argument("--voices", nargs="?", const="", default=None,
                    metavar="FILTER", help="list edge-tts voices (optional substring filter) and exit")
    args = ap.parse_args()
    _apply_ca_override()

    if args.voices is not None:
        asyncio.run(list_voices(args.voices))
        return

    shots = util.load_shots()
    only = set(args.only) if args.only else None
    print(f"edge-tts: synthesizing voiceover for {len(shots)} shots "
          f"(voices: {', '.join(f'{k}={v}' for k, v in config.VOICES.items())})\n")
    asyncio.run(synth_all(shots, force=args.force, only=only))


if __name__ == "__main__":
    main()
