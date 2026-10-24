// book/build.ts — build the Book site (one serif column, ink on paper, nothing but type) into public/.
//
// Replaces `npx quartz build` when SITE_ENGINE=book (see scripts/lib/03-build.sh).
// Input is the repo content AFTER the publish gate has run, so only #adult notes are here and links to
// unpublished notes are already scrubbed. As a second lock, a note whose status is not #adult is skipped.
//
// Usage: npx tsx book/build.ts [REPO_DIR] [--out DIR] [--dev]
//   --dev ships the tuning kit (book/dev.ts). Live builds never pass it; they are minified, with no comments.
//
// Every note is its own static page at /<slug>, rendered here, so it reads with JavaScript off. The script only
// adds the markdown toggle and the strip in the footer; the index picks its hero with a tiny inline script.

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import * as esbuild from "esbuild"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import { toHast } from "mdast-util-to-hast"
import { toHtml } from "hast-util-to-html"
import { slugifyFilePath, type FilePath } from "../quartz/util/path"
import { statusOf } from "../quartz/plugins/filters/adult"

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i > -1 ? args.splice(i, 2)[1] : undefined
}
const has = (name: string) => {
  const i = args.indexOf(name)
  return i > -1 ? (args.splice(i, 1), true) : false
}
const DEV = has("--dev")
const OUT_ARG = flag("--out")
const REPO = path.resolve(args[0] ?? path.join(import.meta.dirname, ".."))
const CONTENT = path.join(REPO, "content")
const NOTES_DIR = path.join(CONTENT, "2 - atomic notes")
const ATTACH_DIR = path.join(CONTENT, "7 - attachments")
const OUT = path.resolve(OUT_ARG ?? path.join(REPO, "public"))
const HERE = import.meta.dirname

const SITE = "https://writing.ethanlawcorn.com"
const NAME = "Ethan Law Corn"
// Ethan's words (2026-10-20), set as a short signed letter under the hero
const INTRO =
  "Hi, these are from my notes which are automatically published. Most of my views will be wrong, so hit me and let me know why."
const SIGN = "E"
// where to find Ethan, as words (never the bare address); only on the index, under his note, which asks readers to write
const LINKS: [string, string][] = [
  ["Homepage", "https://ethanlawcorn.com"],
  ["GitHub", "https://github.com/ethancorn21"],
  ["LinkedIn", "https://www.linkedin.com/in/ethancorn/"],
  ["Email", "mailto:ethancorn82@gmail.com"],
  ["Spotify", "https://open.spotify.com/user/ethancorn-us"],
]
const ELSEWHERE = `<div class="elsewhere">${LINKS.map(([t, u]) => `<a href="${u}">${t}</a>`).join(" ")}</div>`
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const fail = (msg: string): never => {
  console.error(`[book] ERROR ${msg}`)
  process.exit(1)
}
const log = (msg: string) => console.log(`[book] ${msg}`)

if (!fs.existsSync(NOTES_DIR)) fail(`no notes folder at ${NOTES_DIR}`)

// ---------- parse ----------

// Vault notes have no YAML. Header lines (date, status, tags) run until a blank line or a --- rule. Only the date is
// used: the tags lead nowhere on this site (Ethan 2026-10-20 cut them from the meta line).
function parseNote(file: string) {
  const raw = fs.readFileSync(path.join(NOTES_DIR, file), "utf8").replace(/\r\n/g, "\n")
  const lines = raw.split("\n")
  let i = 0
  while (i < lines.length && lines[i].trim() === "") i++ // some notes start with a blank line
  let date: string | null = null
  let time = ""
  for (; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l === "" || /^-{3,}$/.test(l)) break
    const dm = l.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?/)
    if (dm && !date) {
      date = dm[1]
      time = (dm[2] ?? "").padStart(5, "0")
    }
  }
  // skip the separator and blank lines, then an optional "# Title" (the file name is the title)
  while (i < lines.length && (lines[i].trim() === "" || /^-{3,}$/.test(lines[i].trim()))) i++
  if (i < lines.length && /^#(\s|$)/.test(lines[i])) i++
  const body = lines.slice(i).join("\n").replace(/^\s+/, "").replace(/\s+$/, "")
  return { raw, date, time, body }
}

