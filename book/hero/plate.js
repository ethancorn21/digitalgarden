// book/hero/plate.js: a hero that moves. An old print with one modern thing in it, drawn on the same dot screen as the
// strips, and only that thing moves: Goya's Capricho 43 with an open laptop beside the sleeper, its screen streaming an
// agent's output all night, its light on him and the owls. Made on the "Garden footer" canvas
// (https://claude.ai/artifact/EEGuko4RpVG1A1yvPTFqAP) as plate K; this is lab/plates.js from
// ~/code/projects/artifacts/garden-footer cut down to the screen, and keep/goya-sleep-of-reason there has the bake.
// The plate comes baked (cell lightness after halftone.py's sharpening, a light map, levels and gamma, the screen's
// quad in px at the 3.3 px pitch); each frame adds the screen's text and draws the cells. The page shows a still
// frame as an img first, and the canvas takes over from the same moment, so the swap doesn't show.

import { Screen } from '../strips/strips.js'

const b64u8 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// the projective map from the unit square to a quad (tl, tr, br, bl), and its inverse
function homography(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  const den = dx1 * dy2 - dx2 * dy1
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0
  // inverse of [[a b c][d e f][g h 1]]
  const A = e - f * h, B = c * h - b, C = b * f - c * e, D = f * g - d, E = a - c * g, F = c * d - a * f, G = d * h - e * g, H = b * g - a * h, I = a * e - b * d
  return (x, y) => { const w = G * x + H * y + I; return [(A * x + B * y + C) / w, (D * x + E * y + F) / w] }
}

// an agent's output, streamed: bursts of tokens, pauses to think, code and prose, blank lines between thoughts.
// Deterministic in t, so a still frame or ?t= shows the same screen every time.
function Stream(seed, width) {
  const r = rng(seed)
  const lines = []          // each: { ind, words: [len...], n: chars incl. spaces }
  const tAt = []            // time each char appears (global char index)
  let t = 0
  const LOOP = 600
  while (t < LOOP) {
    const code = r() < 0.45
    const nl = 1 + Math.floor(r() * (code ? 7 : 4))
    for (let k = 0; k < nl && t < LOOP; k++) {
      const ind = code ? [0, 2, 4, 4, 2][Math.floor(r() * 5)] : 0
      const want = code ? 6 + Math.floor(r() * (width - ind - 10)) : (k === nl - 1 ? 8 + Math.floor(r() * (width - 12)) : width - Math.floor(r() * 4))
      const words = []
      let n = ind
      while (n < want) { const w = Math.min(want - n, 1 + Math.floor(r() * (code ? 9 : 7))); words.push(w); n += w + 1 }
      lines.push({ ind, words, n: Math.max(n - 1, ind) })
      for (let c = 0; c < Math.max(1, n - ind); c++) {
        t += r() < 0.04 ? 0.25 + r() * 0.5 : 0.012 + r() * 0.03     // tokens arrive in bursts
        tAt.push({ t, line: lines.length - 1, c: ind + c })
      }
    }
    lines.push({ ind: 0, words: [], n: 0 })                            // a blank line, then it thinks
    t += 0.6 + r() * 2.8
    tAt.push({ t, line: lines.length - 1, c: 0 })
  }
  const at = (time) => {
    const tt = ((time % t) + t) % t
    let lo = 0, hi = tAt.length - 1
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tAt[m].t <= tt) lo = m; else hi = m - 1 }
    const e = tAt[lo]
    return { line: e.line, c: e.c + 1, busy: tt - e.t < 0.4 }
  }
  return { lines, at }
}

