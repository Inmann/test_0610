"""
config.py — central knobs for the FREE ($0) "Act I" assembly pipeline.

Everything you might want to tweak lives here so the other scripts stay clean.
No API keys, no paid services: voiceover = edge-tts (free), everything else = ffmpeg.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths (all relative to this folder)
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent

SHOTS_JSON   = ROOT / "shots.json"        # single source of truth
CLIPS_DIR    = ROOT / "clips_raw"         # clips_raw/{id}.mp4 (+ optional {id}_a.mp4, {id}_b.mp4)
MUSIC_PATH   = ROOT / "assets" / "music" / "miss_misery.mp3"
VO_OWN_DIR   = ROOT / "vo"                # vo/{id}.wav  (my own recordings — win over TTS)

CACHE_DIR    = ROOT / "cache"
VO_CACHE_DIR = CACHE_DIR / "vo"           # cache/vo/{id}.mp3  (edge-tts output)
SEG_CACHE_DIR= CACHE_DIR / "seg"          # cache/seg/{id}.mp4 (normalized per-shot segments)
OUTPUT_DIR   = ROOT / "output"
OUTPUT_FILE  = OUTPUT_DIR / "act1.mp4"

# ---------------------------------------------------------------------------
# Voiceover — edge-tts (FREE, no API key)
# vo_voice in shots.json maps through this table to a real edge-tts voice id.
# Change the right-hand side to swap voices. List all voices: `python tts.py --voices`.
# ---------------------------------------------------------------------------
VOICES = {
    # henry  = warm, measured male
    "henry": "en-US-ChristopherNeural",
    # erika  = warm female. For an actual Spanish-accented read, use "es-ES-ElviraNeural".
    "erika": "en-US-AvaNeural",
}
DEFAULT_VOICE = "henry"   # used when a shot's vo_voice is unknown/empty

# Optional per-voice prosody (edge-tts accepts these). Leave as-is for natural reads.
VOICE_RATE   = "+0%"      # e.g. "-10%" for slower, more measured
VOICE_VOLUME = "+0%"

# ---------------------------------------------------------------------------
# Video format
# ---------------------------------------------------------------------------
WIDTH, HEIGHT = 1920, 1080        # 1080p 16:9
FPS = 30
PIX_FMT = "yuv420p"
X264_CRF = 18                     # visually lossless-ish; raise for smaller files
X264_PRESET = "medium"

# Blurred-fill background (for portrait / odd-ratio source clips)
BLUR_SIGMA = 24                   # gaussian blur strength on the background copy

# Optional cross-dissolve transitions between shots (assemble.py --xfade). OFF by
# default — the default build keeps hard cuts, the exact ~305s runtime, and the fast
# stream-copy concat. With --xfade the video is re-encoded; each transition overlaps
# neighbors by XFADE_DUR, so total shrinks by (shots-1)*XFADE_DUR and the audio
# timeline is shifted to match (A/V stay in sync).
XFADE_DUR = 0.5                   # seconds of dissolve at each cut
XFADE_TRANSITION = "fade"         # any ffmpeg xfade type: fade, dissolve, fadeblack, …

# ---------------------------------------------------------------------------
# Captions (lower-third, burned in, subtle drop shadow)
# ---------------------------------------------------------------------------
FONT_FILE     = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_FILE_ES  = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"  # italic for subtitle
CAPTION_SIZE      = 46
CAPTION_ES_SIZE   = 36
CAPTION_COLOR     = "white"
CAPTION_ES_COLOR  = "0xDDDDDD"
SHADOW_COLOR      = "black@0.85"
SHADOW_X, SHADOW_Y = 2, 2
CAPTION_BOX        = True          # subtle dark plate behind the text for legibility
CAPTION_BOX_COLOR  = "black@0.35"
CAPTION_BOX_BORDER = 18            # px padding around text inside the plate
CAPTION_Y          = HEIGHT - 170  # baseline of the English lower-third
CAPTION_ES_Y       = HEIGHT - 110  # Spanish subtitle sits just beneath
CAPTION_WRAP       = 52            # characters per line before wrapping

# ---------------------------------------------------------------------------
# Audio mix
# ---------------------------------------------------------------------------
MUSIC_BASE_VOL = 0.8      # music level when no VO is playing
DUCK_LEVEL     = 0.25     # music drops to ~25% under a VO line (the spec's target)
DUCK_RAMP      = 0.25     # seconds of fade in/out around each duck window (smooths the switch)
VO_VOL         = 1.0      # voiceover level

# ---------------------------------------------------------------------------
# Placeholder slate (used for missing clips and in --dry-run)
# ---------------------------------------------------------------------------
SLATE_BG     = "0x101820"
SLATE_FG     = "0x8FB4D6"
SLATE_ACCENT = "0xE0B341"

# Total runtime is derived from shots.json (max(start+dur)); ~305s by design.
