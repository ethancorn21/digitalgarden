import type { QuartzFilterPlugin } from "../types"

// Second layer behind scripts/lib/publish-gate.ts, which imports statusOf from here
// so the status rule has one implementation.
// Atomic notes are published only when their header block says `status: #adult`.
// Matched on raw text: the header has no opening `---`, so no frontmatter parser
// sees it, and in YAML `status: #adult` would read as null (` #` starts a comment).
const GATED_DIR = "2 - atomic notes/"
export const PUBLISH_STATUS = "adult"
const HEADER_MAX_LINES = 30

const RULE = /^---[ \t]*$/
const STATUS = /^status:[ \t]*["']?#?([A-Za-z]+)/m

function headerOf(text: string): string {
  let lines = text
    .replace(/^[﻿ \t\r\n]+/, "")
    .split(/\r?\n/)
    .slice(0, HEADER_MAX_LINES)
  if (lines.length > 0 && RULE.test(lines[0])) lines = lines.slice(1)
  const header: string[] = []
  for (const line of lines) {
    if (line.trim() === "" || RULE.test(line)) break
    header.push(line)
  }
  return header.join("\n")
}

export function statusOf(text: string): string {
  const m = STATUS.exec(headerOf(text))
  return m ? m[1].toLowerCase() : ""
}

export const AdultOnly: QuartzFilterPlugin = () => ({
  name: "AdultOnly",
  shouldPublish(_ctx, [_tree, vfile]) {
    const relativePath: string = vfile.data?.relativePath ?? ""
    if (!relativePath.startsWith(GATED_DIR)) return true
    return statusOf(String(vfile.value)) === PUBLISH_STATUS
  },
})
