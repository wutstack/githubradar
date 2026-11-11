/* GitHub Radar — คลัง repo ส่วนตัว
   ข้อมูล: data/repos.json (เขียนเอง) + data/meta.json (GitHub Action สร้างให้ตอน deploy) */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null) n.append(k);
    return n;
  };
  const SVG = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs = {}) => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  const DAY = 864e5;
  const EDIT_URL = "https://github.com/wutstack/githubradar/edit/main/data/repos.json";
  const now = Date.now();
  const fmtDate = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" });
  const fmtNum = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
  const ago = (d) => {
    const days = Math.round((d - now) / DAY);
    if (Math.abs(days) < 30) return rtf.format(days, "day");
    if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month");
    return rtf.format(Math.round(days / 365), "year");
  };

  // คำเติมที่คนพิมพ์ตอนค้นแบบพูด แต่ไม่ช่วยหา
  const STOP = new Set(("อัน อันที่ ตัว ตัวที่ ที่ ทำ ได้ ไว้ เคย เห็น แบบ ของ มี เป็น กับ และ หรือ สำหรับ ใช้ ช่วย " +
    "เอา อยาก หา repo the a an for to of and that which with tool").split(" "));
  const LEAD = /^(อันที่|ตัวที่|ที่เคย|ที่ใช้|ที่)/;
  const TAIL = /(ได้|ไว้|อยู่)$/;

  const state = { items: [], tags: new Set(), query: "", sort: "added", fuse: null, sectors: [], picked: null, rank: new Map() };

  /* ---------------- data ---------------- */
  async function loadData() {
    if (window.__RADAR_DATA) return window.__RADAR_DATA;
    const res = await fetch("data/repos.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`โหลด data/repos.json ไม่ได้ (HTTP ${res.status})`);
    const repos = await res.json();
    let meta = {};
    try {
      const m = await fetch("data/meta.json", { cache: "no-cache" });
      if (m.ok) meta = await m.json();
    } catch (_) { /* ยังไม่มี meta ก็แสดงได้ */ }
    return { repos, meta };
  }

  function prepare({ repos, meta }) {
    return repos.map((r, i) => {
      const [owner, name] = r.repo.split("/");
      const m = (meta && meta[r.repo]) || {};
      const tags = r.tags || [];
      const keywords = r.keywords || [];
      const item = {
        ...r, id: i, owner, name, tags, keywords, meta: m,
        description: m.description || "",
        topics: m.topics || [],
        added: new Date((r.added || "2000-01-01") + "T00:00:00"),
      };
      item._name = `${owner}/${name}`.toLowerCase();
      item._tags = tags.map((t) => t.toLowerCase());
      item._kw = keywords.join(" | ").toLowerCase();
      item._text = [r.summary, r.note, item.description, item.topics.join(" "), m.language].join(" | ").toLowerCase();
      return item;
    });
  }

  /* ---------------- search ---------------- */
  // ภาษาไทยไม่เว้นวรรค ต้องตัดคำก่อน ("ตัดคลิปภาษาไทย" -> ตัด, คลิป, ภาษาไทย)
  const THAI = /[\u0E00-\u0E7F]/;
  const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("th", { granularity: "word" }) : null;
  const splitThai = (t) => (seg && THAI.test(t) ? [...seg.segment(t)].filter((x) => x.isWordLike).map((x) => x.segment) : [t]);
  function terms(q) {
    const out = [];
    const spaced = q.toLowerCase().replace(/([\u0E00-\u0E7F])([a-z0-9])/g, "$1 $2").replace(/([a-z0-9])([\u0E00-\u0E7F])/g, "$1 $2");
    for (const raw of spaced.split(/[\s,]+/)) {
      const t = raw.replace(LEAD, "").replace(TAIL, "").trim();
      if (!t || STOP.has(t)) continue;
      out.push(t);
      // เก็บคำเต็มไว้ด้วย แล้วเพิ่มคำย่อยที่ตัดได้
      const parts = splitThai(t).filter((w) => w.length >= 2 && !STOP.has(w));
      if (parts.length > 1) out.push(...parts);
    }
    return [...new Set(out)];
  }

  function score(q) {
    const ts = terms(q);
    if (!ts.length) return null;
    const out = new Map();
    const add = (id, s) => out.set(id, (out.get(id) || 0) + s);
    const N = state.items.length || 1;
    for (const t of ts) {
      const hits = [];
      for (const it of state.items) {
        let s = 0;
        if (it._name.includes(t)) s += 6;
        if (it._tags.includes(t)) s += 5; else if (it._tags.some((x) => x.includes(t))) s += 3;
        if (it._kw.includes(t)) s += 4;
        if (it._text.includes(t)) s += 2;
        if (s) hits.push([it.id, s]);
      }
      // คำที่เจอใน repo น้อยตัวบอกได้ชัดกว่า จึงได้น้ำหนักมากกว่า
      const idf = Math.log(1 + N / Math.max(1, hits.length));
      hits.forEach(([id, s]) => add(id, s * idf));
      if (state.fuse && t.length >= 3) {
        for (const r of state.fuse.search(t)) if (r.score < 0.34) add(r.item.id, (1 - r.score) * 1.6);
      }
    }
    return out;
  }

  function buildFuse() {
    if (!window.Fuse) return null;
    return new window.Fuse(state.items, {
      includeScore: true, ignoreLocation: true, threshold: 0.34, minMatchCharLength: 2,
      keys: [
        { name: "name", weight: 3 }, { name: "tags", weight: 2 }, { name: "keywords", weight: 2 },
        { name: "summary", weight: 1.5 }, { name: "description", weight: 1 }, { name: "topics", weight: 1 }, { name: "note", weight: 1 },
      ],
    });
  }

  function visible() {
    const scores = score(state.query);
    let list = state.items.filter((it) =>
      [...state.tags].every((t) => it.tags.includes(t)) && (!scores || scores.has(it.id)));
    if (scores) return list.sort((a, b) => scores.get(b.id) - scores.get(a.id));
    const by = {
      added: (a, b) => b.added - a.added || a.id - b.id,
      stars: (a, b) => (b.meta.stars ?? -1) - (a.meta.stars ?? -1),
      pushed: (a, b) => new Date(b.meta.pushed_at || 0) - new Date(a.meta.pushed_at || 0),
      name: (a, b) => a.name.localeCompare(b.name),
    }[state.sort];
    return list.sort(by);
  }

  /* ---------------- radar ---------------- */
  const C = 200, R = 142, DISK = 196;
  const RINGS = [
    { days: 30, label: "เดือนนี้" },
    { days: 90, label: "3 เดือน" },
    { days: 365, label: "ปีนี้" },
    { days: Infinity, label: "เก่ากว่า" },
  ];
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return (h >>> 0) / 4294967295; };

  function computeSectors() {
    const freq = new Map();
    for (const it of state.items) for (const t of it.tags) freq.set(t, (freq.get(t) || 0) + 1);
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([t]) => t);
    const hasOther = state.items.some((it) => !it.tags.some((t) => top.includes(t)));
    return hasOther ? [...top, "อื่น ๆ"] : top;
  }

  function sectorOf(it) {
    // แท็กแรกของ repo คือหมวดหลัก
    const main = it.tags.find((t) => state.sectors.includes(t));
    return main ? state.sectors.indexOf(main) : state.sectors.length - 1;
  }

  function position(it) {
    const n = state.sectors.length || 1;
    const sec = sectorOf(it);
    const span = (Math.PI * 2) / n;
    const a = -Math.PI / 2 + span * sec + span * (0.18 + 0.64 * hash(it.repo));
    // ระยะจากศูนย์กลางตามลำดับที่เก็บ (ใหม่ใกล้ศูนย์กลาง) กระจายเท่า ๆ กันตามพื้นที่วง
    const n2 = state.items.length || 1;
    const rank = state.rank.get(it.id) ?? 0;
    const jitter = (hash(it.repo + "r") - 0.5) * 0.8;
    const rr = 16 + (R - 20) * Math.sqrt(Math.min(1, Math.max(0, (rank + 0.5 + jitter) / n2)));
    return { x: C + rr * Math.cos(a), y: C + rr * Math.sin(a) };
  }

  function drawRadar() {
    const root = $("#radar");
    root.replaceChildren();
    const n = state.sectors.length;
    root.append(svg("circle", { class: "disk", cx: C, cy: C, r: DISK }));

    RINGS.forEach((ring, i) => {
      const r = (R / RINGS.length) * (i + 1);
      root.append(svg("circle", { class: "ring", cx: C, cy: C, r }));
    });
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + ((Math.PI * 2) / n) * i;
      root.append(svg("line", { class: "spoke", x1: C, y1: C, x2: C + R * Math.cos(a), y2: C + R * Math.sin(a) }));
      const mid = a + Math.PI / n;
      const lx = C + (R + 24) * Math.cos(mid), ly = C + (R + 24) * Math.sin(mid);
      const t = svg("text", {
        class: "sector-label", x: lx, y: ly + 4, "text-anchor": "middle",
        "data-tag": state.sectors[i],
      });
      t.textContent = state.sectors[i];
      root.append(t);
    }

    // sweep: one pass on load
    const sweep = svg("g", { class: "sweep" });
    const grad = svg("defs");
    grad.innerHTML = `<linearGradient id="sw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F0A93B" stop-opacity="0"/><stop offset="1" stop-color="#F0A93B" stop-opacity=".35"/></linearGradient>`;
    root.append(grad);
    const wedge = 0.5;
    sweep.append(svg("path", {
      d: `M${C},${C} L${C + R * Math.cos(-wedge)},${C + R * Math.sin(-wedge)} A${R},${R} 0 0 1 ${C + R},${C} Z`,
      fill: "url(#sw)",
    }));
    sweep.append(svg("line", { x1: C, y1: C, x2: C + R, y2: C, stroke: "#F0A93B", "stroke-width": 1.5, opacity: .8 }));
    root.append(sweep);

    for (const it of state.items) {
      const { x, y } = position(it);
      const stars = it.meta.stars;
      const r = stars == null ? 3.6 : Math.min(7, 2.8 + Math.log10(stars + 1) * 0.85);
      const g = svg("g", { class: "blip", tabindex: "0", role: "button", "data-id": it.id, "aria-label": `${it.repo}: ${it.summary || ""}` });
      const title = svg("title"); title.textContent = it.repo;
      g.append(title,
        svg("circle", { class: "halo", cx: x, cy: y, r: r * 2.4 }),
        svg("circle", { class: "dot", cx: x, cy: y, r }));
      g.addEventListener("click", () => openDetail(it));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(it); } });
      root.append(g);
    }
    root.append(svg("circle", { cx: C, cy: C, r: 2.5, fill: "#F0A93B" }));
    if (!state.items.length) {
      const t = svg("text", { class: "radar-idle", x: C, y: C + 28, "text-anchor": "middle" });
      t.textContent = "รอสัญญาณแรก";
      root.append(t);
    }

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) requestAnimationFrame(() => sweep.classList.add("run"));
  }

  function updateRadar(list) {
    const filtering = state.query.trim() || state.tags.size;
    const ids = new Set(list.map((i) => i.id));
    const root = $("#radar");
    root.querySelectorAll(".blip").forEach((b) => {
      const id = +b.dataset.id;
      b.classList.toggle("is-dim", !!filtering && !ids.has(id));
      b.classList.toggle("is-hit", !!filtering && ids.has(id));
      b.classList.toggle("is-picked", state.picked === id);
    });
    root.querySelectorAll(".blip-label").forEach((n) => n.remove());
    if (filtering && list.length && list.length <= 4) {
      for (const it of list) {
        const { x, y } = position(it);
        const t = svg("text", { class: "blip-label", x: x + 9, y: y + 3.5, "text-anchor": x > 300 ? "end" : "start" });
        if (x > 300) t.setAttribute("x", x - 9);
        t.textContent = it.name;
        root.append(t);
      }
    }
    root.querySelectorAll(".sector-label").forEach((t) => t.classList.toggle("is-on", state.tags.has(t.dataset.tag)));
  }

  /* ---------------- cards ---------------- */
  const og = (it) => `https://opengraph.githubassets.com/1/${it.owner}/${it.name}`;

  function thumb(it) {
    const img = el("img", { src: og(it), alt: "", loading: "lazy", decoding: "async" });
    const wrap = el("div", { class: "thumb" }, img);
    img.addEventListener("error", () => {
      img.remove();
      wrap.append(el("div", { class: "fallback", "aria-hidden": "true", text: it.name.slice(0, 2).toUpperCase() }));
    });
    return wrap;
  }

  function metaLine(it) {
    const m = it.meta, parts = [];
    if (m.stars != null) parts.push(el("span", { class: "star", text: `★ ${fmtNum.format(m.stars)}` }));
    if (m.language) parts.push(el("span", { text: m.language }));
    if (m.archived) parts.push(el("span", { class: "warn", text: "เลิกพัฒนาแล้ว" }));
    if (m.missing) parts.push(el("span", { class: "warn", text: "หา repo ไม่เจอ" }));
    parts.push(el("span", { text: `เก็บ ${ago(it.added)}` }));
    return el("div", { class: "meta" }, parts);
  }

  function card(it) {
    return el("button", { class: "card", type: "button", onclick: () => openDetail(it) },
      thumb(it),
      el("div", { class: "card-body" },
        el("span", { class: "slug" }, `${it.owner}/`, el("b", { text: it.name })),
        el("p", { class: "summary", text: it.summary || it.description || "ยังไม่มีสรุป" }),
        el("div", { class: "chips" }, it.tags.map((t) => el("span", { class: "chip", text: t }))),
        metaLine(it)));
  }

  /* ---------------- detail ---------------- */
  function openDetail(it, found = false) {
    const m = it.meta;
    const facts = [];
    const fact = (k, v) => v && facts.push(el("dt", { text: k }), el("dd", { text: v }));
    fact("ดาว", m.stars != null ? m.stars.toLocaleString("en") : "");
    fact("ภาษา", m.language);
    fact("อัปเดตล่าสุด", m.pushed_at ? `${fmtDate.format(new Date(m.pushed_at))} (${ago(new Date(m.pushed_at))})` : "");
    fact("เก็บไว้เมื่อ", `${fmtDate.format(it.added)} (${ago(it.added)})`);
    fact("สถานะ", m.archived ? "archived — เจ้าของเลิกพัฒนาแล้ว" : "");

    const links = [el("a", { class: "btn btn-primary", href: `https://github.com/${it.repo}`, target: "_blank", rel: "noopener", text: "เปิดใน GitHub" })];
    if (m.homepage) links.push(el("a", { class: "btn btn-line", href: m.homepage, target: "_blank", rel: "noopener", text: "เว็บโปรเจกต์" }));
    if (it.source) links.push(el("a", { class: "btn btn-line", href: it.source, target: "_blank", rel: "noopener", text: "โพสต์ที่เจอ" }));

    $("#detailBody").replaceChildren(
      thumb(it),
      el("div", { class: "d-body" },
        found ? el("p", { class: "d-found", text: `ขุดเจอ! เก็บไว้ตั้งแต่ ${ago(it.added)}` }) : null,
        el("div", {}, el("div", { class: "owner", text: it.owner }), el("h3", { id: "dTitle", text: it.name })),
        el("p", { class: "d-summary", text: it.summary || "ยังไม่มีสรุป" }),
        it.description ? el("p", { class: "d-desc", text: `คำอธิบายจากเจ้าของ: ${it.description}` }) : null,
        it.note ? el("p", { class: "d-note", text: it.note }) : null,
        el("div", { class: "chips" }, it.tags.map((t) => el("span", { class: "chip", text: t }))),
        facts.length ? el("dl", { class: "d-facts" }, facts) : null,
        el("div", { class: "d-links" }, links)));

    state.picked = it.id;
    render();
    const dlg = $("#detail");
    if (!dlg.open) dlg.showModal();
  }

  /* ---------------- render ---------------- */
  function renderTags() {
    const freq = new Map();
    for (const it of state.items) for (const t of it.tags) freq.set(t, (freq.get(t) || 0) + 1);
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    $("#tags").replaceChildren(...sorted.map(([t, c]) =>
      el("button", {
        class: "tag", type: "button", "aria-pressed": String(state.tags.has(t)), "data-tag": t,
        onclick: () => { state.tags.has(t) ? state.tags.delete(t) : state.tags.add(t); render(); },
      }, t, el("small", { text: c }))));
  }

  function render() {
    const list = visible();
    const filtering = state.query.trim() || state.tags.size;
    $("#grid").replaceChildren(...list.map(card));
    $("#empty").hidden = list.length > 0;
    const none = state.items.length === 0;
    $("#emptyTitle").textContent = none ? "ยังไม่มี repo ในคลัง" : "ไม่เจอ repo ที่ตรงกับคำค้นนี้";
    $("#emptyHint").replaceChildren(...(none
      ? ["repo ที่เพิ่มใน ", el("a", { href: EDIT_URL, target: "_blank", rel: "noopener", text: "data/repos.json" }), " จะขึ้นที่นี่และบนเรดาร์"]
      : ["ลองคำที่สั้นลง ใช้ภาษาอังกฤษ หรือเอาแท็กที่เลือกออก"]));
    // ไม่มีข้อมูล: ซ่อนตัวควบคุมที่ยังไม่มีอะไรให้ทำ
    $("#dig").hidden = none;
    $("#sortWrap").hidden = none;
    $("#legend").hidden = none;
    document.body.classList.toggle("is-empty", none);
    $("#clear").hidden = !filtering;
    $("#listTitle").textContent = filtering ? `เจอ ${list.length} รายการ` : "ทั้งหมด";
    $("#count").textContent = `${state.items.length} repo ที่เก็บไว้`;
    $("#sort").disabled = !!state.query.trim();
    document.querySelectorAll(".tag").forEach((b) => b.setAttribute("aria-pressed", String(state.tags.has(b.dataset.tag))));
    updateRadar(list);
  }

  function dig() {
    const old = state.items.filter((it) => now - it.added > 60 * DAY);
    const pool = old.length ? old : state.items;
    if (!pool.length) return;
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && pick.id === state.picked) pick = pool[(pool.indexOf(pick) + 1) % pool.length];
    openDetail(pick, true);
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    try {
      state.items = prepare(await loadData());
    } catch (e) {
      $("#grid").replaceChildren(el("p", { text: e.message }));
      return;
    }
    state.fuse = buildFuse();
    state.sectors = computeSectors();
    [...state.items].sort((a, b) => b.added - a.added || a.id - b.id).forEach((it, i) => state.rank.set(it.id, i));

    renderTags();
    drawRadar();
    render();

    const q = $("#q");
    const params = new URLSearchParams(location.search);
    if (params.get("q")) { q.value = params.get("q"); state.query = q.value; render(); }

    let timer;
    q.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.query = q.value; render(); }, 90);
    });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
    $("#dig").addEventListener("click", dig);
    $("#clear").addEventListener("click", () => { state.tags.clear(); state.query = ""; q.value = ""; render(); q.focus(); });
    $("#detail").addEventListener("close", () => { state.picked = null; render(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== q && !$("#detail").open) { e.preventDefault(); q.focus(); }
    });
  }

  // Fuse โหลดจาก CDN แบบ defer; ถ้าโหลดไม่ได้ก็ค้นแบบตรงตัวอักษรได้อยู่
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
