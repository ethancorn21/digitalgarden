# Garden Strata

The block-diagram site for ethanlawcorn.com: every atomic note is a tile, every calendar month a level of an
isometric block in the USGS Block Diagram style. The levels open into an aligned stack. Hover a layer to slide
it out; hover a note for its links; click a note to raise it and slide its linked levels out to the right.

## Build

```sh
npx tsx strata/build.ts            # writes public/ (index.html, att/, _redirects, _headers, 404.html)
npx tsx strata/build.ts . --out /tmp/site --date 2026-11-01   # elsewhere, or as if built on a date
npx wrangler dev                   # serve public/ locally with the real Workers asset rules
```

In the pipeline, `scripts/lib/03-build.sh` runs it by default. `SITE_ENGINE=quartz` builds the old Quartz site instead (rollback).

## What it reads

`content/2 - atomic notes/*.md` after the publish gate has run, so only `status: #adult` notes are there and
links to unpublished notes are already scrubbed. Status is read with the gate's own `statusOf`. Images embedded
with `![[file]]` (Excalidraw embeds resolve to their exported `.svg`) are copied to `public/att/`.

- **Levels:** one per month that has at least one dated note; months with none get no level. Undated notes form
  the basement. The month is named on the level's tick label at the right, not on the slab.
- **Tints:** `strata/topics.json`. A note takes the least common principal tag it carries.
- **Relief:** a note stands off its level by its link count (open view).
- **Addresses:** notes are `/#note-<slug>`, with Quartz's slug. `_redirects` sends old Quartz note URLs to
  `/?n=<slug>` and old tag, index and source pages to `/`.

## Hub and dev kit

- **Hub:** a bare `/` opens on the hub, a full-screen layer over the block page, ink on paper: a glass lens of
  numbered ink cells (WebGL; cells squish from the pointer and take a destination's colours while its option is
  hovered) inside a tesseract turning through 4D, drawn as hairlines with brush ink painting along its edges, over
  drafting guides and a tick ring that swells toward the pointer. Choosing an option blooms radial brush strokes and
  bends every edge into that site's drawing: Notes lands face for face on this page's real block (`STRATA.faces()`),
  then the block fades in under it; Ancient Works becomes survey contours and goes to Resurface with
  `?via=hub&b=x,y,w,h&v=W,H`, where `web/arrive.js` (ancient-works repo) redraws the same frame and fades into the
  map; Projects becomes a blueprint gear, then GitHub (no arrival there). Keep `tContours` in step with
  `arrive.js`. Any hash or `?n=` skips the hub. Hub words are marked `HUB COPY`. With no WebGL the cells are drawn
  flat on the 2D canvas. On localhost, Ancient Works goes to a local Resurface preview on :8788.
- **Dev kit:** on localhost, or any host with `?dev=1` (sticky; `?dev=0` turns it off). Presets, a picker per
  colour token, hub knobs, Pick (click the page to find its tokens) and Export CSS. Edits stay in that browser.

## Files

- `template.html`: the page (styles, markup, drawing code). Data goes in at `/*__STRATA_DATA__*/null`.
- `build.ts`: parses notes, computes levels, links and hubs, writes `public/`.
- `topics.json`: principal tags and their tints.
