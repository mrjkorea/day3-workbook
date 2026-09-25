#!/usr/bin/env python3
"""Bake Day 3 word and sentence mp3s with locked Kokoro pair. No browser voice."""
import subprocess
import sys
from pathlib import Path

TTS = Path.home() / ".hermes/projects/shared-tts/mrj_tts.py"
ROOT = Path(__file__).resolve().parents[1]

CLIPS = [
    ("ba_u01", "male", "one", "one.mp3"),
    ("ba_u01", "male", "two", "two.mp3"),
    ("ba_u01", "male", "three", "three.mp3"),
    ("ba_u01", "male", "four", "four.mp3"),
    ("ba_u01", "male", "five", "five.mp3"),
    ("ba_u01", "male", "six", "six.mp3"),
    ("ba_u01", "male", "seven", "seven.mp3"),
    ("ba_u01", "male", "eight", "eight.mp3"),
    ("ba_u01", "male", "nine", "nine.mp3"),
    ("ba_u01", "male", "ten", "ten.mp3"),
    ("ba_u01", "female", "I have one mother.", "s01.mp3"),
    ("ba_u01", "female", "I have five brothers.", "s02.mp3"),
    ("ba_u01", "female", "I have six sisters.", "s03.mp3"),
    ("ba_u01", "female", "I can count to ten.", "s04.mp3"),
    ("ba_u01", "female", "One, two, three, four, five.", "s05.mp3"),
    ("body", "male", "head", "head.mp3"),
    ("body", "male", "eye", "eye.mp3"),
    ("body", "male", "ear", "ear.mp3"),
    ("body", "male", "nose", "nose.mp3"),
    ("body", "male", "mouth", "mouth.mp3"),
    ("body", "male", "shoulder", "shoulder.mp3"),
    ("body", "male", "arm", "arm.mp3"),
    ("body", "male", "hand", "hand.mp3"),
    ("body", "male", "leg", "leg.mp3"),
    ("body", "male", "foot", "foot.mp3"),
    ("body", "female", "This is my head.", "s01.mp3"),
    ("body", "female", "I have two eyes.", "s02.mp3"),
    ("body", "female", "Touch your nose.", "s03.mp3"),
    ("body", "female", "Raise your hand.", "s04.mp3"),
    ("body", "female", "This is my foot.", "s05.mp3"),
]


def main() -> int:
    ok = 0
    for folder, gender, text, name in CLIPS:
        out = ROOT / "audio" / folder / name
        wav = out.with_suffix(".wav")
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.exists() and out.stat().st_size > 800:
            print("skip", out.relative_to(ROOT), out.stat().st_size)
            ok += 1
            continue
        if wav.exists():
            wav.unlink()
        cmd = [
            sys.executable,
            str(TTS),
            "pair",
            "--text",
            text,
            "--gender",
            gender,
            "--out",
            str(wav),
            "--mp3",
        ]
        print("bake", folder, name)
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not out.exists() or out.stat().st_size < 400:
            print("FAIL", name, r.returncode, r.stderr[-400:], r.stdout[-200:])
            return 1
        print("ok", name, out.stat().st_size)
        ok += 1
    print("BAKE_OK", ok)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
