// book/hero/bake-dark.mjs: bakes a plate hero's dark still (goya-dark.webp): its frame at t, drawn by plate.js itself
// on a dark page (light dots sized by the light, the "glow" of the home's picture), so the img hands over to the
// canvas without a change. The light still is baked the same way (LIGHT=1) to check the method against goya.webp.
// Lossless WebP (lossy blurs the dots). Needs playwright-core and its Chromium:
//   cp book/hero/bake-dark.mjs /tmp/pw/ && node /tmp/pw/bake-dark.mjs ~/code/projects/digitalgarden/book
import { chromium } from "playwright-core"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createRequire } from "node:module"

const BOOK = process.argv[2]
const sharp = createRequire(join(BOOK, "..", "package.json"))("sharp")
const heroes = JSON.parse(readFileSync(join(BOOK, "hero", "heroes.json"), "utf8"))
const light = !!process.env.LIGHT
const b = await chromium.launch({
  executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
})
for (const h of heroes.filter((h) => h.plate)) {
  // the canvas's backing is its CSS size times the pixel ratio: 1320 x 920 at 660 x 460 CSS px (at 3 the height
  // rounds to 307 CSS px, a row too many)
  const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: h.w / 2 + 40, height: h.h / 2 + 40 } })
  await p.route("http://bake/**", (r) => {
    const f = new URL(r.request().url()).pathname
    if (f === "/") return r.fulfill({ contentType: "text/html", body: "<!doctype html><body style=margin:0>" })
    r.fulfill({ contentType: f.endsWith(".js") ? "text/javascript" : "application/json", body: readFileSync(join(BOOK, f)) })
  })
  await p.goto("http://bake/")
  const url = await p.evaluate(
    async ({ h, light }) => {
      document.documentElement.dataset.theme = light ? "light" : "dark"
      const { mountPlate } = await import("/hero/plate.js")
      const d = await (await fetch("/hero/" + h.plate)).json()
      const cv = document.createElement("canvas")
      cv.style.cssText = `display:block;width:${h.w / 2}px;height:${h.h / 2}px`
      document.body.append(cv)
      // the frame is read in the same task it is drawn in, while WebGL still holds it
      return new Promise((done) => mountPlate(cv, d, { t: h.t ?? 0, hold: true, ready: () => done(cv.toDataURL("image/png")) }))
    },
    { h, light },
  )
  const png = Buffer.from(url.split(",")[1], "base64")
  const out = join(BOOK, "hero", light ? `${h.key}-light-bake.webp` : h.dark ?? `${h.key}-dark.webp`)
  const m = await sharp(png).metadata()
  if (m.width !== h.w || m.height !== h.h) throw new Error(`${h.key}: baked ${m.width}x${m.height}, want ${h.w}x${h.h}`)
  await sharp(png).webp({ lossless: true, effort: 6 }).toFile(out)
  console.log("wrote", out)
}
await b.close()
