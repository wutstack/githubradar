/* GitHub Radar — เก็บลิงก์ GitHub จากหน้าโปรไฟล์ Facebook ของตัวเอง
   วางใน Console (F12) ขณะเปิดหน้าโปรไฟล์ สคริปต์แค่อ่านหน้าเว็บในเครื่องคุณ ไม่ส่งข้อมูลไปที่ไหน
   รอบ 1: เลื่อนโปรไฟล์ เก็บลิงก์ที่อยู่ในโพสต์ (รวมลิงก์ที่เป็นข้อความเฉย ๆ)
   รอบ 2: เปิดโพสต์ต้นทางที่ไม่มีลิงก์ทีละอัน แล้วหาลิงก์ในคอมเมนต์ของคนโพสต์ */
(async () => {
  if (window.__radarHarvest) { alert("สคริปต์ GitHub Radar ทำงานอยู่แล้ว"); return; }
  window.__radarHarvest = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SKIP = new Set("orgs features topics sponsors settings marketplace apps collections trending login about pricing enterprise site security search explore notifications pulls issues codespaces readme customer-stories solutions resources team join signup".split(" "));
  const RE = /github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9_.-]{1,100})/gi;
  const HINT = /github|ลิงก์|ลิ้งก์|ลิ้ง|ลิงค์|link|คอมเมนต์|คอมเม้น|เม้น|comment|repo|open.?source|โอเพ[นน่]ซอร์ส|ใต้โพสต์|ด้านล่าง/i;
  const POST = /facebook\.com\/(?:[^/?#]+\/posts\/|permalink\.php|story\.php|groups\/[^/?#]+\/(?:posts|permalink)\/|[^/?#]+\/videos\/|reel\/|share\/p\/|photo(?:\.php|\/))/i;
  const MORE_TEXT = /^(ดูเพิ่มเติม|See more)$/i;
  const MORE_COMMENTS = /(ดูความคิดเห็นเพิ่มเติม|ดูความคิดเห็นก่อนหน้า|ความคิดเห็นอื่น|ดูการตอบกลับ|การตอบกลับ\s*\d|View more comments|View previous comments|more comments|View all \d+ repl|View \d+ repl|\d+ repl)/i;
  const AUTHOR = /ผู้เขียน|ผู้โพสต์|ผู้สร้าง|\bAuthor\b/i;

  const norm = (owner, repo) => {
    repo = repo.replace(/\.git$/i, "").replace(/[.\-_]+$/, "");
    if (!repo || SKIP.has(owner.toLowerCase())) return null;
    return `${owner}/${repo}`;
  };
  const linksIn = (root) => {
    const out = new Set();
    const add = (s) => { for (const m of String(s).matchAll(RE)) { const k = norm(m[1], m[2]); if (k) out.add(k); } };
    root.querySelectorAll("a[href]").forEach((a) => {
      let h = a.href;
      try { const t = new URL(h).searchParams.get("u"); if (t) h = decodeURIComponent(t); } catch (_) {}
      add(h);
    });
    add(root.innerText || "");
    return out;
  };
  const cleanUrl = (h) => {
    try {
      const u = new URL(h);
      [...u.searchParams.keys()].forEach((k) => { if (k.startsWith("__") || k === "ref" || k === "comment_id") u.searchParams.delete(k); });
      u.hash = "";
      return u.toString();
    } catch (_) { return h; }
  };
  const snippet = (s) => (s || "").replace(/\s+/g, " ").trim().slice(0, 140);

  /* ---------- panel ---------- */
  const panel = document.createElement("div");
  panel.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:360px;max-width:calc(100vw - 32px);background:#13202B;color:#E3EAF0;font:14px/1.5 system-ui,sans-serif;border-radius:14px;padding:14px 16px;box-shadow:0 10px 40px rgba(0,0,0,.4)";
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="color:#F0A93B">GitHub Radar</b><button data-x style="background:none;border:0;color:#93A2B2;cursor:pointer;font-size:16px">✕</button></div>
    <div data-status style="margin:8px 0">เริ่ม…</div>
    <div data-actions style="display:flex;gap:8px;flex-wrap:wrap"></div>
    <textarea data-out readonly style="display:none;width:100%;height:150px;margin-top:10px;background:#0B131A;color:#E3EAF0;border:1px solid #2A3847;border-radius:8px;font:12px ui-monospace,monospace;padding:8px"></textarea>`;
  document.body.append(panel);
  const $s = panel.querySelector("[data-status]");
  const $a = panel.querySelector("[data-actions]");
  const $o = panel.querySelector("[data-out]");
  const status = (t) => { $s.textContent = t; };
  let stop = false;
  panel.querySelector("[data-x]").onclick = () => { stop = true; panel.remove(); window.__radarHarvest = false; };
  const button = (label, fn, primary = true) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = `border:0;border-radius:8px;padding:7px 12px;cursor:pointer;font:600 13px system-ui;${primary ? "background:#F0A93B;color:#1D1404" : "background:#24384A;color:#E3EAF0"}`;
    b.onclick = fn;
    $a.append(b);
    return b;
  };

  /* ---------- state ---------- */
  const found = new Map();   // repo -> {repo, from, via}
  const pending = new Map(); // url -> {url, text, done, result}
  const addFound = (repo, from, via) => { if (!found.has(repo.toLowerCase())) found.set(repo.toLowerCase(), { repo, from, via }); };
  const save = () => { try { localStorage.setItem("githubRadarHarvest", JSON.stringify({ found: [...found.values()], pending: [...pending.values()] })); } catch (_) {} };

  /* ---------- round 1: scroll profile ---------- */
  const ownSlug = location.pathname.split("/").filter(Boolean)[0] || "";
  const topArticles = () => [...document.querySelectorAll('[role="article"]')].filter((a) => !a.parentElement.closest('[role="article"]'));

  async function scanArticle(art) {
    if (art.dataset.radarDone) return;
    art.dataset.radarDone = "1";
    for (const b of [...art.querySelectorAll('[role="button"]')].filter((b) => MORE_TEXT.test(b.innerText.trim()))) { b.click(); await sleep(250); }

    const postLinks = [...new Set([...art.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => POST.test(h)).map(cleanUrl))];
    const own = postLinks[0];
    const original = postLinks.find((h) => h !== own && !(ownSlug && h.includes(`/${ownSlug}/`)));
    const repos = linksIn(art);
    if (repos.size) { repos.forEach((r) => addFound(r, original || own || location.href, "post")); return; }

    const text = art.innerText || "";
    const target = original || own;
    if (target && (original || HINT.test(text)) && !pending.has(target)) {
      pending.set(target, { url: target, text: snippet(text), done: false, result: null });
    }
  }

  async function round1() {
    let last = 0, still = 0;
    for (let i = 0; i < 250 && still < 5 && !stop; i++) {
      for (const art of topArticles()) await scanArticle(art);
      status(`รอบ 1: เลื่อนหน้า ${i + 1} — เจอลิงก์ ${found.size} repo, โพสต์ต้องเปิดดูคอมเมนต์ ${pending.size} อัน`);
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(2200);
      const h = document.body.scrollHeight;
      still = h === last ? still + 1 : 0;
      last = h;
    }
    for (const art of topArticles()) await scanArticle(art);
    save();
  }

  /* ---------- round 2: open original posts ---------- */
  async function round2() {
    $a.replaceChildren();
    const w = window.open("about:blank", "githubRadarScan", "width=980,height=860");
    if (!w) { status("เบราว์เซอร์บล็อกหน้าต่างใหม่: กดอนุญาต pop-up ของ facebook.com ที่แถบที่อยู่ แล้วกดปุ่มอีกครั้ง"); button("เปิดดูคอมเมนต์", round2); return; }
    const list = [...pending.values()].filter((p) => !p.done);
    for (let i = 0; i < list.length && !stop; i++) {
      const p = list[i];
      status(`รอบ 2: โพสต์ ${i + 1}/${list.length} — เจอแล้วรวม ${found.size} repo (อย่าปิดหน้าต่างเล็ก)`);
      try {
        w.location.href = p.url;
        await sleep(1500);
        for (let t = 0; t < 30; t++) {
          try { if (w.location.href !== "about:blank" && w.document.readyState === "complete") break; } catch (_) {}
          await sleep(500);
        }
        await sleep(4500);
        const d = w.document;
        const root = d.querySelector('[role="dialog"] [role="article"]')?.closest('[role="dialog"]') || d.querySelector('[role="main"]') || d.body;
        for (let k = 0; k < 4; k++) {
          const more = [...root.querySelectorAll('[role="button"]')].filter((b) => MORE_COMMENTS.test(b.innerText) || MORE_TEXT.test(b.innerText.trim()));
          if (!more.length) break;
          more.slice(0, 20).forEach((b) => b.click());
          await sleep(2000);
        }
        const comments = [...root.querySelectorAll('[role="article"]')];
        const byAuthor = new Set();
        comments.filter((c) => AUTHOR.test((c.getAttribute("aria-label") || "") + " " + (c.innerText || "").slice(0, 200)))
          .forEach((c) => linksIn(c).forEach((r) => byAuthor.add(r)));
        if (byAuthor.size) { byAuthor.forEach((r) => addFound(r, p.url, "author-comment")); p.result = [...byAuthor]; }
        else {
          const any = linksIn(root);
          any.forEach((r) => addFound(r, p.url, "comment-check"));
          p.result = [...any];
        }
      } catch (e) {
        p.result = "error";
      }
      p.done = true;
      save();
      await sleep(1500 + Math.random() * 1500);
    }
    try { w.close(); } catch (_) {}
    finish();
  }

  function finish() {
    const lines = [...found.values()].map((f) => `${f.repo}\t${f.via}\t${f.from}`);
    const missed = [...pending.values()].filter((p) => p.done && (!p.result || !p.result.length || p.result === "error"))
      .map((p) => `?\t${p.url}\t${p.text}`);
    $o.value = ["# GitHub Radar harvest", ...lines, ...(missed.length ? ["# ไม่เจอลิงก์ในโพสต์เหล่านี้", ...missed] : [])].join("\n");
    $o.style.display = "block";
    status(`เสร็จ! ${found.size} repo` + (missed.length ? `, ${missed.length} โพสต์หาลิงก์ไม่เจอ` : "") + " — กดคัดลอก แล้ววางในแชทกับ Claude");
    $a.replaceChildren();
    button("คัดลอกผลลัพธ์", async (e) => {
      $o.select();
      let ok = false;
      try { await navigator.clipboard.writeText($o.value); ok = true; } catch (_) { ok = document.execCommand("copy"); }
      e.target.textContent = ok ? "คัดลอกแล้ว" : "คัดลอกเองจากกล่องด้านล่าง";
    });
  }

  await round1();
  if (stop) return;
  const todo = [...pending.values()].filter((p) => !p.done).length;
  if (!todo) { finish(); return; }
  status(`รอบ 1 เสร็จ: เจอ ${found.size} repo ในโพสต์ และมี ${todo} โพสต์ที่ลิงก์น่าจะอยู่ในคอมเมนต์ (ใช้เวลาราว ${Math.ceil(todo * 10 / 60)} นาที)`);
  button("เปิดดูคอมเมนต์", round2);
  button("ข้าม เอาเท่านี้", finish, false);
})();
