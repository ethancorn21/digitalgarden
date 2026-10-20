# Book

The site for writing.ethanlawcorn.com: one serif column, ink on paper, nothing but type. Direction A of the
"Garden, plain" canvas (https://claude.ai/artifact/JFiqe8wS9JuTdhduCiztm9), picked by Ethan on 2026-10-19.

- **Index** (`/`): a hero picture, the intro, every note by month (newest first, undated last), GitHub and Spotify.
- **Note** (`/<slug>`): Index top left, Show markdown top right, the title, a meta line (date · minutes to read · tags),
  the note, the notes that link to it.
- **Footer:** the pixel parade (an alien, a robot, a philosopher and a hacker beat a dragon). The 404 page plays its
  dragon 404 instead. It starts when it scrolls into view and holds one frame under reduced motion.
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
embedded with `![[file]]` are copied to `public/att/`, and anything wider than 1400 px is scaled down to it.

- **Show markdown:** the marks a note was written with (`#`, `*`, `[[ ]]`, `---`) are in the page as hidden spans,
  shown faint in mono when the reader turns it on. The choice carries to the next note.
- **Hero:** `hero/heroes.json`, Ethan's five picks from the canvas (2026-10-20): Dürer S4, Dou D2, Wright of Derby
  D2, Piranesi S4, Koninck D2. A small inline script draws one at random per visit, never the same twice in a row;
  `?hero=<key>` pins one. With JavaScript off, the Dürer shows. The renders come from
  `~/code/projects/artifacts/garden-hero` (`halftone.py`); all five pictures are public domain.
- **Intro:** `INTRO` in `build.ts`, Ethan's words from `content/index.md` until he rewrites them.
- **Addresses:** notes are `/<slug>`, the file name in lower case with dashes. `_redirects` sends old Quartz note
  URLs (`/2---atomic-notes/<Slug>`) to the note and other old Quartz pages to `/`. Garden Strata's `/?n=<slug>` and
  `/#note-<slug>` are sent on by a script on the index.

## Files

- `build.ts`: parses notes, renders markdown, writes `public/`.
- `book.css`: the page; every colour and face is a token on `:root`.
- `client.ts`: the markdown toggle and the parade. `dev.ts`: the tuning kit (`--dev` only).
- `parade/`: the parade, copied from `~/code/projects/artifacts/parade` (commit ef529fc).
- `fonts/`, `fonts.css`: Literata, Cormorant Garamond and JetBrains Mono, latin subsets from Google Fonts, under the SIL
  Open Font License (`fonts/OFL-*.txt`).
- `hero/`: the five pictures as lossless WebP, and `heroes.json`.
