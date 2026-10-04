#!/usr/bin/env python3
"""Rebuild everything in data/ so the site never needs hand-editing.

  data/posts.json    from the public Substack archive (covers saved to assets/covers/)
  data/repos.json    from public GitHub repos tagged with the topic "on-my-site"
  data/prompts.json  from the header block of each file in prompts/

Runs locally or in the daily GitHub Action. Standard library only.
If a source can't be reached, its old file is kept, so the site never goes blank.
"""
import glob
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

SUBSTACK = "https://www.madhunagaraj.com"
GITHUB_USER = "madhusnagaraj"
REPO_TOPIC = "on-my-site"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
COVERS = os.path.join(ROOT, "assets", "covers")
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def get(url, accept="application/json"):
    headers = {"User-Agent": "madhusnagaraj.github.io refresh", "Accept": accept}
    token = os.environ.get("GITHUB_TOKEN")
    if token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read(), r.headers.get_content_type()


def write(name, payload):
    with open(os.path.join(DATA, name), "w") as f:
        json.dump(payload, f, indent=1, ensure_ascii=False)
        f.write("\n")


# ---------- Substack posts ----------

def is_own_cover(url):
    # Only art hosted on Substack; skips stock photos (e.g. Unsplash).
    return bool(url) and ("substackcdn.com" in url or "substack-post-media" in url)


def save_cover(slug, url):
    for ext in EXT.values():
        path = os.path.join(COVERS, slug + ext)
        if os.path.exists(path):
            return path
    data, ctype = get(url, accept="image/jpeg,image/png;q=0.9")
    path = os.path.join(COVERS, slug + EXT.get(ctype, ".jpg"))
    with open(path, "wb") as f:
        f.write(data)
    return path


def refresh_posts():
    archive, offset = [], 0
    while True:
        body, _ = get(f"{SUBSTACK}/api/v1/archive?sort=new&limit=50&offset={offset}")
        page = json.loads(body)
        if not page:
            break
        archive.extend(page)
        offset += len(page)
    posts = []
    for p in archive:
        if p.get("audience") not in (None, "everyone") or not p.get("post_date"):
            continue
        cover = None
        if is_own_cover(p.get("cover_image")):
            try:
                cover = os.path.relpath(save_cover(p["slug"], p["cover_image"]), ROOT)
            except Exception as e:  # keep the post, just without art
                print(f"cover failed for {p['slug']}: {e}", file=sys.stderr)
        posts.append({
            "title": p["title"].strip(),
            "date": p["post_date"][:10],
            "url": f"{SUBSTACK}/p/{p['slug']}",
            "cover": cover,
        })
    posts.sort(key=lambda x: x["date"], reverse=True)
    write("posts.json", {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "posts": posts,
    })
    return f"{len(posts)} posts ({sum(1 for x in posts if x['cover'])} with covers)"


# ---------- GitHub repos ----------

def refresh_repos():
    body, _ = get(f"https://api.github.com/users/{GITHUB_USER}/repos?per_page=100&sort=pushed")
    repos = [
        {
            "name": r["name"],
            "url": r["html_url"],
            "description": (r.get("description") or "").strip(),
            "essay": (r.get("homepage") or "").strip() or None,
        }
        for r in json.loads(body)
        if not r.get("fork") and not r.get("private") and REPO_TOPIC in (r.get("topics") or [])
    ]
    write("repos.json", {"repos": repos})
    return f"{len(repos)} repos tagged {REPO_TOPIC}"


# ---------- Prompts ----------

def parse_prompt(path):
    """Header lines ("key: value") until a line that is just ---, then the prompt."""
    with open(path) as f:
        text = f.read()
    head, sep, _ = text.partition("\n---\n")
    if not sep:
        raise ValueError("missing the --- line between the header and the prompt")
    meta = {}
    for line in head.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip().lower()] = value.strip()
    if not meta.get("title") or not meta.get("when"):
        raise ValueError("header needs at least title: and when:")
    return {
        "file": os.path.relpath(path, ROOT),
        "title": meta["title"],
        "when": meta["when"],
        "note": meta.get("note") or None,
        "post": meta.get("post") or None,
        "order": int(meta.get("order", 100)),
    }


def refresh_prompts():
    prompts, problems = [], []
    for path in sorted(glob.glob(os.path.join(ROOT, "prompts", "*.txt"))):
        try:
            prompts.append(parse_prompt(path))
        except Exception as e:
            problems.append(f"{os.path.basename(path)}: {e}")
    prompts.sort(key=lambda p: (p["order"], p["title"]))
    write("prompts.json", {"prompts": prompts})
    for p in problems:
        print(f"skipped prompt {p}", file=sys.stderr)
    return f"{len(prompts)} prompts" + (f", {len(problems)} skipped" if problems else "")


def main():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(COVERS, exist_ok=True)
    failed = False
    for name, step in [("posts", refresh_posts), ("repos", refresh_repos), ("prompts", refresh_prompts)]:
        try:
            print(f"{name}: {step()}")
        except Exception as e:
            failed = True
            print(f"{name}: FAILED, kept the previous file ({e})", file=sys.stderr)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
