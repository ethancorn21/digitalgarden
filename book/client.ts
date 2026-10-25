// book/client.ts: the page's one script (bundled and minified by build.ts). The markdown toggle on note pages, a hero
// that moves, and the strip in the footer. The hero is picked by a small inline script in the index itself, so it
// never flashes.

import { mountPlate } from "./hero/plate.js"
import { mountStrip } from "./strips/strips.js"

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

const toggle = document.querySelector<HTMLButtonElement>("[data-md]")
if (toggle) {
  const set = (on: boolean) => {
    root.classList.toggle("md", on)
    toggle.textContent = on ? "Hide markdown" : "Show markdown"
    toggle.setAttribute("aria-pressed", String(on))
  }
  set(root.classList.contains("md"))
  toggle.hidden = false
  toggle.addEventListener("click", () => {
    const on = !root.classList.contains("md")
    set(on)
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
