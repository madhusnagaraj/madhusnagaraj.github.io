# madhusnagaraj.github.io

Personal site of Madhu Nagaraj: the prompts and code that come out of
[Thinking Through AI](https://www.madhunagaraj.com).

Plain HTML, CSS and a little JavaScript. No build step, no analytics. Fonts and images
are served from this repo, so the page makes no third-party requests.

## Upkeep: the only things you ever do

| When you… | Do this | Shows up |
|---|---|---|
| **Publish an essay** | Nothing. | Within a day |
| **Release a repo** | On GitHub, add the topic `on-my-site` to the repo. Its **description** is the one-line blurb; put the essay's URL in the repo's **Website** field to get a "Read the essay" link. | Within a day |
| **Add a prompt** | Add a `.txt` file to `prompts/` (format below). | As soon as you push |
| **Add or change a project** | Edit `data/projects.json`: name, url, image path, what it is, and the experiment. Its screenshot is taken automatically (and retaken weekly). The order in the file is the order on the page. | A few minutes after you push |

To refresh immediately instead of waiting for the daily run: **Actions → Refresh site
data → Run workflow**.

To remove something: delete the prompt file, take the `on-my-site` topic off the repo, or remove the project from `data/projects.json`.

### Prompt file format

```
title: Deal analyst
when: One or two sentences on when to use it.
note: Optional, shown in italics. Shaped by the car negotiation.
post: Optional. The essay's URL, or the start of its title.
order: Optional number. Lower comes first.
---
The prompt itself. Everything below the --- line is what "Copy prompt" copies.
```

`title:` and `when:` are required. A file missing either one, or missing the `---` line,
is skipped and the daily run reports it.

## How it works

`scripts/refresh.py` rebuilds three files in `data/`, and the page reads them:

- `posts.json`: from the public Substack archive. Each post's cover is saved into
  `assets/covers/`. Only covers hosted on Substack are used, so posts with stock photos
  appear in the list without art.
- `repos.json`: public repos tagged `on-my-site`.
- `prompts.json`: the header of each file in `prompts/`.

The GitHub Action in `.github/workflows/refresh-posts.yml` runs the script once a day
and whenever a prompt changes, then commits the result. If a source can't be reached,
that file keeps its last good version, the other sources still update, and the run is
marked failed so GitHub emails you.

## Run locally

```bash
python3 scripts/refresh.py
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Hand-edited, rarely

The intro, the pull quote and the colophon live in `index.html`. Colors and type are in
`assets/site.css`.
