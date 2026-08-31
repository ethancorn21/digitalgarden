import path from "path"
import fs from "fs"
import crypto from "crypto"
import sharp from "sharp"

// Vault images are full-resolution scans (the largest is 4903x2797, 4.4MB).
// Nothing on the site renders wider than this, so anything above it is pure
// download cost. Bumping this invalidates the cache automatically.
export const MAX_IMAGE_WIDTH = 1600
const JPEG_QUALITY = 82
// below this, re-encoding costs build time and saves almost nothing
const OPTIMIZE_MIN_BYTES = 150_000

const rasterExtensions = new Set([".jpg", ".jpeg", ".png"])
export const isOptimizableImage = (fp: string) =>
  rasterExtensions.has(path.extname(fp).toLowerCase())

// dimensions the browser will actually get, after the emitter's downscale
export function servedDimensions(width: number, height: number) {
  if (width <= MAX_IMAGE_WIDTH) return { width, height }
  return {
    width: MAX_IMAGE_WIDTH,
    height: Math.round((height * MAX_IMAGE_WIDTH) / width),
  }
}

const cacheDir = path.join(process.cwd(), ".quartz-cache", "images")

const cacheKey = (src: string, stat: fs.Stats) =>
  crypto
    .createHash("sha256")
    .update(`${src}:${stat.size}:${stat.mtimeMs}:${MAX_IMAGE_WIDTH}:${JPEG_QUALITY}`)
    .digest("hex")

/**
 * Downscale + re-encode an image for serving. Returns the path of a file that
 * should be copied to the output directory — either a cached optimized copy or
 * `src` itself when optimizing isn't worth it (small file, or the re-encode came
 * out no smaller than the original).
 */
export async function optimizedImagePath(src: string): Promise<string> {
  if (!isOptimizableImage(src)) return src

  const stat = await fs.promises.stat(src)
  if (stat.size < OPTIMIZE_MIN_BYTES) return src

  const ext = path.extname(src).toLowerCase()
  const key = cacheKey(src, stat)
  const cached = path.join(cacheDir, `${key}${ext}`)
  const skipMarker = path.join(cacheDir, `${key}.skip`)
  if (fs.existsSync(skipMarker)) return src
  if (fs.existsSync(cached)) return cached

  const pipeline = sharp(src).rotate().resize({
    width: MAX_IMAGE_WIDTH,
    withoutEnlargement: true,
  })

  const buf = await (ext === ".png"
    ? pipeline.png({ compressionLevel: 9, effort: 8 })
    : pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
  ).toBuffer()

  await fs.promises.mkdir(cacheDir, { recursive: true })
  if (buf.length >= stat.size) {
    // record the miss so the next build doesn't re-encode it again
    await fs.promises.writeFile(skipMarker, "")
    return src
  }

  await fs.promises.writeFile(cached, buf)
  return cached
}
