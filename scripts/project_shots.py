#!/usr/bin/env python3
"""Retake the screenshot of every project in data/projects.json.

Uses headless Chrome (whatever is installed: Google Chrome on a Mac, google-chrome or
chromium on Linux / GitHub Actions). Each project's "image" field says where to save it.
A failed capture keeps the old screenshot.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANDIDATES = [
    os.environ.get("CHROME", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
]


def find_chrome():
    for c in CANDIDATES:
        if c and (os.path.exists(c) or shutil.which(c)):
            return c
    sys.exit("No Chrome found. Set CHROME=/path/to/chrome.")


def main():
    chrome = find_chrome()
    projects = json.load(open(os.path.join(ROOT, "data", "projects.json")))["projects"]
    failed = 0
    for p in projects:
        if not p.get("image"):
            continue
        out = os.path.join(ROOT, p["image"])
        with tempfile.TemporaryDirectory() as tmp:
            shot = os.path.join(tmp, "shot.png")
            cmd = [chrome, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                   "--window-size=1440,900", "--virtual-time-budget=9000",
                   f"--screenshot={shot}", p["url"]]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
            if os.path.exists(shot) and os.path.getsize(shot) > 10_000:
                os.makedirs(os.path.dirname(out), exist_ok=True)
                shutil.move(shot, out)
                print(f"ok      {p['name']} -> {p['image']}")
            else:
                failed += 1
                print(f"FAILED  {p['name']} (kept the old screenshot)", file=sys.stderr)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