const files = fs
  .readdirSync(NOTES_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort((a, b) => a.localeCompare(b))
const parsed = files
  .map((f) => ({ file: f, name: f.replace(/\.md$/, ""), ...parseNote(f) }))
  .filter((p) => {
    if (statusOf(p.raw) === "adult") return true
    log(`skipped ${p.name}: not #adult`)
    return false
  })
if (!parsed.length) fail("no notes to publish")
const byName = new Map(parsed.map((p, i) => [p.name.toLowerCase(), i]))

// ---------- addresses: /<slug>, lower case; the old Quartz slug is kept for redirects ----------

const clean = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "note"
const RESERVED = new Set(["assets", "att", "index", "404", "icon"])
const used = new Set<string>()
const slugs = parsed.map((p) => {
  const base = clean(p.name)
  let s = base
  for (let n = 2; RESERVED.has(s) || used.has(s); n++) s = `${base}-${n}`
  used.add(s)
  return s
})
const oldSlugs = parsed.map(
  (p) =>
    slugifyFilePath(`2 - atomic notes/${p.file}` as FilePath)
      .split("/")
      .pop()!,
)

// ---------- attachments: ![[file]] embeds become images copied next to the pages ----------

const attachments = new Map<string, string>() // file name -> url
const attachFiles = fs.existsSync(ATTACH_DIR) ? fs.readdirSync(ATTACH_DIR) : []
function resolveEmbed(target: string): string | null {
  const t = target.trim()
  const candidates = /\.excalidraw$/i.test(t) ? [t + ".svg", t + ".png"] : [t, t + ".svg"]
  for (const c of candidates) {
    const hit = attachFiles.find((f) => f.toLowerCase() === c.toLowerCase())
    if (hit && /\.(png|jpe?g|gif|webp|svg)$/i.test(hit)) {
      const url = "/att/" + encodeURIComponent(hit)
      attachments.set(hit, url)
      return url
    }
  }
  return null
}
function rewriteEmbeds(body: string, note: string): string {
  return body.replace(
    /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,
    (whole, target: string, opt?: string) => {
      if (byName.has(target.trim().toLowerCase())) return `[[${target.trim()}]]` // embedded note: show as a link
      const url = resolveEmbed(target)
      if (!url) {
        log(`warning: ${note}: embed ${whole} has no image in 7 - attachments, dropped`)
        return ""
      }
      const width = /^\d+$/.test((opt ?? "").trim()) ? ` "${opt!.trim()}"` : "" // ![[x.jpg|400]]
      return `![${target.trim().replace(/\.[a-z]+$/i, "")}](<${url}>${width})`
    },
  )
}

// wiki links become ordinary links on a private scheme, so the markdown parser handles them like any other
const WIKI = /(?<!!)\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/g
const enc = (s: string) =>
  encodeURIComponent(s).replace(/[()]/g, (c) => "%" + c.charCodeAt(0).toString(16))
function rewriteWiki(body: string): string {
  return body.replace(WIKI, (_, target: string, _heading?: string, alias?: string) => {
    const t = target.trim()
    const a = alias?.trim()
    return a
      ? `[${a.replace(/[\\[\]]/g, "\\$&")}](wikia:${enc(t)})`
      : `[${t.replace(/[\\[\]]/g, "\\$&")}](wiki:${enc(t)})`
  })
}

// ---------- markdown -> html, with the marks it was written with kept as hidden spans ("Show markdown") ----------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
// straight quotes as typed become curly ones (the canvas set them that way); code keeps its own
const smart = (s: string) =>
  s
    .replace(/(^|[\s([{\u2014\u2013-])"(?=\S)/g, "$1\u201c")
    .replace(/"/g, "\u201d")
    .replace(/([\p{L}\p{N}])'/gu, "$1\u2019")
    .replace(/(^|[\s([{\u2014\u2013-])'(?=\S)/g, "$1\u2018")
    .replace(/'/g, "\u2019")
const mk = (s: string) => `<span class="mk">${esc(s)}</span>`
const mkBlock = (s: string) => `<span class="mk mk-block">${esc(s)}</span>`
const LABEL = /^(see also|reference|references|related|sources?)\s*:?\s*$/i

type Ctx = { src: string; out: Set<number>; self: number; quote: boolean }
type Node = {
  type: string
  value?: string
  children?: Node[]
  position?: { start: { offset?: number } }
  [k: string]: any
}

const plain = (n: Node): string =>
  n.type === "html"
    ? ""
    : n.type === "break"
      ? " "
      : typeof n.value === "string"
        ? n.value
        : (n.children ?? []).map(plain).join("")
// the mark as typed (* or _, ** or __, - or * or +), read back from the source
const typed = (ctx: Ctx, n: Node, len: number, ok: RegExp, dflt: string) => {
  const o = n.position?.start.offset
  const s = o == null ? "" : ctx.src.slice(o, o + len)
  return ok.test(s) ? s : dflt
}
const fallback = (n: Node) => toHtml(toHast(n as any) as any).replace(/ href="wikia?:[^"]*"/g, "")
const safeUrl = (u: string) =>
  /^(https?:|mailto:|\/|#)/i.test(u) ? u : /^[a-z][a-z0-9+.-]*:/i.test(u) ? null : u

function inline(nodes: Node[], ctx: Ctx): string {
  return nodes.map((n) => phrase(n, ctx)).join("")
}
function phrase(n: Node, ctx: Ctx): string {
  switch (n.type) {
    case "text":
      return esc(smart(n.value!))
    case "emphasis": {
      const c = typed(ctx, n, 1, /^[*_]$/, "*")
      return `${mk(c)}<em>${inline(n.children!, ctx)}</em>${mk(c)}`
    }
    case "strong": {
      const c = typed(ctx, n, 2, /^(\*\*|__)$/, "**")
      return `${mk(c)}<strong>${inline(n.children!, ctx)}</strong>${mk(c)}`
    }
    case "delete":
      return `${mk("~~")}<del>${inline(n.children!, ctx)}</del>${mk("~~")}`
    case "inlineCode":
      return `<code>${mk("`")}${esc(n.value!)}${mk("`")}</code>`
    case "break":
      return "<br>"
    case "link":
      return link(n, ctx)
    case "image":
      return image(n)
    case "html":
      return esc(n.value!)
    default:
      return fallback(n)
  }
}
function link(n: Node, ctx: Ctx): string {
  const text = inline(n.children!, ctx)
  const m = /^(wikia?):(.*)$/.exec(n.url)
  if (m) {
    let target = m[2]
    try {
      target = decodeURIComponent(target)
    } catch {}
    const open = m[1] === "wikia" ? `[[${target}|` : "[["
    const j = byName.get(target.toLowerCase())
    // a link to a note that is not published (source material, an index) or to itself stays as words
    if (j == null || j === ctx.self) return `${mk(open)}${text}${mk("]]")}`
    ctx.out.add(j)
    return `${mk(open)}<a href="/${slugs[j]}">${text}</a>${mk("]]")}`
  }
  const href = safeUrl(n.url)
  return `${mk("[")}${href ? `<a href="${esc(href)}">${text}</a>` : text}${mk(`](${n.url})`)}`
}
function image(n: Node): string {
  const width = /^\d+$/.test(n.title ?? "") ? ` width="${n.title}"` : ""
  const typedAs = n.url.startsWith("/att/")
    ? `![[${decodeURIComponent(n.url.slice(5))}]]`
    : `![${n.alt ?? ""}](${n.url})`
  return `${mkBlock(typedAs)}<img src="${esc(n.url)}" alt="${esc(n.alt ?? "")}"${width} loading="lazy" decoding="async">`
}
function blocks(nodes: Node[], ctx: Ctx): string {
  return nodes.map((n) => block(n, ctx)).join("")
}
function block(n: Node, ctx: Ctx): string {
  switch (n.type) {
    case "paragraph": {
      const kids = n.children!
      if (
        kids.some((c) => c.type === "image") &&
        kids.every(
          (c) =>
            c.type === "image" || c.type === "break" || (c.type === "text" && !c.value!.trim()),
        )
      )
        return `<figure>${inline(
          kids.filter((c) => c.type === "image"),
          ctx,
        )}</figure>`
      return `<p>${ctx.quote ? mk("> ") : ""}${inline(kids, ctx)}</p>`
    }
    case "heading":
      return heading(n, ctx)
    case "thematicBreak":
      return `<hr>${mkBlock("---")}`
    case "list":
      return list(n, ctx)
    case "blockquote":
      return `<blockquote>${blocks(n.children!, { ...ctx, quote: true })}</blockquote>`
    case "code":
      return `<pre><code>${mk("```" + (n.lang ?? "") + "\n")}${esc(n.value!)}${mk("\n```")}</code></pre>`
    case "html":
      return `<p>${esc(n.value!)}</p>`
    case "table":
      return `<div class="table">${fallback(n)}</div>`
    case "definition":
      return ""
    default:
      return fallback(n)
  }
}
function heading(n: Node, ctx: Ctx): string {
  const text = plain(n).trim()
  if (!text) return ""
  const d = Math.max(2, n.depth) // the note's title is the page's only h1
  const typedAs = mk("#".repeat(n.depth) + " ")
  // a closing "see also:" or "Reference" reads as a quiet label, like the index's months
  if (LABEL.test(text)) {
    const t = text.replace(/\s*:\s*$/, "")
    return `<h${d} class="label">${typedAs}${esc(t[0].toUpperCase() + t.slice(1))}</h${d}>`
  }
  return `<h${d}>${typedAs}${inline(n.children!, ctx)}</h${d}>`
}
function list(n: Node, ctx: Ctx): string {
  const tag = n.ordered ? "ol" : "ul"
  const first = n.start ?? 1
  const items = n
    .children!.map((li, i) => {
      const bullet = n.ordered ? `${first + i}. ` : `${typed(ctx, li, 1, /^[-*+]$/, "-")} `
      const task = li.checked == null ? "" : mk(li.checked ? "[x] " : "[ ] ")
      const inner =
        n.spread || li.spread
          ? blocks(li.children!, ctx)
          : li
              .children!.map((c) =>
                c.type === "paragraph" ? inline(c.children!, ctx) : block(c, ctx),
              )
              .join("")
      return `<li>${mk(bullet)}${task}${inner}</li>`
    })
    .join("")
  return `<${tag}${n.ordered && first !== 1 ? ` start="${first}"` : ""}>${items}</${tag}>`
}

// a "see also" left with nothing under it (its only line was an embed that has no image) goes, and so does a rule
// that then closes the note
function prune(kids: Node[]) {
  for (let i = kids.length - 1; i >= 0; i--) {
    const k = kids[i]
    if (k.type !== "heading" || !LABEL.test(plain(k).trim())) continue
    const next = kids[i + 1]
    if (
      !next ||
      (next.type === "heading" && next.depth <= k.depth) ||
      next.type === "thematicBreak"
    )
      kids.splice(i, 1)
  }
  while (kids.length && kids[kids.length - 1].type === "thematicBreak") kids.pop()
}

const md = unified().use(remarkParse).use(remarkGfm)
function render(body: string, self: number) {
  const src = rewriteWiki(body)
  const tree = md.parse(src) as unknown as Node
  prune(tree.children!)
  const ctx: Ctx = { src, out: new Set(), self, quote: false }
  const firstPara = tree.children!.find((c) => c.type === "paragraph" && plain(c).trim())
  return {
    html: blocks(tree.children!, ctx),
    out: [...ctx.out],
    lead: firstPara ? smart(plain(firstPara).replace(/\s+/g, " ").trim()) : "",
  }
}

// ---------- notes ----------

const notes = parsed.map((p, i) => ({
  ...p,
  slug: slugs[i],
  old: oldSlugs[i],
  ...render(rewriteEmbeds(p.body, p.name), i),
}))
const linkedFrom = notes.map((_, i) =>
  notes
    .map((n, j) => (n.out.includes(i) ? j : -1))
    .filter((j) => j > -1)
    .sort((a, b) => notes[a].name.localeCompare(notes[b].name)),
)

const day = (d: string) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`
const describe = (s: string) => (s.length <= 160 ? s : s.slice(0, 157).replace(/\s+\S*$/, "") + "…")

// ---------- assets: content-hashed names under /assets, cached for a year ----------

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const hash = (b: Buffer | string | Uint8Array) =>
  crypto.createHash("sha256").update(b).digest("hex").slice(0, 10)
function emit(rel: string, b: Buffer | string | Uint8Array): string {
  const ext = path.extname(rel)
  const out = `${rel.slice(0, -ext.length)}.${hash(b)}${ext}`
  fs.mkdirSync(path.dirname(path.join(OUT, out)), { recursive: true })
  fs.writeFileSync(path.join(OUT, out), b)
  return "/" + out
}

const fontUrl = new Map<string, string>()
const fontsCss = fs
  .readFileSync(path.join(HERE, "fonts.css"), "utf8")
  .replace(/\/assets\/fonts\/([\w.-]+\.woff2)/g, (_, f: string) => {
    if (!fontUrl.has(f))
      fontUrl.set(f, emit(`assets/fonts/${f}`, fs.readFileSync(path.join(HERE, "fonts", f))))
    return fontUrl.get(f)!
  })
for (const f of fs.readdirSync(path.join(HERE, "fonts")).filter((f) => f.startsWith("OFL")))
  fs.copyFileSync(path.join(HERE, "fonts", f), path.join(OUT, "assets", "fonts", f))
// the two faces above the fold: Literata for reading, Cormorant for the title
const PRELOAD = ["literata-roman-latin.woff2", "cormorant-roman-latin.woff2"]
  .map(
    (f) => `<link rel="preload" href="${fontUrl.get(f)}" as="font" type="font/woff2" crossorigin>`,
  )
  .join("")

const minify = async (code: string, loader: "css" | "js") =>
  (
    await esbuild.transform(code, {
      loader,
      minify: true,
      legalComments: "none",
      target: loader === "js" ? "es2020" : undefined,
    })
  ).code.trim()
const CSS = await minify(
  [fontsCss, fs.readFileSync(path.join(HERE, "book.css"), "utf8")].join("\n"),
  "css",
)
async function bundle(entry: string, name: string) {
  const r = await esbuild.build({
    entryPoints: [path.join(HERE, entry)],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2020",
    legalComments: "none",
    charset: "utf8",
    write: false,
  })
  return emit(`assets/${name}.js`, r.outputFiles[0].contents)
}
const JS = await bundle("client.ts", "book")
const DEV_JS = DEV ? await bundle("dev.ts", "dev") : ""

// html: the class "js" shows what only works with the script; "md" is the reader's markdown toggle, kept across notes
const HEAD_JS = await minify(
  `const r=document.documentElement;r.classList.add("js");try{if(localStorage.getItem("md")==="1")r.classList.add("md")}catch(e){}`,
  "js",
)
const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c")

function shell(o: {
  title: string
  ogTitle?: string
  desc: string
  url?: string
  type?: string
  body: string
  head?: string
}) {
  const og = o.url
    ? `<link rel="canonical" href="${SITE}${o.url}"><meta property="og:site_name" content="${NAME}"><meta property="og:type" content="${o.type ?? "website"}">` +
      `<meta property="og:title" content="${esc(o.ogTitle ?? o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:url" content="${SITE}${o.url}">`
    : ""
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(o.title)}</title><meta name="description" content="${esc(o.desc)}"><meta name="color-scheme" content="only light">` +
    `<meta name="theme-color" content="#FDFCFA"><link rel="icon" href="/mark-64.png" sizes="64x64">` +
    `<link rel="icon" href="/mark.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">` +
    `${og}${PRELOAD}<style>${CSS}</style>` +
    `<script>${HEAD_JS}${o.head ?? ""}</script></head><body>${o.body}<script src="${JS}" defer></script>` +
    (DEV_JS ? `<script src="${DEV_JS}" defer></script>` : "") +
    `</body></html>\n`
  )
}
// the footer, an old print the width of the page with one modern thing in it that moves (book/strips): the script
// draws one of strips.json at random and fetches only its print
const strips = (
  JSON.parse(fs.readFileSync(path.join(HERE, "strips", "strips.json"), "utf8")) as {
    key: string
    file: string
    alt: string
  }[]
).map((s) => ({
  k: s.key,
  url: emit(`assets/strips/${s.file}`, fs.readFileSync(path.join(HERE, "strips", s.file))),
  alt: s.alt,
}))
if (!strips.length) fail("no strips in book/strips/strips.json")
const FOOT = `<footer class="strip-foot" data-strips="${esc(JSON.stringify(strips))}"><canvas role="img"></canvas></footer>`

// ---------- index: the hero (one drawn at random when heroes.json lists several), the intro, every note by month ----------

const heroes = (
  JSON.parse(fs.readFileSync(path.join(HERE, "hero", "heroes.json"), "utf8")) as {
    key: string
    file: string
    w: number
    h: number
    artist: string
    work: string
    year: string
    kind: string
    caption?: boolean
  }[]
).map((h) => {
  const url = emit(`assets/hero/${h.file}`, fs.readFileSync(path.join(HERE, "hero", h.file)))
  const alt = `${h.artist}, ${h.work}, redrawn as a grid of ${h.kind}`
  return {
    k: h.key,
    html: `<figure class="hero" style="--ar:${(h.w / h.h).toFixed(4)}"><img src="${url}" alt="${esc(alt)}" width="${h.w}" height="${h.h}" fetchpriority="high">${h.caption === false ? "" : `<figcaption>${esc(h.artist)}, <em>${esc(h.work)}</em>, ${esc(h.year)}</figcaption>`}</figure>`,
  }
})
if (!heroes.length) fail("no hero pictures in book/hero/heroes.json")
// ?hero=<key> pins one; otherwise a random one, never the same twice in a row
const HERO_JS = await minify(
  `(()=>{const H=${json(heroes)},n=H.length;let i=H.findIndex(h=>h.k===new URLSearchParams(location.search).get("hero"));
if(i<0){let p=-1;try{const v=localStorage.getItem("hero");if(v!==null)p=+v}catch(e){}
const skip=p>=0&&p<n&&n>1;i=Math.floor(Math.random()*(skip?n-1:n));if(skip&&i>=p)i++;try{localStorage.setItem("hero",String(i))}catch(e){}}
document.currentScript.insertAdjacentHTML("beforebegin",H[i].html)})()`,
  "js",
)
// Garden Strata's addresses (/?n=<slug>, /#note-<slug>) land on the note's page
const legacy = Object.fromEntries(
  notes.filter((n) => clean(n.old) !== n.slug).map((n) => [n.old, n.slug]),
)
const LEGACY_JS = await minify(
  `(()=>{let s=new URLSearchParams(location.search).get("n");const h=/^#note-(.+)/.exec(location.hash);if(!s&&h)try{s=decodeURIComponent(h[1])}catch(e){s=h[1]}
if(!s)return;const m=${json(legacy)};location.replace("/"+(m[s]||s.normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")))})()`,
  "js",
)

const groups = new Map<string, typeof notes>()
const order = [...notes].sort(
  (a, b) =>
    ((b.date ?? "") + b.time).localeCompare((a.date ?? "") + a.time) ||
    a.name.localeCompare(b.name),
)
for (const n of order) {
  const label = n.date ? `${MONTHS[+n.date.slice(5, 7) - 1]} ${n.date.slice(0, 4)}` : "Undated"
  if (!groups.has(label)) groups.set(label, [])
  groups.get(label)!.push(n)
}
const toc =
  `<nav class="toc" aria-label="All notes">` +
  [...groups]
    .map(
      ([label, list]) =>
        `<section><h2 class="label">${label}</h2><ul>${list.map((n) => `<li><a href="/${n.slug}">${esc(n.name)}</a></li>`).join("")}</ul></section>`,
    )
    .join("") +
  `</nav>`
fs.writeFileSync(
  path.join(OUT, "index.html"),
  shell({
    title: NAME,
    desc: `A digital commonplace notebook by ${NAME}: short notes on ideas, each connected to the others.`,
    url: "/",
    head: LEGACY_JS,
    body:
      `<div class="col index"><script>${HERO_JS}</script><noscript>${heroes[0].html}</noscript>` +
      `<section class="intro letter"><h1 class="vh">${NAME}</h1><p>${esc(INTRO)}</p><p class="sign">— ${SIGN}</p>${ELSEWHERE}</section>${toc}</div>${FOOT}`,
  }),
)

// ---------- note pages ----------

for (const [i, n] of notes.entries()) {
  // the meta line is the date alone: reading time was 1 or 2 minutes on every note, and the tags led nowhere (Ethan
  // 2026-10-20). No links row and no footer strip under a note either; Ethan is making a different footer for notes
  const meta = n.date ? `<p class="meta">${day(n.date)}</p>` : ""
  const back = linkedFrom[i].length
    ? `<section class="backlinks"><h2 class="label">Linked from</h2><ul>${linkedFrom[i].map((j) => `<li><a href="/${notes[j].slug}">${esc(notes[j].name)}</a></li>`).join("")}</ul></section>`
    : ""
  fs.writeFileSync(
    path.join(OUT, `${n.slug}.html`),
    shell({
      title: `${n.name} · ${NAME}`,
      ogTitle: n.name,
      desc: describe(n.lead || n.name),
      url: `/${n.slug}`,
      type: "article",
      body:
        `<div class="col note"><header class="bar"><a href="/">Index</a><button type="button" data-md hidden aria-pressed="false">Show markdown</button></header>` +
        `<article><header class="head"><h1 class="title">${mk("# ")}${esc(n.name)}</h1>${meta}</header>` +
        `<div class="body">${n.html}</div>${back}</article></div>`,
    }),
  )
}

// ---------- 404, attachments, redirects, headers ----------

fs.writeFileSync(
  path.join(OUT, "404.html"),
  shell({
    title: `Not found · ${NAME}`,
    desc: "No note lives at this address.",
    body:
      `<div class="col lost"><section class="intro"><h1 class="title">Not here</h1>` +
      `<p>No note lives at this address. Every note is listed on the <a href="/">index</a>.</p></section></div>${FOOT}`,
  }),
)
// photos come straight from the vault (one is 17 MB at 5872 px); anything wider than twice the column is scaled down
// to that, same name and format. If sharp fails, the original goes out as it was.
const MAX_W = 1400
let sharp: any = null
try {
  sharp = (await import("sharp")).default
} catch {
  log("warning: sharp did not load, attachments copied as they are")
}
if (attachments.size) fs.mkdirSync(path.join(OUT, "att"), { recursive: true })
for (const [file] of attachments) {
  const from = path.join(ATTACH_DIR, file),
    to = path.join(OUT, "att", file)
  const ext = path.extname(file).toLowerCase()
  try {
    if (!sharp || ![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) throw 0
    const img = sharp(from, { failOn: "none" }).rotate()
    if (((await img.metadata()).width ?? 0) <= MAX_W) throw 0
    const sized = img.resize({ width: MAX_W, withoutEnlargement: true })
    const buf = await (
      ext === ".png"
        ? sized.png({ compressionLevel: 9 })
        : ext === ".webp"
          ? sized.webp({ quality: 82 })
          : sized.jpeg({ quality: 82, mozjpeg: true })
    ).toBuffer()
    fs.writeFileSync(to, buf)
    log(
      `${file}: scaled to ${MAX_W} px wide, ${Math.round(fs.statSync(from).size / 1024)} -> ${Math.round(buf.length / 1024)} KB`,
    )
  } catch (e) {
    if (e !== 0) log(`warning: ${file}: could not scale (${(e as Error).message}), copied as it is`)
    fs.copyFileSync(from, to)
  }
}
// tab icon: the signed E (book/icon/), served from the site root
for (const f of fs.readdirSync(path.join(HERE, "icon")))
  fs.copyFileSync(path.join(HERE, "icon", f), path.join(OUT, f))

// old Quartz addresses: notes go to their page, everything else to the index
const redirects = [
  ...notes.flatMap((n) => [
    `/2---atomic-notes/${n.old} /${n.slug} 301`,
    `/2---atomic-notes/${n.old}.html /${n.slug} 301`,
  ]),
  "/2---atomic-notes/* / 302",
  "/3---source-material/* / 302",
  "/4---tags/* / 302",
  "/5---indexes/* / 302",
  "/tags/* / 302",
]
fs.writeFileSync(path.join(OUT, "_redirects"), redirects.join("\n") + "\n")
fs.writeFileSync(
  path.join(OUT, "_headers"),
  [
    "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n",
    "/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n",
    "/att/*\n  Cache-Control: public, max-age=2592000\n",
  ].join("\n"),
)

log(
  `${notes.length} notes, ${notes.reduce((a, n) => a + n.out.length, 0)} links, ${groups.size} months, ${attachments.size} images, ` +
    `${heroes.length} heroes, ${strips.length} strips${DEV ? ", dev kit" : ""} -> ${OUT}`,
)
