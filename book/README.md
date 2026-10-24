# Book

The site for writing.ethanlawcorn.com: one serif column, ink on paper, nothing but type. Direction A of the
"Garden, plain" canvas (https://claude.ai/artifact/JFiqe8wS9JuTdhduCiztm9), picked by Ethan on 2026-10-19.

- **Index** (`/`): a hero picture, a short signed note from Ethan with his links under it, every note by month (newest
  first, undated last).
- **Note** (`/<slug>`): Index top left, Show markdown top right, the title, the date, the note, the notes that link to
  it. Nothing under it for now: Ethan cut the reading time (1 or 2 minutes on every note), the tags (they led nowhere)
  and the links row and footer under notes on 2026-10-20; he is making a different footer for notes.
- **Footer** (index and 404 only): a strip of an old print the full width of the page, flush with its bottom, with one
  modern thing in it that moves, drawn as dots like the hero (see Strips). It replaced the pixel parade on 2026-10-24.
- No dark mode. Ethan, 2026-10-19: the garden is ink on paper only.

## Build

```sh
npx tsx book/build.ts            # writes public/ (pages, assets/, att/, _redirects, _headers, 404.html)
npx tsx book/build.ts . --dev    # the same plus the tuning kit (?dev=1, or any page on localhost)
npx wrangler dev                 # serve public/ with the real Workers asset rules
```

In the pipeline, `scripts/lib/03-build.sh` runs it by default. `SITE_ENGINE=strata` builds Garden Strata and
`SITE_ENGINE=quartz` the old Quartz site (rollbacks). Live builds never pass `--dev`: the kit is left out and the
script, CSS and inline scripts are minified with no comments.

## What it reads

`content/2 - atomic notes/*.md` after the publish gate has run. As a second lock, a note whose status is not `#adult`
is skipped. The file name is the title. A link to a note that is not published stays as plain words. Images
embedded with `![[file]]` are copied to `public/att/`, and anything wider than 1400 px is scaled down to it. Pictures
are centred in the column.

- **Show markdown:** the marks a note was written with (`#`, `*`, `[[ ]]`, `---`) are in the page as hidden spans,
  shown faint in mono when the reader turns it on. The choice carries to the next note.
- **Hero:** `hero/heroes.json`. Since 2026-10-21 it holds one picture, Ethan's pick: Saint Teresa's vision of the
  laptop, Pieter van Schuppen's engraving after Rubens (about 1650; Metropolitan Museum, CC0) with the dove replaced
  by a laptop on a cloud, in D2 dots (made on the "Garden footer" canvas, https://claude.ai/artifact/EEGuko4RpVG1A1yvPTFqAP;
  sources and script in `~/code/projects/artifacts/garden-footer/teresa`). His five earlier picks (Dürer S4, Dou D2,
  Wright of Derby D2, Piranesi S4, Koninck D2) are still in `hero/`: list them in `heroes.json` again and the inline
  script draws one at random per visit, never the same twice in a row; `?hero=<key>` pins one. With JavaScript off,
  the first in the list shows. The picture is never taller than the screen minus `--hero-room`, so the first screen
  always shows the start of the note under it (a hero that ends at the fold reads as the whole page); it is centred and
  narrower when that cap applies. The renders come from `halftone.py` in `~/code/projects/artifacts/garden-hero`; all
  the pictures are public domain. Each shows a caption crediting it unless its entry has `"caption": false`; Teresa's
  has none since 2026-10-21 (Ethan asked; the credit stays in the alt text).
- **Intro:** `INTRO` and `SIGN` in `build.ts`, Ethan's words (2026-10-20), set in the title face and signed. The page
  keeps a visually hidden `<h1>` with his name for screen readers.
- **Addresses:** notes are `/<slug>`, the file name in lower case with dashes. `_redirects` sends old Quartz note
  URLs (`/2---atomic-notes/<Slug>`) to the note and other old Quartz pages to `/`. Garden Strata's `/?n=<slug>` and
  `/#note-<slug>` are sent on by a script on the index.

## Strips

Made on the "Garden footer" canvas (https://claude.ai/artifact/EEGuko4RpVG1A1yvPTFqAP), where Ethan locked these three
(N, O and X there) on 2026-10-22 and 2026-10-24. The rule they follow: a real public-domain print that says "old" at a
glance even as dots, with one modern thing in it that belongs to the scene, played straight, and only that thing moves.

- `hollar`: Wenceslaus Hollar, Long View of London from Bankside (1647). A tower crane beside Old St Paul's works
  through its lifts.
- `visscher`: Claes Jansz. Visscher, Profile of Amsterdam from the IJ (1611). A speedboat runs among the ships at anchor
  and tows a parasail over the city.
- `utrecht`: Herman Saftleven, Utrecht from the east (1648; Rijksmuseum, CC0). A high-speed line runs across the
  pasture, and a train passes now and then, one way and then the other, across the part of the line on screen. The
  print is only 1,685 px wide at this height (the Dom fills it), so its own farmland runs on past both plate edges to
  make it 2,544 (Ethan 2026-10-24, on a wide screen: "doesnt reach the end"; `utrecht_wide` in `tools/strips.py`).

The script draws one at random per page load, never the same twice in a row; `?strip=<key>` pins one and `?t=<seconds>`
holds a moment. Only the picked print is fetched, when the footer comes near. The clock runs only while the strip is on
screen, so the thing starts its loop when the reader gets there. Under reduced motion, or without WebGL, it holds the
frame each thing gives (`still`: the crane with its load up, the train in the middle of the screen). With JavaScript
off there is no footer. The credit is in each strip's alt text, as the hero's is.

The prints come baked from `~/code/projects/artifacts/garden-footer` (`tools/strips.py`; its README has the sources and
how each was cleaned): cell lightness, 66 rows of 3.3 px cells (217.8 px), much wider than any screen, so the page shows
the part around the thing at any width and fades the ends of a print narrower than the screen. `strips.js` is that
folder's `lab/strips.js` cut down to these three things; to add or change one, bake it there, copy its JSON here and
list it in `strips.json`.

## Files

- `build.ts`: parses notes, renders markdown, writes `public/`.
- `book.css`: the page; every colour and face is a token on `:root`.
- `client.ts`: the markdown toggle and the footer's pick. `dev.ts`: the tuning kit (`--dev` only).
- `strips/`: the footer. `strips.js` draws and runs a strip (`strips.d.ts` types it), `strips.json` lists the ones in
  use with their alt text, and one baked print per strip as JSON.
- `fonts/`, `fonts.css`: Literata, Cormorant Garamond and JetBrains Mono, latin subsets from Google Fonts, under the SIL
  Open Font License (`fonts/OFL-*.txt`).
- `hero/`: the hero pictures as lossless WebP, and `heroes.json` (the ones in use).
- `icon/`: the tab icon, copied to the site root. `mark.svg` is the signed E: Cormorant Garamond Italic at weight 700,
  ink on a paper tile, Ethan's pick (B) on the "Garden tab icon" canvas
  (https://claude.ai/artifact/MC4evTyPD8LJAuwprbsb4H), 2026-10-20. `mark-64.png` (browsers without SVG icons) and
  `apple-touch-icon.png` (180 px, full bleed, iOS rounds it) are rendered from it with sharp.
