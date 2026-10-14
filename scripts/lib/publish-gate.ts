// publish-gate.ts - the publish policy, applied in the pipeline container.
//
// Runs in content/ after the vault is synced from S3 and before anything is
// committed, so withheld notes never reach the public repo or the site.
//
//   1. Status gate. A note in "2 - atomic notes" is kept only when its header
//      says `status: #adult` (rule lives in quartz/plugins/filters/adult.ts).
//      #baby, empty, missing: deleted. Default deny.
//   2. Link scrub. In every kept markdown note, links to vault notes that are
//      NOT published are hidden, by how the link sits in its line:
//        - a pointer (a line of only links, "label: [[x]]", "see [[x]]",
//          "(see [[x]])", or a link left standing after a finished sentence) is
//          removed; a line left with nothing is dropped, and so is a section
//          left empty;
//        - a link that is a word in a sentence is unlinked: the sentence stays
//          and the link shows as plain text (its alias if it had one);
//        - embeds of unpublished files are removed.
//      Links to notes that do not exist anywhere are left alone.
//
// Usage:
//   tsx scripts/lib/publish-gate.ts apply   CONTENT_DIR [MANIFEST] [--dry-run]
//   tsx scripts/lib/publish-gate.ts report  CONTENT_DIR
//
// MANIFEST is the vault's file list (relative paths, one per line, written by
// the Mac upload). Without it a link to a note that was never uploaded (rough
// notes, misc) looks like a link to a note that does not exist, and survives.

import fs from "node:fs"
import path from "node:path"
import { PUBLISH_STATUS, statusOf } from "../../quartz/plugins/filters/adult"

const ATOMIC = "2 - atomic notes"
const STAGED_FOLDERS = [ATOMIC, "3 - source material", "4 - tags", "5 - indexes"]
const ATTACHMENTS = "7 - attachments"

