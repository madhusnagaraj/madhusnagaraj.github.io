// Fills the page from data/*.json, which scripts/refresh.py rebuilds every day.
// Nothing in here should need editing when you add an essay, a repo or a prompt.
(function () {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const LIST_LENGTH = 8;
  const SPOTS = [{ x: 0, y: 8, r: -5 }, { x: 40, y: 0, r: 6 }, { x: 18, y: 46, r: -2 }];

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (text) node.textContent = text;
    return node;
  }

  function load(path) {
    return fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  }

  function shortDate(iso) {
    const [, m, d] = iso.split("-");
    return MONTHS[Number(m) - 1] + " " + d;
  }

  // A prompt's "post:" may be the essay's URL or the start of its title.
  function findPost(posts, ref) {
    if (!ref) return null;
    return posts.find((p) => p.url === ref) || posts.find((p) => p.title.startsWith(ref)) || null;
  }

  // ---------- Hero: dealt pile of post covers ----------

  function deal(withArt) {
    const pile = document.getElementById("pile");
    const pick = [...withArt].sort(() => Math.random() - 0.5).slice(0, 3);
    pile.replaceChildren();
    pick.forEach((p, i) => {
      const card = el("a", { href: p.url, title: p.title });
      card.append(el("img", { src: p.cover, alt: "" }), el("span", {}, p.title));
      const spot = SPOTS[i];
      const tilt = (spot.r + (Math.random() * 4 - 2)).toFixed(1);
      card.style.left = spot.x + "%";
      card.style.top = spot.y + "%";
      card.style.opacity = 0;
      card.style.transform = "rotate(" + tilt + "deg) translateY(30px)";
      pile.append(card);
      setTimeout(() => {
        card.style.opacity = 1;
        card.style.transform = "rotate(" + tilt + "deg)";
      }, 60 + i * 120);
    });
  }

  // ---------- Writing ----------

  function writingList(posts) {
    const list = document.getElementById("posts");
    const peek = document.getElementById("peek");
    const peekImg = document.getElementById("peek-img");
    posts.slice(0, LIST_LENGTH).forEach((p) => {
      const li = el("li");
      li.append(el("span", { class: "d" }, shortDate(p.date)), el("a", { href: p.url }, p.title));
      if (p.cover) {
        li.addEventListener("mousemove", (e) => {
          peekImg.src = p.cover;
          peek.style.left = e.clientX + 24 + "px";
          peek.style.top = e.clientY - 70 + "px";
          peek.classList.add("on");
        });
        li.addEventListener("mouseleave", () => peek.classList.remove("on"));
      }
      list.append(li);
    });
  }

  function updated(iso) {
    const [y, m] = iso.split("-");
    document.getElementById("updated").textContent = MONTHS[Number(m) - 1] + " " + y;
  }

  // ---------- Prompts ----------

  // Older or locked-down browsers: copy through a hidden textarea.
  function legacyCopy(text) {
    const area = el("textarea", { readonly: "", style: "position:fixed;top:-1000px;opacity:0" });
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    area.remove();
    return ok;
  }

  // The file starts with a header (title:, when:, ...) and a --- line; copy only the prompt.
  function promptBody(text) {
    const cut = text.indexOf("\n---\n");
    return cut === -1 ? text : text.slice(cut + 5);
  }

  function copyButton(file) {
    const btn = el("button", { class: "copy", type: "button" }, "Copy prompt");
    btn.addEventListener("click", async () => {
      let copied = false;
      try {
        const text = promptBody(await fetch(file).then((r) => r.text()));
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch (e) {
          copied = legacyCopy(text);
        }
      } catch (e) {
        copied = false;
      }
      if (!copied) {
        window.open(file, "_blank", "noopener"); // last resort: show it
        return;
      }
      btn.textContent = "Copied";
      btn.classList.add("done");
      setTimeout(() => { btn.textContent = "Copy prompt"; btn.classList.remove("done"); }, 2500);
    });
    return btn;
  }

  function promptList(prompts, posts) {
    const box = document.getElementById("prompt-list");
    prompts.forEach((p, i) => {
      const row = el("div", { class: "prompt" + (i === prompts.length - 1 ? " last" : "") });
      const text = el("div");
      const para = el("p", {}, p.when + " ");
      if (p.note) para.append(el("span", { class: "used" }, p.note), " ");
      const post = findPost(posts, p.post);
      if (post) para.append(el("a", { href: post.url }, "Read the post"), " ");
      para.append(el("a", { class: "view", href: p.file }, "View"));
      text.append(el("h3", {}, p.title), para);
      row.append(text, copyButton(p.file));
      box.append(row);
    });
    if (!prompts.length) document.getElementById("prompts").hidden = true;
  }

  // ---------- Code ----------

  function repoList(repos) {
    const list = document.getElementById("repo-list");
    repos.forEach((r) => {
      const li = el("li");
      li.append(el("a", { class: "name", href: r.url }, r.name));
      if (r.description) li.append(el("span", { class: "desc" }, r.description));
      if (r.essay) li.append(el("a", { class: "essay", href: r.essay }, "Read the essay"));
      list.append(li);
    });
    if (!repos.length) {
      document.getElementById("code").hidden = true;
      document.getElementById("code-note").hidden = true;
    }
  }

  // ---------- Go ----------

  Promise.allSettled([load("data/posts.json"), load("data/prompts.json"), load("data/repos.json")])
    .then(([postsRes, promptsRes, reposRes]) => {
      const posts = postsRes.status === "fulfilled" ? postsRes.value.posts : [];
      if (postsRes.status === "fulfilled") {
        const withArt = posts.filter((p) => p.cover);
        deal(withArt);
        document.getElementById("shuffle").addEventListener("click", () => deal(withArt));
        writingList(posts);
        updated(postsRes.value.generated_at);
      } else {
        document.querySelector(".pile-wrap").hidden = true;
      }
      promptList(promptsRes.status === "fulfilled" ? promptsRes.value.prompts : [], posts);
      repoList(reposRes.status === "fulfilled" ? reposRes.value.repos : []);
    });
})();
