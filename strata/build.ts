// strata/build.ts — build the Garden Strata site (USGS block-diagram view of the atomic notes) into public/.
//
// Replaces `npx quartz build` when SITE_ENGINE=strata (see scripts/lib/03-build.sh).
// Input is the repo content AFTER the publish gate has run, so only #adult notes are here and links to
// unpublished notes are already scrubbed. This script does not decide what is public.
//
// Usage: npx tsx strata/build.ts [REPO_DIR] [--out DIR] [--date YYYY-MM-DD]
//
// One level per calendar month, from the first dated note to the build month. A month with no notes still
// gets a (thin) level, so a new level appears every month without anyone touching this code.

import fs from "node:fs"
import path from "node:path"
import { slugifyFilePath, type FilePath } from "../quartz/util/path"
import { statusOf } from "../quartz/plugins/filters/adult"

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i > -1 ? args.splice(i, 2)[1] : undefined
}
const OUT_ARG = flag("--out")
const DATE_ARG = flag("--date")
const REPO = path.resolve(args[0] ?? path.join(import.meta.dirname, ".."))
const CONTENT = path.join(REPO, "content")
const NOTES_DIR = path.join(CONTENT, "2 - atomic notes")
const ATTACH_DIR = path.join(CONTENT, "7 - attachments")
const OUT = path.resolve(OUT_ARG ?? path.join(REPO, "public"))
const HERE = import.meta.dirname

type Topic = { tag?: string; code: string; name: string; g: number; kind?: "other" | "none" }
type Note = {
  n: string // file name without .md; what wiki links point at
  k: string // url slug, same as Quartz's, so old links can be redirected
  d: string | null // written date
  m: number // level: 0 basement (undated), 1.. months
  s: "a" | "b" | "u" // status: adult, baby, unstated
  w: number // words
  p: number // principal topic index
  g: string[] // tags, lower case
  b: string // markdown body, title heading removed
  o: number[] // outgoing links (indices)
}

const fail = (msg: string): never => {
  console.error(`[strata] ERROR ${msg}`)
  process.exit(1)
}
const log = (msg: string) => console.log(`[strata] ${msg}`)

if (!fs.existsSync(NOTES_DIR)) fail(`no notes folder at ${NOTES_DIR}`)

// ---------- parse ----------