function Plate(data) {
  const lum = b64u8(data.lum), light = b64u8(data.light)
  // how much of each cell lies in front of the screen (his fist over its lower right corner), 0..255
  const occ = data.occ ? b64u8(data.occ) : null
  const lut = new Float32Array(256)
  for (let i = 0; i < 256; i++) lut[i] = 1 - Math.pow(Math.min(1, Math.max(0, (i - data.lo) / (data.hi - data.lo))), data.gam)
  // the still part never changes: the print with the laptop's light on it, through the curve
  const base = new Float32Array(data.cols * data.rows)
  for (let k = 0; k < base.length; k++) base[k] = lut[Math.min(255, Math.round(lum[k] + (255 - lum[k]) * (light[k] / 255)))]
  // the screen: tl, tr, br, bl (the quad comes hinge-left, top-left, top-right, hinge-right)
  const Q = [data.quad[1], data.quad[2], data.quad[3], data.quad[0]]
  const inv = homography(Q)
  const bb = [Math.min(...Q.map((p) => p[0])), Math.min(...Q.map((p) => p[1])), Math.max(...Q.map((p) => p[0])), Math.max(...Q.map((p) => p[1]))]
  const COLS = 34, ROWS = 11
  const st = Stream(7, COLS)
  let view = null
  const step = (t) => {
    const a = st.at(t)
    view = { a, top: Math.max(0, a.line - ROWS + 1), blink: a.busy || t % 1.06 < 0.53 }
    return `${a.line} ${a.c} ${view.blink}`
  }
  // ink on the screen at (u, v): a light page, text rows of words, the cursor
  const MX = 0.07, MY = 0.07
  const screenInk = (u, v) => {
    const x = (u - MX) / (1 - 2 * MX), y = (v - MY) / (1 - 2 * MY)
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return 0.02
    const row = Math.floor(y * ROWS), fy = y * ROWS - row
    if (fy < 0.3 || fy > 0.78) return 0.02
    const li = view.top + row
    if (li > view.a.line) return 0.02
    const L = st.lines[li]
    const cx = x * COLS, ci = Math.floor(cx)
    const upto = li === view.a.line ? view.a.c : L.n
    if (li === view.a.line && ci === upto && view.blink) return 0.85
    if (ci >= upto || ci < L.ind) return 0.02
    let p = L.ind
    for (const w of L.words) { if (ci < p) return 0.02; if (ci < p + w) return cx - ci < 0.82 ? 0.5 : 0.02; p += w + 1 }
    return 0.02
  }
  const paint = (g) => {
    const { cols, buf, p } = g
    const C = Math.min(cols, data.cols), R = Math.min(g.rows, data.rows)
    for (let j = 0; j < R; j++)
      for (let i = 0; i < C; i++) buf[j * cols + i] = Math.round(base[j * data.cols + i] * 255)
    // the cells under the screen, averaged 4 x 4 with the print where they are only partly on it; where his arm lies
    // over the screen the print stays, so the stream runs behind it
    const SS = 4
    const i0 = Math.max(0, Math.floor(bb[0] / p)), i1 = Math.min(C - 1, Math.floor(bb[2] / p))
    const j0 = Math.max(0, Math.floor(bb[1] / p)), j1 = Math.min(R - 1, Math.floor(bb[3] / p))
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * data.cols + i
        let sum = 0
        for (let b = 0; b < SS; b++)
          for (let a = 0; a < SS; a++) {
            const [u, v] = inv((i + (a + 0.5) / SS) * p, (j + (b + 0.5) / SS) * p)
            sum += u >= 0 && u <= 1 && v >= 0 && v <= 1 ? screenInk(u, v) : base[k]
          }
        const o = occ ? occ[k] / 255 : 0
        buf[j * cols + i] = Math.round((Math.min(1, sum / (SS * SS)) * (1 - o) + base[k] * o) * 255)
      }
  }
  return { step, paint }
}

// Draw the plate into a canvas laid over the hero's img and run it from o.t (the moment the img shows). The clock only
// runs while the hero is on screen and the tab is showing, and a frame is drawn only when the screen's text changes.
// o.hold keeps that one frame (?t= on the page); o.ready() is called once the canvas shows the picture.
export function mountPlate(cv, data, o = {}) {
  const g = Screen(cv, { size: [data.w, data.h], dpr: 3 })
  if (!g.gl) return
  const s = Plate(data)
  let t = o.t || 0, last = 0, raf = 0, seen = true, shown = '', drawn = false
  const frame = (force) => {
    if (!g.cols) return
    const key = s.step(t)
    if (key === shown && !force) return
    shown = key
    g.buf.fill(0); s.paint(g); g.draw()
    if (!drawn) { drawn = true; o.ready?.() }
  }
  const tick = (now) => {
    if (last) t += Math.min(0.1, (now - last) / 1000)
    last = now
    frame(false)
    raf = requestAnimationFrame(tick)
  }
  const run = () => {
    const go = !o.hold && seen && !document.hidden
    if (go && !raf) { last = 0; raf = requestAnimationFrame(tick) }
    if (!go && raf) { cancelAnimationFrame(raf); raf = 0 }
  }
  new ResizeObserver(() => { g.size(); frame(true) }).observe(cv)
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; run() }).observe(cv)
  document.addEventListener('visibilitychange', run)
}
