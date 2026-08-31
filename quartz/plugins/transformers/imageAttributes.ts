import path from "path"
import { Root } from "mdast"
import { visit } from "unist-util-visit"
import sharp from "sharp"
import { QuartzTransformerPlugin } from "../types"
import { glob } from "../../util/glob"
import { FilePath, joinSegments, slugifyFilePath } from "../../util/path"
import { isOptimizableImage, servedDimensions } from "../../util/images"

const dimensionExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"])

// slugified asset path (and bare filename, for Obsidian's shortest-path embeds)
// -> path on disk. Built once per build.
let assetIndex: Promise<Map<string, string>> | undefined
function getAssetIndex(directory: string, ignorePatterns: string[]) {
  assetIndex ??= (async () => {
    const index = new Map<string, string>()
    const fps = await glob("**", directory, ["**/*.md", ...ignorePatterns])
    for (const fp of fps) {
      if (!dimensionExtensions.has(path.extname(fp).toLowerCase())) continue
      const onDisk = joinSegments(directory, fp)
      const slug = slugifyFilePath(fp as FilePath)
      index.set(slug, onDisk)
      // last one wins on a basename collision; the full-path key above still
      // resolves those correctly
      index.set(path.posix.basename(slug), onDisk)
    }
    return index
  })()
  return assetIndex
}

const dimensionCache = new Map<string, { width: number; height: number } | null>()
async function dimensionsOf(onDisk: string) {
  if (!dimensionCache.has(onDisk)) {
    try {
      const { width, height } = await sharp(onDisk).metadata()
      dimensionCache.set(
        onDisk,
        width && height
          ? isOptimizableImage(onDisk)
            ? servedDimensions(width, height)
            : { width, height }
          : null,
      )
    } catch {
      dimensionCache.set(onDisk, null)
    }
  }
  return dimensionCache.get(onDisk)!
}

/**
 * Gives every embedded image intrinsic width/height (so it reserves its space
 * before it loads) and defers everything below the first image. Runs after
 * ObsidianFlavoredMarkdown, which leaves width/height as "auto" unless the
 * author sized the embed themselves.
 */
export const ImageAttributes: QuartzTransformerPlugin = () => ({
  name: "ImageAttributes",
  markdownPlugins(ctx) {
    return [
      () => async (tree: Root, _file) => {
        const images: { url: string; props: Record<string, unknown> }[] = []
        visit(tree, "image", (node) => {
          const data = (node.data ??= {})
          const props = ((data as any).hProperties ??= {}) as Record<string, unknown>
          images.push({ url: node.url, props })
        })

        if (images.length === 0) return
        const index = await getAssetIndex(ctx.argv.directory, ctx.cfg.configuration.ignorePatterns)

        for (const [i, { url, props }] of images.entries()) {
          // the first image is usually the one in view on load, so it stays eager
          if (i === 0) {
            props.fetchpriority = "high"
          } else {
            props.loading = "lazy"
          }
          props.decoding = "async"

          if (/^(https?:)?\/\//.test(url)) continue
          const clean = decodeURIComponent(url.split("#")[0].split("?")[0]).replace(/^\.?\/+/, "")
          const onDisk = index.get(clean) ?? index.get(path.posix.basename(clean))
          if (!onDisk) continue

          const dims = await dimensionsOf(onDisk)
          if (!dims) continue

          const authored = Number(props.width)
          if (Number.isFinite(authored) && authored > 0) {
            // author sized the embed themselves (`![[img.jpg|1200]]`); keep their
            // width but derive height from it, or the pair describes the wrong
            // aspect ratio and the browser reserves a misshapen box
            if (props.height === undefined || props.height === "auto") {
              props.height = Math.round((dims.height * authored) / dims.width)
            }
            continue
          }

          if (props.width === undefined || props.width === "auto") props.width = dims.width
          if (props.height === undefined || props.height === "auto") props.height = dims.height
        }
      },
    ]
  },
})
