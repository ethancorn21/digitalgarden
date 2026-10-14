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

In the pipeline, `scripts/lib/03-build.sh` runs it when `SITE_ENGINE=strata`. The default is still `quartz`.

## What it reads

`content/2 - atomic notes/*.md` after the publish gate has run, so only `status: #adult` notes are there and
links to unpublished notes are already scrubbed. Status is read with the gate's own `statusOf`. Images embedded
with `![[file]]` (Excalidraw embeds resolve to their exported `.svg`) are copied to `public/att/`.

- **Levels:** one per month from the first dated note to the build month. Empty months still get a thin level,
  so a new level appears each month with no code change. Undated notes form the basement.
- **Tints:** `strata/topics.json`. A note takes the least common principal tag it carries.
- **Relief:** a note stands off its level by its link count (open view).
- **Addresses:** notes are `/#note-<slug>`, with Quartz's slug. `_redirects` sends old Quartz note URLs to
  `/?n=<slug>` and old tag, index and source pages to `/`.

## Files

- `template.html`: the page (styles, markup, drawing code). Data goes in at `/*__STRATA_DATA__*/null`.
- `build.ts`: parses notes, computes levels, links and hubs, writes `public/`.
- `topics.json`: principal tags and their tints.
