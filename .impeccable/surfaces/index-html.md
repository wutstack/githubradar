---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["style.css","app.js"]
---

# Surface: GitHub Radar main page (index.html)

Mode: Operate. Audience: the owner plus friends who open shared `?q=` links. Job: find a half-remembered repo, and browse/rediscover the collection; both equal.
Constraints: cards keep every fact visible (thumbnail, owner/name, full summary, all tags, stars, language, saved date, warnings); radar mechanism kept; static site, no build.
Owner feedback 2026-11-22: sparse sketches were rejected; owner delegated the direction ("must be better than before, decide yourself").

## Direction contract

THESIS: Every saved repo is mail that arrived: dated by a violet postmark and numbered like registered mail. Refuses the dark dev-dashboard with a glowing scope, and refuses a full screen of controls before any result.

OWN-WORLD: Onionskin airmail paper ground (cool off-white), navy top bar (owner rejected postal red), postal red only for registration numbers, navy ink, violet cancel ink for every date. One full-strength hue per tag, used on filter swatch, radar blip and card chip. Sarabun (Thai official-document face) for text, Barlow Condensed for numerals, numbers and the wordmark.

STORY: Visitor sees the search and the newest results at once, narrows by words or tags, watches the radar dim to the matches, opens a card only for extras (note, owner description, links).

FIRST VIEWPORT: Sticky navy bar: wordmark left, search filling the middle, count right. Below, a 300px left column: radar (paper disk with violet date rings) then tag list with hue swatches and counts, sort, dig button. Right: card grid starting at the top, two to three columns, each card thumbnail plus full facts with the postmark overlapping the thumbnail's lower edge. Primary action: the search input.

FORM: assigned grounded candidate 7 (Thai Post registered mail and postmarks), raised by catalog numbering (Saville), tag hues (acetate), dim-in-place filtering (transit), scale contrast (specimen). seed:82e418883039af6a. Signature move: the violet date-ring postmark, repeated at card scale (save date) and radar scale (rings = this month / 3 months / this year / older).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
