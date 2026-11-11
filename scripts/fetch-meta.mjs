// ตรวจ data/repos.json แล้วดึงข้อมูลสด (ดาว ภาษา วันอัปเดต) จาก GitHub API ไปเขียน data/meta.json
// รันใน GitHub Action ตอน deploy: node scripts/fetch-meta.mjs
import { readFile, writeFile } from "node:fs/promises";

const repos = JSON.parse(await readFile("data/repos.json", "utf8"));

// --- ตรวจความถูกต้องของไฟล์ ---
const seen = new Set();
const problems = [];
repos.forEach((r, i) => {
  const at = `แถวที่ ${i + 1}`;
  if (!/^[\w.-]+\/[\w.-]+$/.test(r.repo || "")) problems.push(`${at}: "repo" ต้องเป็นรูปแบบ owner/name`);
  const key = (r.repo || "").toLowerCase();
  if (seen.has(key)) problems.push(`${at}: ${r.repo} ซ้ำ`);
  seen.add(key);
  if (r.added && !/^\d{4}-\d{2}-\d{2}$/.test(r.added)) problems.push(`${at}: "added" ต้องเป็น YYYY-MM-DD`);
  if (r.tags && !Array.isArray(r.tags)) problems.push(`${at}: "tags" ต้องเป็น array`);
});
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

// --- ดึง metadata ---
const headers = { Accept: "application/vnd.github+json", "User-Agent": "github-radar" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const meta = {};
for (const { repo } of repos) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (res.status === 404) { meta[repo] = { missing: true }; console.warn(`ไม่พบ ${repo}`); continue; }
    if (!res.ok) { console.warn(`${repo}: HTTP ${res.status}`); continue; }
    const j = await res.json();
    meta[repo] = {
      description: j.description,
      stars: j.stargazers_count,
      language: j.language,
      topics: j.topics || [],
      pushed_at: j.pushed_at,
      archived: j.archived,
      homepage: j.homepage || null,
    };
  } catch (e) {
    console.warn(`${repo}: ${e.message}`);
  }
}

await writeFile("data/meta.json", JSON.stringify(meta, null, 1));
console.log(`meta.json: ${Object.keys(meta).length}/${repos.length} repos`);