// Vault notes have no YAML. Header lines (date, status, tags) run until a blank line or a --- rule.
function parseNote(file: string) {
  const raw = fs.readFileSync(path.join(NOTES_DIR, file), "utf8").replace(/\r\n/g, "\n")
  const lines = raw.split("\n")
  let i = 0
  while (i < lines.length && lines[i].trim() === "") i++ // some notes start with a blank line
  let date: string | null = null
  let status: Note["s"] = "u"
  const tags: string[] = []
  for (; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l === "" || /^-{3,}$/.test(l)) break
    const dm = l.match(/^(\d{4}-\d{2}-\d{2})\b/)
    if (dm && !date) date = dm[1]
    if (/^tags:/i.test(l))
      for (const t of l.matchAll(/\[\[([^\]|#]+)/g)) tags.push(t[1].trim().toLowerCase())
  }
  // skip the separator and blank lines, then an optional "# Title"
  while (i < lines.length && (lines[i].trim() === "" || /^-{3,}$/.test(lines[i].trim()))) i++
  if (i < lines.length && /^#\s+/.test(lines[i])) i++
  const body = lines.slice(i).join("\n").replace(/^\s+/, "").replace(/\s+$/, "")
  // status comes from the publish gate's own parser, so the site and the gate never disagree
  const st = statusOf(raw)
  status = st === "adult" ? "a" : st === "baby" ? "b" : "u"
  return { date, status, tags: [...new Set(tags)], body }
}

const files = fs
  .readdirSync(NOTES_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort((a, b) => a.localeCompare(b))
if (!files.length) fail("no notes to draw")
const parsed = files.map((f) => ({ file: f, name: f.replace(/\.md$/, ""), ...parseNote(f) }))
const byName = new Map(parsed.map((p, i) => [p.name.toLowerCase(), i]))

// ---------- attachments: ![[file]] embeds become images copied next to the page ----------

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
  return body.replace(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (whole, target: string) => {
    if (byName.has(target.trim().toLowerCase())) return `[[${target.trim()}]]` // embedded note: show as a link
    const url = resolveEmbed(target)
    if (!url) {
      log(`warning: ${note}: embed ${whole} has no image in 7 - attachments, dropped`)
      return ""
    }
    return `![${target.trim().replace(/\.[a-z]+$/i, "")}](${url})`
  })
}

// ---------- levels ----------

const built = DATE_ARG ?? new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(built)) fail(`bad --date ${built}`)
const dated = parsed
  .map((p) => p.date)
  .filter((d): d is string => !!d)
  .sort()
const firstMonth = (dated[0] ?? built).slice(0, 7)
const lastMonth = [built.slice(0, 7), (dated.at(-1) ?? built).slice(0, 7)].sort().at(-1)!
const months: string[] = []
for (let [y, m] = firstMonth.split("-").map(Number); ; ) {
  const key = `${y}-${String(m).padStart(2, "0")}`
  months.push(key)
  if (key >= lastMonth) break
  m++
  if (m > 12) {
    m = 1
    y++
  }
}

// ---------- topics ----------

const cfg = JSON.parse(fs.readFileSync(path.join(HERE, "topics.json"), "utf8")) as {
  principal: Required<Pick<Topic, "tag" | "code" | "name" | "g">>[]
}
const topics: Topic[] = [
  ...cfg.principal.map((t) => ({ tag: t.tag, code: t.code, name: t.name, g: t.g })),
  { code: "To", name: "Other tags", g: 3, kind: "other" },
  { code: "pC", name: "Untagged", g: 4, kind: "none" },
]
const OTHER = topics.length - 2
const NONE = topics.length - 1
const tagCount = new Map<string, number>()
for (const p of parsed) for (const t of p.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
function principal(tags: string[]): number {
  let best = -1
  for (const t of tags) {
    const k = topics.findIndex((x) => x.tag === t)
    if (k < 0) continue
    if (best < 0 || (tagCount.get(t) ?? 0) < (tagCount.get(topics[best].tag!) ?? 0)) best = k
  }
  return best > -1 ? best : tags.length ? OTHER : NONE
}

// ---------- notes ----------

const notes: Note[] = parsed.map((p) => {
  const body = rewriteEmbeds(p.body, p.name)
  const out = new Set<number>()
  for (const l of body.matchAll(/(?<!!)\[\[([^\]|#]+)/g)) {
    const j = byName.get(l[1].trim().toLowerCase())
    if (j != null && j !== byName.get(p.name.toLowerCase())) out.add(j)
  }
  const slug = slugifyFilePath(`2 - atomic notes/${p.file}` as FilePath)
  return {
    n: p.name,
    k: slug.split("/").pop()!,
    d: p.date,
    m: p.date ? months.indexOf(p.date.slice(0, 7)) + 1 : 0,
    s: p.status,
    w: body.split(/\s+/).filter(Boolean).length,
    p: principal(p.tags),
    g: p.tags,
    b: body,
    o: [...out].sort((a, b) => a - b),
  }
})
const keys = new Set<string>()
for (const n of notes) {
  if (keys.has(n.k)) fail(`two notes share the slug ${n.k}`)
  keys.add(n.k)
}

// hub notes: the most linked, about eight of them, never fewer than 3 links
const degree = notes.map((n, i) => n.o.length + notes.filter((x) => x.o.includes(i)).length)
const ranked = [...degree].sort((a, b) => b - a)
const hubMin = Math.max(3, ranked[Math.min(7, ranked.length - 1)] ?? 3)

const data = {
  months,
  notes,
  topics,
  hubMin,
  allAdult: notes.every((n) => n.s === "a"),
  built,
}

// ---------- write ----------

const template = fs.readFileSync(path.join(HERE, "template.html"), "utf8")
const marker = "/*__STRATA_DATA__*/null"
if (!template.includes(marker)) fail("template has no data marker")
// JSON inside <script>: escape < so a note can never close the tag
const LS = String.fromCharCode(0x2028),
  PS = String.fromCharCode(0x2029)
const json = JSON.stringify(data)
  .replace(/</g, "\\u003c")
  .split(LS)
  .join("\\u2028")
  .split(PS)
  .join("\\u2029")
const page = template.replace(marker, json)

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, "att"), { recursive: true })
fs.writeFileSync(path.join(OUT, "index.html"), page)
for (const [file] of attachments)
  fs.copyFileSync(path.join(ATTACH_DIR, file), path.join(OUT, "att", file))
const icon = path.join(REPO, "quartz", "static", "icon.png")
if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(OUT, "icon.png"))

fs.writeFileSync(
  path.join(OUT, "404.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Not found</title><style>body{margin:0;padding:64px 16px;background:#CFC2A4;color:#2E241D;font:16px/1.5 Georgia,serif;text-align:center}
a{color:#2E241D;text-decoration-color:#CE2E4E;text-decoration-thickness:2px}</style></head>
<body><p>No page here. The notes live on the <a href="/">block diagram</a>.</p></body></html>\n`,
)

// old Quartz addresses: notes go to their place on the block, everything else to the block
const redirects = [
  ...notes.flatMap((n) => [
    `/2---atomic-notes/${n.k} /?n=${encodeURIComponent(n.k)} 301`,
    `/2---atomic-notes/${n.k}.html /?n=${encodeURIComponent(n.k)} 301`,
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
  ["jpg", "jpeg", "png", "gif", "webp", "svg"]
    .map((x) => `/*.${x}\n  Cache-Control: public, max-age=2592000\n`)
    .join("\n") + "\n/\n  Cache-Control: public, max-age=0, must-revalidate\n",
)

log(
  `${notes.length} notes, ${notes.reduce((a, n) => a + n.o.length, 0)} links, ${months.length} months (${months[0]} to ${months.at(-1)}), ` +
    `${notes.filter((n) => n.m === 0).length} undated, ${attachments.size} images -> ${OUT}`,
)
