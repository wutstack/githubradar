# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner (a Thai developer who saves GitHub repos found mostly in Facebook posts) is the primary user. Secondary: friends and groups the owner sends links to, often a prefilled search link (`?q=`). Readers are Thai-first and comfortable with English technical terms.

## Product Purpose

A personal, curated library of GitHub repos that can be found again with the words you happen to remember, not the repo's name. Finding a half-remembered repo and browsing/rediscovering the collection matter equally. Success: a vague Thai or English phrase surfaces the right repo in seconds, and browsing makes forgotten saves resurface.

## Positioning

Every entry is hand-written: a one-line Thai summary, the owner's own search keywords, an optional note on why it mattered, and the post where it was found. Search understands spoken-style Thai (word segmentation, filler-word stripping) mixed with English. A GitHub star list cannot do either.

## Operating Context

- Owner adds entries by editing `data/repos.json`; a GitHub Action validates it, fetches stars/language/last-push into `data/meta.json`, and deploys to GitHub Pages on every push and every morning.
- Collection size: 86 repos (Nov 2026), growing in batches of tens. 14 tags today (Skill, Agent Tools, Design, 3D, Dev Tools, AI Model, Learning, Video, Security, Tools, Animation, ภาษาไทย, Hardware, Data).
- Visitors arrive on desktop and on phones (links shared in chat apps).

## Capabilities and Constraints

- Search box (`/` shortcut, shareable `?q=`), tag filter (one tag at a time; picking another replaces it, picking the same one clears it), sort (added, stars, pushed, name), detail view with GitHub / homepage / source-post links, random "dig up an old one" (saved > 60 days).
- **Radar is a required product mechanism:** repos placed by category (angle) and how recently saved (distance from centre; newer = closer). Its rendering may change; the mechanism stays.
- Static site, no build step: `index.html`, `style.css`, `app.js`, Fuse.js from CDN. Stack was not marked as a hard constraint, but nothing requires changing it.
- Thumbnails come from GitHub's OpenGraph image service; can fail and need a fallback.
- **Cards must show everything at a glance, no click needed (owner requirement, 2026-11-22):** OpenGraph thumbnail, owner/name, full Thai summary, all tags, stars, language, and how long ago it was saved, plus archived / not-found warnings. The detail dialog adds extras (owner's description, note, links); it must never be the only place the core facts appear. A design that hides card facts behind a click is worse than the current one.
- Repo metadata may be missing, archived, or not found.

## Brand Commitments

- Name: GitHub Radar (kept unless the owner says otherwise).
- Voice: plain, casual Thai, short sentences, no marketing tone.

## Evidence on Hand

- Real data: `data/repos.json` (86 hand-written entries). No testimonials, user counts, or usage stats exist; do not invent any.

## Product Principles

1. Recall beats taxonomy: the owner's words are the index.
2. Search and browse are equal citizens; neither is hidden behind the other.
3. The collection's shape over time (what, and when) is worth seeing at a glance — that is the radar's job.
4. A shared link must land a friend on a useful, readable result immediately.

## Accessibility & Inclusion

Thai script needs generous line-height and fonts with full Thai coverage. Keyboard access for radar blips and filters; reduced-motion respected.
