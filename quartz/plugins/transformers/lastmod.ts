import fs from "fs"
import { Repository } from "@napi-rs/simple-git"
import { QuartzTransformerPlugin } from "../types"
import path from "path"
import { styleText, promisify } from "util"
import { execFile } from "child_process"

const execFileAsync = promisify(execFile)

// walks a file's full commit history (following renames) in one git call and
// returns both dates the Explorer needs:
//   created  — the oldest commit that touched the file
//   modified — the newest commit that changed at least `minEditLines` lines
//
// the line threshold is what keeps a vault-wide link rename or frontmatter
// rewrite from shoving hundreds of untouched notes to the top of the sidebar:
// those commits change one or two lines per file, a real revisit changes more.
async function getFileGitDates(
  cwd: string,
  relativePath: string,
  minEditLines: number,
): Promise<{ created?: number; modified?: number }> {
  // \x1e (record separator) prefixes each commit's date line so the numstat
  // rows that follow can be attributed to it
  const { stdout } = await execFileAsync(
    "git",
    ["log", "--follow", "--format=%x1e%aI", "--numstat", "--", relativePath],
    { cwd, maxBuffer: 32 * 1024 * 1024 },
  )

  let created: number | undefined = undefined
  let modified: number | undefined = undefined
  let currentDate: number | undefined = undefined
  let currentLines = 0

  // git log is newest-first, so the first qualifying commit is the latest
  // substantive edit and the last date seen overall is the creation date
  const flush = () => {
    if (currentDate === undefined) return
    created = currentDate
    if (modified === undefined && currentLines >= minEditLines) modified = currentDate
  }

  for (const line of stdout.split("\n")) {
    if (line.startsWith("\x1e")) {
      flush()
      const parsed = new Date(line.slice(1).trim()).getTime()
      currentDate = isNaN(parsed) ? undefined : parsed
      currentLines = 0
      continue
    }
    const stat = line.match(/^(\d+|-)\t(\d+|-)\t/)
    if (stat) {
      const added = stat[1] === "-" ? 0 : parseInt(stat[1], 10)
      const deleted = stat[2] === "-" ? 0 : parseInt(stat[2], 10)
      currentLines += added + deleted
    }
  }
  flush()

  return { created, modified }
}

export interface Options {
  priority: ("frontmatter" | "git" | "filesystem")[]
  // minimum added+deleted lines for a commit to count as a real edit when
  // computing `modified`. filters out bulk link/frontmatter rewrites.
  minEditLines: number
}

const defaultOptions: Options = {
  priority: ["frontmatter", "git", "filesystem"],
  minEditLines: 4,
}

// YYYY-MM-DD
const iso8601DateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/

function coerceDate(fp: string, d: any): Date {
  // check ISO8601 date-only format
  // we treat this one as local midnight as the normal
  // js date ctor treats YYYY-MM-DD as UTC midnight
  if (typeof d === "string" && iso8601DateOnlyRegex.test(d)) {
    d = `${d}T00:00:00`
  }

  const dt = new Date(d)
  const invalidDate = isNaN(dt.getTime()) || dt.getTime() === 0
  if (invalidDate && d !== undefined) {
    console.log(
      styleText(
        "yellow",
        `\nWarning: found invalid date "${d}" in \`${fp}\`. Supported formats: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format`,
      ),
    )
  }

  return invalidDate ? new Date() : dt
}

type MaybeDate = undefined | string | number
export const CreatedModifiedDate: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "CreatedModifiedDate",
    markdownPlugins(ctx) {
      return [
        () => {
          let repo: Repository | undefined = undefined
          let repositoryWorkdir: string
          if (opts.priority.includes("git")) {
            try {
              repo = Repository.discover(ctx.argv.directory)
              repositoryWorkdir = repo.workdir() ?? ctx.argv.directory
            } catch (e) {
              console.log(
                styleText(
                  "yellow",
                  `\nWarning: couldn't find git repository for ${ctx.argv.directory}`,
                ),
              )
            }
          }

          return async (_tree, file) => {
            let created: MaybeDate = undefined
            let modified: MaybeDate = undefined
            let published: MaybeDate = undefined
            // newest commit that changed >= minEditLines; undefined when every
            // commit was a trivial/bulk rewrite. drives the Explorer's surfacing
            // rule, kept separate from `modified` so lastmod feeds stay accurate
            let substantive: MaybeDate = undefined

            const fp = file.data.relativePath!
            const fullFp = file.data.filePath!
            for (const source of opts.priority) {
              if (source === "filesystem") {
                const st = await fs.promises.stat(fullFp)
                created ||= st.birthtimeMs
                modified ||= st.mtimeMs
              } else if (source === "frontmatter" && file.data.frontmatter) {
                created ||= file.data.frontmatter.created as MaybeDate
                modified ||= file.data.frontmatter.modified as MaybeDate
                published ||= file.data.frontmatter.published as MaybeDate
              } else if (source === "git" && repo) {
                try {
                  const relativePath = path.relative(repositoryWorkdir, fullFp)
                  const gitDates = await getFileGitDates(
                    repositoryWorkdir,
                    relativePath,
                    opts.minEditLines,
                  )
                  created ||= gitDates.created
                  // fall back to the raw latest commit when no commit cleared the
                  // line threshold, so sitemap/RSS lastmod stays truthful
                  modified ||= gitDates.modified ?? (await repo.getFileLatestModifiedDateAsync(relativePath))
                  substantive ||= gitDates.modified
                } catch {
                  console.log(
                    styleText(
                      "yellow",
                      `\nWarning: ${file.data.filePath!} isn't yet tracked by git, dates will be inaccurate`,
                    ),
                  )
                }
              }
            }

            file.data.dates = {
              created: coerceDate(fp, created),
              modified: coerceDate(fp, modified),
              published: coerceDate(fp, published),
              substantiveModified: substantive === undefined ? undefined : coerceDate(fp, substantive),
            }
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    dates: {
      created: Date
      modified: Date
      published: Date
      substantiveModified?: Date
    }
  }
}
