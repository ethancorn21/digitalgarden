import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import { FullSlug } from "../../util/path"

// Cloudflare's asset server only sends an etag by default, so every image is
// re-validated on every navigation. Attachments are effectively write-once, so
// they get a long cache; HTML/JS/CSS change on each build and keep revalidating.
// `*` matches across path segments, so these cover every folder.
const rules: [pattern: string, cacheControl: string][] = [
  ["/*.jpg", "public, max-age=2592000"],
  ["/*.jpeg", "public, max-age=2592000"],
  ["/*.png", "public, max-age=2592000"],
  ["/*.gif", "public, max-age=2592000"],
  ["/*.webp", "public, max-age=2592000"],
  ["/*.svg", "public, max-age=2592000"],
  ["/static/fonts/*", "public, max-age=31536000, immutable"],
  ["/*.js", "public, max-age=0, must-revalidate"],
  ["/*.css", "public, max-age=0, must-revalidate"],
]

export const CloudflareHeaders: QuartzEmitterPlugin = () => ({
  name: "CloudflareHeaders",
  async emit(ctx) {
    const content = rules
      .map(([pattern, cacheControl]) => `${pattern}\n  Cache-Control: ${cacheControl}\n`)
      .join("\n")

    const path = await write({
      ctx,
      content,
      slug: "_headers" as FullSlug,
      ext: "",
    })
    return [path]
  },
  async *partialEmit() {},
})