const LINK = /(!?)\[\[([^\]|#^]*)([^\]]*)\]\]/g
const LINK_SEP = /^\s*(?:,|;|&|\/|\band\b|\bor\b)?\s*$/i
const CLOSERS = /^[\s.,;:!?)\]"'”’]*$/
const SEE_WORD = /(?:^|[\s(])(?:see(?:\s+also)?|cf\.?)\s*:?\s*$/i
const SEE_ONLY = /^\s*(?:(?:see(?:\s+also)?|cf\.?)\s*:?\s*)?$/i
const LABEL_END = /(?:[:–—]|(?:^|\s)-|->|→)\s*$/
const SENTENCE_END = /[.!?;][\s"'”’)]*$/
const ABBREV_END = /\b(?:e\.g|i\.e|vs|cf|etc)\.?\s*$/i
const PREFIX = /^\s*(?:[-*+]|\d+[.)]|>|#{1,6})*\s*/
const HEADING = /^(#{1,6})[ \t]+\S/
const LIST_ITEM = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]/

// --- name resolution ---------------------------------------------------------

/** Lowercased names and vault-relative paths that wikilinks can resolve to. */
class Index {
  names = new Set<string>()
  paths: string[] = []

  add(rel: string) {
    const lower = rel.toLowerCase()
    this.names.add(lower.slice(lower.lastIndexOf("/") + 1))
    this.paths.push(lower)
    if (lower.endsWith(".md")) {
      const noExt = lower.slice(0, -3)
      this.names.add(noExt.slice(noExt.lastIndexOf("/") + 1))
      this.paths.push(noExt)
    }
  }

  has(target: string): boolean {
    if (!target.includes("/")) return this.names.has(target)
    const t = target.replace(/^\/+/, "")
    return this.paths.some((p) => p === t || p.endsWith("/" + t))
  }
}

function walk(root: string): string[] {
  const out: string[] = []
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (entry.isFile()) out.push(full)
    }
  }
  if (fs.existsSync(root)) visit(root)
  return out.sort()
}

// --- link scrub --------------------------------------------------------------

type Match = RegExpMatchArray

function withheld(m: Match, published: Index, everything: Index): boolean {
  const target = m[2].trim().toLowerCase()
  return target !== "" && !published.has(target) && everything.has(target)
}

/** The words a reader saw for this link: its alias, else the note name. */
function display(m: Match): string {
  const rest = m[3]
  const alias = rest.includes("|") ? rest.slice(rest.indexOf("|") + 1).trim() : ""
  return alias || (m[2].trim().split("/").pop() ?? "").trim()
}

const links = (text: string): Match[] => [...text.matchAll(LINK)]
const end = (m: Match): number => (m.index ?? 0) + m[0].length

/** True when nothing but list/quote/heading markers and punctuation is left. */
function isBlank(text: string): boolean {
  return text.replace(PREFIX, "").replace(/^[ \t.,;:&\-–—]+|[ \t.,;:&\-–—]+$/g, "") === ""
}

/** Embeds of unpublished files (images, notes) cannot render; remove them. */
function dropEmbeds(text: string, published: Index, everything: Index): string {
  return text.replace(LINK, (...a) => {
    const m = a as unknown as Match
    return m[1] && withheld(m, published, everything) ? "" : m[0]
  })
}

/** Remove "(see [[x]])" and "([[x]])" when every link in the parens is unpublished. */
function dropParentheticals(text: string, published: Index, everything: Index): string {
  return text.replace(/[ \t]*\(([^()]*)\)/g, (whole: string, inner: string) => {
    const ls = links(inner)
    if (ls.length === 0 || !ls.every((m) => withheld(m, published, everything))) return whole
    const residual = inner.replace(LINK, "").replace(/[,;&/]|\band\b|\bor\b/gi, " ")
    return SEE_ONLY.test(residual) ? "" : whole
  })
}

/**
 * Handle links that form a pointer at the end of the line. Returns the new text,
 * or null to drop the whole line. A tail of links is a pointer, not part of the
 * sentence, when it follows the start of the line, "see", a ":" or dash label,
 * or the end of a sentence.
 */
function trailingPointer(text: string, published: Index, everything: Index): string | null {
  const ms = links(text)
  if (ms.length === 0 || !CLOSERS.test(text.slice(end(ms[ms.length - 1])))) return text
  const chain = [ms[ms.length - 1]]
  for (let i = ms.length - 2; i >= 0; i--) {
    if (LINK_SEP.test(text.slice(end(ms[i]), chain[0].index))) chain.unshift(ms[i])
    else break
  }
  if (!chain.every((m) => withheld(m, published, everything))) return text

  const pre = text.slice(0, chain[0].index).trimEnd()
  if (isBlank(pre)) return null // the line was only pointers
  const see = SEE_WORD.exec(pre)
  if (see) {
    const head = pre.slice(0, see.index).trimEnd()
    return isBlank(head) ? null : head
  }
  if (LABEL_END.test(pre)) return null // "annotation: [[x]]" exists only to point at x
  if (SENTENCE_END.test(pre) && !ABBREV_END.test(pre)) return pre // link left after a finished sentence
  return text // the links are words in the sentence
}

type Kind = "keep" | "edit" | "drop"

/** Hide unpublished links in one line (no line ending). */
function scrubLine(body: string, published: Index, everything: Index): [string | null, Kind] {
  if (!links(body).some((m) => withheld(m, published, everything))) return [body, "keep"]
  let text: string | null = dropEmbeds(body, published, everything)
  text = dropParentheticals(text, published, everything)
  text = trailingPointer(text, published, everything)
  if (text === null) return [null, "drop"]
  text = text
    .replace(LINK, (...a) => {
      const m = a as unknown as Match
      return withheld(m, published, everything) ? display(m) : m[0]
    })
    .trimEnd()
  if (isBlank(text)) return [null, "drop"]
  return [text, "edit"]
}

type ChangeKind = "drop" | "edit" | "child" | "section"
interface Change {
  kind: ChangeKind
  before: string
  after?: string
}
interface Row {
  line: string
  level: number // heading level, 0 = not a heading
  tainted: boolean
}

/** Hide links to unpublished notes. Returns the new text and what changed. */
function scrubLinks(text: string, published: Index, everything: Index): [string, Change[]] {
  const out: Row[] = []
  const changes: Change[] = []
  const stack: number[] = [] // indexes into `out` of the headings currently open
  let fence: string | null = null
  let skipIndent: number | null = null // indent of a dropped list item; deeper lines go with it

  for (const line of text.split(/(?<=\n)/)) {
    const stripped = line.trim()

    if (fence) {
      if (stripped.startsWith(fence)) fence = null
      out.push({ line, level: 0, tainted: false })
      continue
    }
    if (stripped.startsWith("```") || stripped.startsWith("~~~")) {
      fence = stripped.slice(0, 3)
      skipIndent = null
      out.push({ line, level: 0, tainted: false })
      continue
    }

    if (skipIndent !== null) {
      const indent = line.length - line.replace(/^[ \t]+/, "").length
      if (!stripped) {
        out.push({ line, level: 0, tainted: false })
        continue
      }
      if (indent > skipIndent) {
        changes.push({ kind: "child", before: stripped })
        continue
      }
      skipIndent = null
    }

    const body = line.replace(/\r?\n$/, "")
    const eol = line.slice(body.length)
    const [newBody, how] = scrubLine(body, published, everything)

    if (how === "drop") {
      changes.push({ kind: "drop", before: stripped })
      if (stack.length) out[stack[stack.length - 1]].tainted = true
      const item = LIST_ITEM.exec(line)
      if (item) skipIndent = item[1].length
      continue
    }
    let kept = line
    if (how === "edit") {
      changes.push({ kind: "edit", before: stripped, after: (newBody as string).trim() })
      kept = (newBody as string) + eol
    }

    const heading = HEADING.exec(kept)
    if (heading) {
      const level = heading[1].length
      while (stack.length && out[stack[stack.length - 1]].level >= level) stack.pop()
      out.push({ line: kept, level, tainted: false })
      stack.push(out.length - 1)
    } else {
      out.push({ line: kept, level: 0, tainted: false })
    }
  }

  if (changes.length === 0) return [text, changes]

  // Drop headings the removals left empty (never the H1 title).
  let changed = true
  while (changed) {
    changed = false
    for (let i = out.length - 1; i >= 0; i--) {
      const { line, level, tainted } = out[i]
      if (level <= 1 || !tainted) continue
      let j = i + 1
      while (j < out.length && !out[j].line.trim()) j++
      if (j === out.length || (out[j].level && out[j].level <= level)) {
        changes.push({ kind: "section", before: line.trim() })
        for (let k = i - 1; k >= 0; k--) {
          if (out[k].level > 0 && out[k].level < level) {
            out[k].tainted = true
            break
          }
        }
        out.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return [out.map((r) => r.line).join(""), changes]
}

// --- commands ----------------------------------------------------------------

const rel = (root: string, file: string) => path.relative(root, file).split(path.sep).join("/")

function apply(content: string, manifestFile: string | undefined, dryRun: boolean): number {
  const atomicDir = path.join(content, ATOMIC)
  if (!fs.existsSync(atomicDir)) {
    console.error(`[publish-gate] not a content dir: ${content}`)
    return 1
  }

  // Everything the vault holds, published or not: the content dir as synced
  // (before any deletion) plus the Mac's manifest of files that were never uploaded.
  const everything = new Index()
  for (const f of walk(content)) everything.add(rel(content, f))
  if (manifestFile) {
    // Fail closed: without the manifest the gate cannot know the names of notes
    // that were never uploaded, so their links would survive.
    if (!fs.existsSync(manifestFile)) {
      console.error(`[publish-gate] ERROR: manifest not found: ${manifestFile}`)
      return 1
    }
    for (const line of fs.readFileSync(manifestFile, "utf8").split("\n")) {
      if (line.trim()) everything.add(line.trim())
    }
  } else {
    console.warn("[publish-gate] WARNING: no manifest; links to never-uploaded notes will survive")
  }

  const atomic = walk(atomicDir)
  const adult = new Set(
    atomic.filter(
      (f) => f.endsWith(".md") && statusOf(fs.readFileSync(f, "utf8")) === PUBLISH_STATUS,
    ),
  )

  // Fail closed: a parse bug or empty sync would otherwise publish nothing and
  // the commit would delete the whole site.
  if (adult.size === 0) {
    console.error("[publish-gate] ERROR: zero publishable notes, refusing to continue")
    return 1
  }

  const published = new Index()
  for (const f of adult) published.add(rel(content, f))
  for (const folder of [...STAGED_FOLDERS.slice(1), ATTACHMENTS]) {
    for (const f of walk(path.join(content, folder))) published.add(rel(content, f))
  }
  for (const entry of fs.readdirSync(content, { withFileTypes: true })) {
    if (entry.isFile() && !entry.name.startsWith(".")) published.add(entry.name) // index.md
  }

  const withheldCount = atomic.length - adult.size
  if (!dryRun) {
    for (const f of atomic) if (!adult.has(f)) fs.rmSync(f)
  }

  const scrubbed: Array<[string, Change[]]> = []
  for (const folder of STAGED_FOLDERS) {
    for (const f of walk(path.join(content, folder))) {
      if (!f.endsWith(".md") || (folder === ATOMIC && !adult.has(f))) continue
      const original = fs.readFileSync(f, "utf8")
      const [updated, changes] = scrubLinks(original, published, everything)
      if (changes.length === 0) continue
      scrubbed.push([rel(content, f), changes])
      if (!dryRun) fs.writeFileSync(f, updated)
    }
  }

  const count = (kind: ChangeKind) =>
    scrubbed.reduce((n, [, cs]) => n + cs.filter((c) => c.kind === kind).length, 0)
  if (dryRun) {
    for (const [file, changes] of scrubbed) {
      console.log(file)
      for (const c of changes) {
        if (c.kind === "edit")
          console.log(`    ~ ${c.before.slice(0, 200)}\n    > ${(c.after ?? "").slice(0, 200)}`)
        else if (c.kind === "section")
          console.log(`    - [empty section] ${c.before.slice(0, 100)}`)
        else if (c.kind === "child") console.log(`    - [sub-bullet] ${c.before.slice(0, 100)}`)
        else console.log(`    - ${c.before.slice(0, 120)}`)
      }
    }
  }
  console.log(`[publish-gate] keeping ${adult.size} atomic notes, withholding ${withheldCount}`)
  console.log(
    `[publish-gate] link scrub across ${scrubbed.length} files: ` +
      `${count("drop") + count("child")} lines dropped, ${count("edit")} sentences unlinked, ` +
      `${count("section")} empty sections dropped`,
  )
  return 0
}

function report(content: string): number {
  const counts = new Map<string, number>()
  for (const f of walk(path.join(content, ATOMIC))) {
    const key = f.endsWith(".md") ? statusOf(fs.readFileSync(f, "utf8")) || "(none)" : "(non-md)"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const [status, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`${String(n).padStart(5)}  ${status}`)
  }
  return 0
}

function main(argv: string[]): number {
  const dryRun = argv.includes("--dry-run")
  const args = argv.filter((a) => a !== "--dry-run")
  if (args[0] === "apply" && args.length >= 2) return apply(args[1], args[2], dryRun)
  if (args[0] === "report" && args.length === 2) return report(args[1])
  console.error(
    "usage: publish-gate.ts apply CONTENT_DIR [MANIFEST] [--dry-run] | report CONTENT_DIR",
  )
  return 2
}

process.exit(main(process.argv.slice(2)))
