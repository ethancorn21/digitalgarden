// book/client.ts: the page's one script (bundled and minified by build.ts). The markdown toggle on note pages, a hero
// that moves, the index's listing (names cut to one line, sortable heads), the strip in the footer, and the type
// printed (press.mjs). The hero is picked by a small inline script in the index itself, so it never flashes.

import { mountPlate } from "./hero/plate.js"
import { run as press } from "./press.mjs"
import { mountStrip } from "./strips/strips.js"

// the type, printed (Ethan 2026-11-04, from the sketch in design/home-r5: "dark press looks the best. The ink bleed is
// awesome. Implement it across the home page and the writing site"): press.mjs sets each block's letters again on a
// canvas over it, each letter its own piece of type, the ink spreading along the paper's fibres at the edges. The text
// stays under it (clear), so it is still selected, searched and read aloud; a block that fails stays as it was. Set
// again whenever the letters move: the fonts, a resize, the listing cut or sorted, the markdown shown
const PRINTED = "h1,h2,h3,h4,h5,h6,p,li,figcaption,.meta,.label,.bar > a,.bar > button,.dir th,.dir td"
let pressT = 0
const reprint = () => {
  clearTimeout(pressT)
  pressT = window.setTimeout(() => {
    const col = document.querySelector(".col")
    if (col) press(col, "press", PRINTED)
  }, 150)
}
document.fonts?.ready.then(reprint)
addEventListener("resize", reprint)

const root = document.documentElement
const q = new URLSearchParams(location.search)
const still = matchMedia("(prefers-reduced-motion: reduce)").matches

// a plate hero: its img is the frame at data-t, and the canvas over it runs on from that moment. Under reduced motion
// the img stays; ?t=<seconds> holds that moment instead.
const plate = document.querySelector<HTMLCanvasElement>(".hero canvas[data-plate]")
if (plate && !still) {
  const fig = plate.parentElement!
  fetch(plate.dataset.plate!)
    .then((r) => r.json())
    .then((d) =>
      mountPlate(plate, d, {
        t: q.has("t") ? Number(q.get("t")) : Number(plate.dataset.t),
        hold: q.has("t"),
        ready: () => fig.classList.add("live"),
      }),
    )
    .catch(() => {})
}

// the listing: a name too long for its line is cut where the line ends and marked ..>, as Apache does, so every row is
// one line (Ethan 2026-10-31: titles wrapping at uneven points looked off). Trailing dots and spaces go before the
// mark, so "Beam.md" cut short never reads "Beam...>"
const dir = document.querySelector<HTMLTableElement>(".dir")
if (dir) {
  const fit = (a: HTMLElement) => {
    const f = a.dataset.f!
    a.textContent = f
    a.classList.remove("cut")
    // widths to the fraction of a pixel: scrollWidth rounds, and a name 0.2px too wide would still be clipped
    const r = document.createRange()
    const fits = () => {
      r.selectNodeContents(a) // again each time: setting textContent replaces the text the range held
      return r.getBoundingClientRect().width <= a.getBoundingClientRect().width
    }
    if (fits()) return
    const cut = (k: number) => f.slice(0, k).replace(/[\s.]+$/, "") + "..>"
    let lo = 1
    let hi = f.length
    while (lo < hi) {
      const k = (lo + hi + 1) >> 1
      a.textContent = cut(k)
      if (fits()) lo = k
      else hi = k - 1
    }
    a.textContent = cut(lo)
    a.classList.add("cut")
  }
  const fitAll = () => dir.querySelectorAll<HTMLElement>("td.n a").forEach(fit)
  fitAll()
  document.fonts?.ready.then(fitAll)
  let w = innerWidth
  let queued = false
  addEventListener("resize", () => {
    if (queued || innerWidth === w) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      w = innerWidth
      fitAll()
    })
  })

  // the heads sort, as Apache's do: a second click turns the order round; names start A to Z, dates and sizes largest
  // first. The page opens newest first
  const body = dir.tBodies[0]
  const keys: Record<string, (r: HTMLTableRowElement) => string | number> = {
    N: (r) => r.dataset.n!,
    M: (r) => r.dataset.m!,
    S: (r) => Number(r.dataset.s),
  }
  let col = "M"
  let up = false
  dir.querySelectorAll<HTMLAnchorElement>("th a[data-c]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault()
      const c = a.dataset.c!
      up = c === col ? !up : c === "N"
      col = c
      const k = keys[c]
      // a folder (essays/, Parent Directory) stays above the files, as Apache keeps it
      const fixed = [...body.rows].filter((r) => r.classList.contains("sub"))
      const rows = [...body.rows].filter((r) => !r.classList.contains("sub")).sort((x, y) => {
        const p = k(x)
        const q = k(y)
        const d = typeof p === "number" ? p - (q as number) : String(p).localeCompare(String(q))
        return up ? d : -d
      })
      body.append(...fixed, ...rows)
      reprint()
    }),
  )
}

const toggle = document.querySelector<HTMLButtonElement>("[data-md]")
if (toggle) {
  const set = (on: boolean) => {
    root.classList.toggle("md", on)
    toggle.classList.remove("pressed") // its printed words go with the old text
    toggle.textContent = on ? "Hide markdown" : "Show markdown"
    toggle.setAttribute("aria-pressed", String(on))
  }
  set(root.classList.contains("md"))
  toggle.hidden = false
  toggle.addEventListener("click", () => {
    const on = !root.classList.contains("md")
    set(on)
    reprint()
    // the reader's choice follows them to the next note
    try {
      localStorage.setItem("md", on ? "1" : "0")
    } catch {}
  })
}

// the footer: one strip at random, never the same twice in a row; ?strip=<key> pins one, ?t=<seconds> holds a moment.
// Its print is fetched when the footer comes near, so a reader who never scrolls there never loads it.
const foot = document.querySelector<HTMLElement>("[data-strips]")
if (foot) {
  const all = JSON.parse(foot.dataset.strips!) as { k: string; url: string; alt: string }[]
  let i = all.findIndex((s) => s.k === q.get("strip"))
  if (i < 0) {
    let prev = ""
    try {
      prev = localStorage.getItem("strip") ?? ""
    } catch {}
    const left = all.filter((s) => s.k !== prev)
    i = all.indexOf(left[Math.floor(Math.random() * left.length)] ?? all[0])
    try {
      localStorage.setItem("strip", all[i].k)
    } catch {}
  }
  const s = all[i]
  const cv = foot.querySelector("canvas")!
  cv.setAttribute("aria-label", s.alt)
  const t = q.has("t") ? Number(q.get("t")) : undefined
  new IntersectionObserver(
    (es, ob) => {
      if (!es.some((e) => e.isIntersecting)) return
      ob.disconnect()
      fetch(s.url)
        .then((r) => r.json())
        .then((d) => mountStrip(cv, d, { t }))
        .catch(() => (foot.hidden = true))
    },
    { rootMargin: "600px 0px" },
  ).observe(foot)
}
