(function () {
  "use strict";

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var ICONS = {
    up: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    copy: '<rect width="14" height="14" x="8" y="8"/><path d="M4 16V4h12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
  };

  function $(id) { return document.getElementById(id); }

  function icon(name) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "i");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ICONS[name];
    return svg;
  }

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === "text") n.textContent = props[k];
      else if (k === "class") n.className = props[k];
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }

  function fmtDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ""));
    return m ? MONTHS[+m[2] - 1] + " " + m[3] : "";
  }

  function isoDate(d) {
    var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(d || ""));
    return m ? m[1] : "";
  }

  function normUrl(u) {
    return String(u || "").trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }

  function isUrl(s) { return /^https?:\/\//i.test(String(s || "").trim()); }

  function getJSON(path) {
    return fetch(path, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return null; });
  }

  function announce(msg) {
    var live = $("live");
    live.textContent = "";
    setTimeout(function () { live.textContent = msg; }, 30);
  }

  /* ---------- writing ---------- */
  function renderPosts(posts) {
    var list = $("posts-list");
    list.textContent = "";
    posts.slice(0, 8).forEach(function (p) {
      list.appendChild(el("li", { class: "post" }, [
        el("a", { href: p.url }, [
          el("time", { datetime: isoDate(p.date), text: fmtDate(p.date) }),
          el("span", { text: p.title })
        ])
      ]));
    });
  }

  /* ---------- cover pile ---------- */
  var pool = [], cards = [], dealing = false;

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function place(card, z) {
    var w = $("pile").clientWidth || 400;
    var spreadX = Math.min(90, w * 0.14);
    card.style.setProperty("--x", rnd(-spreadX, spreadX).toFixed(1) + "px");
    card.style.setProperty("--y", rnd(-28, 36).toFixed(1) + "px");
    card.style.setProperty("--r", rnd(-13, 13).toFixed(1) + "deg");
    card.style.zIndex = z;
  }

  function fill(card, p) {
    card.href = p.url;
    var img = card.querySelector("img");
    img.src = p.cover;
    img.alt = "Cover for " + p.title;
    card.querySelector(".cover-title").textContent = p.title;
    var t = card.querySelector("time");
    t.textContent = fmtDate(p.date);
    t.setAttribute("datetime", isoDate(p.date));
  }

  function topZ() { return cards.reduce(function (m, c) { return Math.max(m, +c.style.zIndex || 0); }, 0); }

  function makeCard() {
    var card = el("a", { class: "cover" }, [
      el("img", { class: "cover-img grayscale", alt: "", loading: "eager", decoding: "async", width: "400", height: "500" }),
      el("span", { class: "cover-cap" }, [el("span", { class: "cover-title" }), el("time", { class: "cover-date" })])
    ]);
    card.addEventListener("click", function (e) {
      if (+card.style.zIndex !== topZ()) { e.preventDefault(); card.style.zIndex = topZ() + 1; }
    });
    return card;
  }

  function renderPile(covered) {
    pool = covered;
    var wrap = $("pile-wrap"), pile = $("pile"), hero = document.querySelector(".hero");
    if (!pool.length) { wrap.hidden = true; hero.classList.remove("has-pile"); return; }
    wrap.hidden = false;
    hero.classList.add("has-pile");
    pile.textContent = "";
    cards = pool.slice(0, 3).map(function (p, i) {
      var c = makeCard(); fill(c, p); pile.appendChild(c); return c;
    });
    // newest on top
    cards.forEach(function (c, i) { place(c, cards.length - i); });
    $("deal").hidden = pool.length < 2;
  }

  function deal() {
    if (dealing || !cards.length) return;
    dealing = true;
    var pile = $("pile");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var next = pool.length > cards.length ? shuffle(pool).slice(0, cards.length) : null;
    var order = shuffle(cards.map(function (_, i) { return i + 1; }));
    pile.classList.add("gather");
    cards.forEach(function (c) { c.style.setProperty("--x", "0px"); c.style.setProperty("--y", "0px"); c.style.setProperty("--r", "0deg"); });
    setTimeout(function () {
      pile.classList.remove("gather");
      cards.forEach(function (c, i) { if (next) fill(c, next[i]); place(c, order[i]); });
      dealing = false;
    }, reduce ? 0 : 240);
  }

  /* ---------- prompts ---------- */
  var promptText = {};

  function bodyAfterRule(text) {
    var lines = String(text).split(/\r?\n/);
    var idx = -1;
    for (var i = 0; i < lines.length; i++) { if (lines[i].trim() === "---") { idx = i; break; } }
    if (idx < 0) return null;
    var body = lines.slice(idx + 1).join("\n").replace(/^\s*\n/, "").replace(/\s+$/, "");
    return body || null;
  }

  function preload(file) {
    if (promptText[file] !== undefined) return;
    promptText[file] = null;
    fetch(file, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { promptText[file] = bodyAfterRule(t); })
      .catch(function () { promptText[file] = null; });
  }

  function openFile(file) { window.open(file, "_blank", "noopener"); }

  function legacyCopy(text) {
    var ta = el("textarea", { readonly: "", "aria-hidden": "true" });
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copied(btn) {
    var label = btn.querySelector(".lbl"), ic = btn.querySelector("svg");
    label.textContent = "Copied";
    ic.innerHTML = ICONS.check;
    announce("Prompt copied");
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { label.textContent = "Copy prompt"; ic.innerHTML = ICONS.copy; }, 1800);
  }

  function copyPrompt(file, btn) {
    var text = promptText[file];
    if (!text) { openFile(file); return; }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { copied(btn); }, function () {
        if (legacyCopy(text)) copied(btn); else openFile(file);
      });
    } else if (legacyCopy(text)) {
      copied(btn);
    } else {
      openFile(file);
    }
  }

  function matchPost(ref, posts) {
    ref = String(ref || "").trim();
    if (!ref) return null;
    if (isUrl(ref)) {
      var u = normUrl(ref);
      return posts.filter(function (p) { return normUrl(p.url) === u; })[0] || null;
    }
    var start = ref.toLowerCase();
    return posts.filter(function (p) { return String(p.title).toLowerCase().indexOf(start) === 0; })[0] || null;
  }

  function renderPrompts(prompts, posts) {
    var section = $("prompts"), list = $("prompts-list");
    list.textContent = "";
    if (!prompts.length) { section.hidden = true; document.querySelector('[data-nav="prompts"]').hidden = true; return; }
    prompts.forEach(function (p) {
      preload(p.file);
      var btn = el("button", { class: "btn btn-primary btn-wide", type: "button" }, [el("span", { class: "lbl", text: "Copy prompt" }), icon("copy")]);
      btn.addEventListener("click", function () { copyPrompt(p.file, btn); });
      var post = matchPost(p.post, posts);
      list.appendChild(el("article", { class: "prompt" }, [
        el("h3", { text: p.title }),
        p.when ? el("p", { class: "prompt-when", text: p.when }) : null,
        p.note ? el("p", { class: "prompt-note", text: p.note }) : null,
        el("div", { class: "actions" }, [
          btn,
          el("a", { class: "btn btn-secondary", href: p.file }, ["View", icon("up")]),
          post ? el("a", { class: "link", href: post.url }, ["Read the post", icon("right")]) : null
        ])
      ]));
    });
    section.hidden = false;
    document.querySelector('[data-nav="prompts"]').hidden = false;
  }

  /* ---------- repos ---------- */
  function renderRepos(repos) {
    var section = $("code"), list = $("repos-list");
    list.textContent = "";
    if (!repos.length) { section.hidden = true; document.querySelector('[data-nav="code"]').hidden = true; return; }
    repos.forEach(function (r) {
      list.appendChild(el("li", null, [
        el("div", { class: "repo" }, [
          el("a", { class: "repo-name", href: r.url }, [r.name, icon("up")]),
          el("div", { class: "repo-side" }, [
            r.description ? el("p", { class: "repo-desc", text: r.description }) : null,
            r.essay ? el("a", { class: "link", href: r.essay }, ["Read the essay", icon("right")]) : null
          ])
        ])
      ]));
    });
    section.hidden = false;
    document.querySelector('[data-nav="code"]').hidden = false;
  }

  /* ---------- projects (hand-edited data/projects.json) ---------- */
  function renderProjects(projects) {
    var section = $("projects"), list = $("projects-list");
    list.textContent = "";
    if (!projects.length) { section.hidden = true; document.querySelector('[data-nav="projects"]').hidden = true; return; }
    projects.forEach(function (p) {
      list.appendChild(el("li", null, [
        el("div", { class: "repo" }, [
          el("a", { class: "repo-name", href: p.url }, [p.name, icon("up")]),
          el("div", { class: "repo-side" }, [
            p.description ? el("p", { class: "repo-desc", text: p.description }) : null
          ])
        ])
      ]));
    });
    section.hidden = false;
    document.querySelector('[data-nav="projects"]').hidden = false;
  }

  /* Number the visible sections 01, 02, ... so hidden ones never leave gaps. */
  function numberSections() {
    var n = 0;
    document.querySelectorAll("section.section").forEach(function (s) {
      var num = s.querySelector(".num");
      if (!num) return;
      num.textContent = s.hidden ? "" : String(++n).padStart(2, "0");
    });
  }

  /* ---------- boot ---------- */
  function init() {
    Promise.all([getJSON("data/posts.json"), getJSON("data/prompts.json"), getJSON("data/repos.json"), getJSON("data/projects.json")]).then(function (d) {
      var posts = ((d[0] && d[0].posts) || [])
        .filter(function (p) { return p && p.title && p.url; })
        .sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
      var prompts = ((d[1] && d[1].prompts) || [])
        .filter(function (p) { return p && p.title && p.file; })
        .map(function (p, i) { return { p: p, i: i }; })
        .sort(function (a, b) {
          var ao = isFinite(a.p.order) ? +a.p.order : Infinity, bo = isFinite(b.p.order) ? +b.p.order : Infinity;
          return ao - bo || a.i - b.i;
        })
        .map(function (x) { return x.p; });
      var repos = ((d[2] && d[2].repos) || []).filter(function (r) { return r && r.name && r.url; });

      renderPosts(posts);
      renderPile(posts.filter(function (p) { return typeof p.cover === "string" && p.cover.trim(); }));
      renderPrompts(prompts, posts);
      renderRepos(repos);
      renderProjects(((d[3] && d[3].projects) || []).filter(function (p) { return p && p.name && p.url; }));
      numberSections();
    });
    $("deal").addEventListener("click", deal);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
