// book/essay.ts: an essay's provenance, drawn (bundled by build.ts, on essay pages only).
//
// Every note the essay borrowed from gets a rail in the gutter, with a bead level with each line it fed. The rails run
// down past the essay and sweep into the notes, which stack in rows by age when one row cannot hold them (newest on
// top, older below, the way a note's own sources grow below it). Open a note and what it drew on grows from its dot,
// continuing the line that came in: a note already on the page is reached by one loop, never drawn twice, and only
// unseen notes grow a new row. A dead end (private, or nothing older) is a hollow dot. While a note is open, everything
// off its chain fades. Every curve leaves and arrives vertically, with its controls at 62% of its drop.
// The design rounds are in ~/code/projects/essay-provenance/sketches (round 7 is this page).

type Note = { kind: string; private: boolean; date: string | null; refs: string[]; url: string | null; page: string | null }

const holder = document.getElementById("trace-data")
const trace = document.querySelector<HTMLElement>(".trace")
if (holder && trace) mount(trace, (JSON.parse(holder.textContent!) as { nodes: Record<string, Note> }).nodes)

function mount(trace: HTMLElement, N: Record<string, Note>) {
  const ess = trace.querySelector<HTMLElement>(".body")!
  const SVG = "http://www.w3.org/2000/svg"
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
  const q = (s: string) => CSS.escape(s)
  const short = (t: string, k = 34) => (t.length > k ? t.slice(0, k - 2).replace(/\s+\S*$/, "") + "…" : t)

  // every borrowed phrase knows its paragraph, for "fed ¶n"
  const paras = [...ess.querySelectorAll<HTMLElement>(":scope > p, :scope > blockquote > p, :scope li")]
  const spans = [...ess.querySelectorAll<HTMLElement>(".src")].filter((s) => N[s.dataset.n!])
  spans.forEach((s) => (s.dataset.p = String(paras.indexOf(s.closest("p, li") as HTMLElement))))
  const SP = spans.map((s) => ({ n: s.dataset.n!, p: Number(s.dataset.p) }))
  if (!SP.length) return

  const byDate = (a: string, b: string) => (N[a].date ?? "9").localeCompare(N[b].date ?? "9")
  const used = [...new Set(SP.map((s) => s.n))]
  const ORDER = used.slice().sort(byDate) // oldest note: leftmost, outermost rail
  const refsOf = (n: string) => (N[n].private ? [] : N[n].refs.filter((r) => N[r]))
  const LANE = 10
  const G = 18 + ORDER.length * LANE

  const ov = document.createElementNS(SVG, "svg")
  ov.classList.add("ov")
  ov.setAttribute("aria-hidden", "true")
  const labels = document.createElement("div")
  labels.className = "labels"
  const spacer = document.createElement("div")
  spacer.className = "spacer"
  ess.after(spacer)
  trace.append(ov, labels)
  trace.classList.add("drawn")

  let path: string[] = []
  const drawn = new Set<string>()
  let fade = (_: string) => ""

  function details(n: string) {
    const o = N[n]
    if (o.private) return "private note, not published"
    const bits: string[] = []
    const ps = [...new Set(SP.filter((s) => s.n === n).map((s) => s.p))].filter((p) => p >= 0)
    if (ps.length) bits.push("fed " + ps.map((p) => `<a href="#" data-go="${p}" data-gn="${esc(n)}">¶${p + 1}</a>`).join(", "))
    if (o.page) bits.push(`<a href="${o.page}">read the note</a>`)
    else if (o.url) bits.push(`<a href="${esc(o.url)}" rel="noopener">${esc(o.kind)} ↗</a>`)
    const r = refsOf(n).length
    bits.push(r ? `draws on ${r} ${r === 1 ? "note" : "notes"}` : "nothing older in the notes")
    return bits.join("<br>")
  }
  const dateLine = (n: string) =>
    N[n].private ? "private" : N[n].kind === "note" ? N[n].date ?? "undated" : N[n].kind + (N[n].date ? " · " + N[n].date : "")
  function addLabel(n: string, x: number, y: number, w: number, lvl: number, fresh: boolean) {
    labels.insertAdjacentHTML(
      "beforeend",
      `<div class="nl${fade(n)}${N[n].private ? " private" : ""}${fresh ? " fresh" : ""}${path[lvl] === n ? " open" : ""}" data-n="${esc(n)}" data-l="${lvl}" style="left:${x}px;top:${y}px;width:${w}px">` +
        `<button type="button" class="t"${N[n].private ? " disabled" : ""}>${esc(short(n))}</button><span class="d">${esc(dateLine(n))}</span><span class="more">${details(n)}</span></div>`,
    )
    return y + (labels.lastElementChild as HTMLElement).offsetHeight
  }
  const sweep = (x1: number, y1: number, x2: number, y2: number) => {
    const h = y2 - y1
    return `C${x1} ${y1 + h * 0.62} ${x2} ${y2 - h * 0.62} ${x2} ${y2}`
  }

  function draw() {
    trace.style.paddingLeft = "0px"
    // the rails live in the page's margin when it has room, so the text stays centred like a note's; on a narrow
    // screen the text moves over just enough
    const free = ess.getBoundingClientRect().left
    const shift = Math.max(0, G + 6 - free)
    trace.style.paddingLeft = shift + "px"
    const W = trace.clientWidth
    const tr = trace.getBoundingClientRect()
    const er = ess.getBoundingClientRect()
    const eL = er.left - tr.left
    const eBot = er.bottom - tr.top
    const nodeY = eBot + 130
    const vis: Record<string, { x: number; y: number; bottom: number; lvl: number }> = {}
    const chain = new Set(path)
    const last = path[path.length - 1]
    const focus = new Set([...path, ...(last ? refsOf(last) : [])])
    fade = (n) => (path.length && !focus.has(n) ? " faded" : "")
    const x0 = eL + 6
    // the notes may run on past the essay's right edge into the empty margin, so on a wide screen they sit in one row
    // (Ethan 2026-11-07: a second row "breaks"); a phone still stacks them
    const RW = W + Math.max(0, Math.min(420, window.innerWidth - tr.right - 24))
    const CARD = 168
    const PER = Math.max(1, Math.floor((RW - x0 - 10) / CARD))
    const rows: string[][] = []
    for (let end = ORDER.length; end > 0; end -= PER) rows.push(ORDER.slice(Math.max(0, end - PER), end))
    const sw = Math.min(230, (RW - x0 - 10) / Math.min(PER, ORDER.length))
    const ROWGAP = 170
    let svg = ""
    // the row's name sits in the margin to its left, clear of the rails; on a narrow screen there is no room for it
    labels.innerHTML = free + eL - shift - G > 80 ? `<div class="drawn-from" style="left:${eL - G - 4}px;top:${nodeY - 10}px">drawn from</div>` : ""
    let floor = nodeY
    rows.forEach((row, r) => {
      const ny = nodeY + r * ROWGAP
      const top = ny - 130
      row.forEach((n, j) => {
        const lx = eL - G + 8 + ORDER.indexOf(n) * LANE
        const nx = x0 + sw * j
        const c = (chain.has(n) ? " chain" : "") + fade(n)
        const ys = spans.filter((s) => s.dataset.n === n).map((s) => [s.getClientRects()[0].top - tr.top + s.getClientRects()[0].height / 2, s.dataset.i] as const)
        const y0 = Math.min(...ys.map((y) => y[0]))
        // the rail starts at the first line this note fed, runs down the gutter, and sweeps into its note from above
        svg += `<path class="rail${c}" data-n="${esc(n)}" d="M${lx} ${y0} L${lx} ${top} ${sweep(lx, top, nx, ny)}"/>`
        ys.forEach(([y, i]) => (svg += `<circle class="bead${c}" data-n="${esc(n)}" data-i="${i}" cx="${lx}" cy="${y}" r="2.6"/>`))
        const bottom = addLabel(n, nx + 12, ny - 9, sw - 40, 0, false)
        vis[n] = { x: nx, y: ny, bottom, lvl: 0 }
        floor = Math.max(floor, bottom)
      })
    })
    const rowYs = rows.map((_, r) => nodeY + r * ROWGAP)
    const rootFloor = floor
    // a line that must pass lower rows steps 14px left into the gap between columns, which is empty in every row
    const GAP = 14
    const leave = (v: { x: number; y: number }, yTo: number) =>
      rowYs.some((ry) => ry > v.y + 1)
        ? { d: `M${v.x} ${v.y} C${v.x} ${v.y + 22} ${v.x - GAP} ${v.y + 22} ${v.x - GAP} ${v.y + 44} L${v.x - GAP} ${yTo}`, x: v.x - GAP }
        : { d: `M${v.x} ${v.y} L${v.x} ${yTo}`, x: v.x }
    let ex = ""
    path.forEach((pn, l) => {
      const v = vis[pn]
      if (!v) return
      const refs = refsOf(pn)
      const fresh = refs.filter((r) => !vis[r]).sort(byDate)
      let loopFloor = floor
      const drop = Math.max(v.bottom + 10, v.y + 24, v.lvl === 0 ? rootFloor + 10 : 0)
      const out = leave(v, drop)
      refs
        .filter((r) => vis[r])
        .forEach((r) => {
          // one round loop under everything, rising into the other note from below
          const b = vis[r]
          const dip = Math.max(floor, drop, b.y) + 50
          const key = "ln" + pn + "\u0000" + r
          const viaGap = b.lvl === 0 && rowYs.some((ry) => ry > b.y + 1)
          const bx = viaGap ? b.x - GAP : b.x
          const tail = viaGap ? ` L${bx} ${b.y + 44} C${bx} ${b.y + 22} ${b.x} ${b.y + 22} ${b.x} ${b.y}` : ""
          ex += `<path class="ln${drawn.has(key) ? "" : " grow"}${fade(r)}" pathLength="1" d="${out.d} C${out.x} ${dip + 40} ${bx} ${dip + 40} ${bx} ${viaGap ? dip - 10 : b.y}${tail}"/>`
          loopFloor = Math.max(loopFloor, dip + 10)
          drawn.add(key)
          labels.querySelector(`.nl[data-n="${q(r)}"]`)?.classList.add("linked")
        })
      if (!fresh.length) {
        floor = loopFloor
        return
      }
      // new notes grow under the one they came from, centred on it, so the flow runs straight on down
      const fw = Math.min(CARD + 10, (RW - x0 - 10) / fresh.length)
      const dotY = Math.max(loopFloor, drop) + 120
      const fx0 = Math.min(Math.max(x0, v.x - (fw * (fresh.length - 1)) / 2), RW - 10 - fw * fresh.length)
      fresh.forEach((c, j) => {
        const key = "br" + pn + "\u0000" + c
        const cx = fx0 + fw * j
        ex += `<path class="br${drawn.has(key) ? "" : " grow"}${fade(c)}" pathLength="1" d="${out.d} ${sweep(out.x, drop, cx, dotY)}"/>`
        const bottom = addLabel(c, cx + 12, dotY - 9, fw - 30, l + 1, !drawn.has(key))
        drawn.add(key)
        vis[c] = { x: cx, y: dotY, bottom, lvl: l + 1 }
        floor = Math.max(floor, bottom, dotY)
      })
    })
    // dots last, over every line that passes through them; a dead end is hollow
    let dots = ""
    for (const [n, v] of Object.entries(vis))
      dots += `<circle class="nd${refsOf(n).length ? "" : " hollow"}${chain.has(n) ? " chain" : ""}${fade(n)}" data-n="${esc(n)}" cx="${v.x}" cy="${v.y}" r="4.5"/>`
    spacer.style.height = Math.max(0, floor - eBot + 40) + "px"
    ov.setAttribute("width", String(RW))
    ov.setAttribute("height", String(trace.offsetHeight))
    ov.innerHTML = svg + ex + dots
  }

  // one hover state: a line, its bead, its rail, its note
  function light(n: string | null, i?: string | null, p?: string | null) {
    trace.querySelectorAll(".src.on,.src.rel,.rail.on,.bead.on,.nd.on,.nl.on").forEach((e) => e.classList.remove("on", "rel"))
    ov.classList.toggle("dim", n != null)
    if (n == null) return
    trace.querySelectorAll<HTMLElement | SVGElement>(`[data-n="${q(n)}"]`).forEach((e) => {
      if (e.classList.contains("src")) {
        if (p != null && (e as HTMLElement).dataset.p !== String(p)) return
        e.classList.add(i == null || (e as HTMLElement).dataset.i === i ? "on" : "rel")
      } else if (!(e.classList.contains("bead") && i != null && e.dataset.i !== i)) e.classList.add("on")
    })
  }
  trace.addEventListener("click", (e) => {
    const t = e.target as HTMLElement
    const go = t.closest<HTMLElement>("[data-go]")
    if (go) {
      e.preventDefault()
      paras[Number(go.dataset.go)]?.scrollIntoView({ block: "center", behavior: "smooth" })
      light(go.dataset.gn!, null, go.dataset.go)
      setTimeout(() => light(null), 1800)
      return
    }
    const b = t.closest(".nl .t")
    if (!b) return
    const nl = b.closest<HTMLElement>(".nl")!
    if (nl.classList.contains("private")) return
    const n = nl.dataset.n!
    const l = Number(nl.dataset.l)
    path = path[l] === n ? path.slice(0, l) : [...path.slice(0, l), n]
    for (const key of [...drawn]) if (!path.some((pn) => key.startsWith("br" + pn + "\u0000") || key.startsWith("ln" + pn + "\u0000"))) drawn.delete(key)
    draw()
  })
  trace.addEventListener("mouseover", (e) => {
    const t = e.target as HTMLElement
    if (t.closest(".more")) return
    const s = t.closest<HTMLElement>(".src")
    if (s) return light(s.dataset.n!, s.dataset.i)
    const nl = t.closest<HTMLElement>(".nl")
    light(nl && ORDER.includes(nl.dataset.n!) ? nl.dataset.n! : null)
  })
  trace.addEventListener("mouseleave", () => light(null))

  let w = innerWidth
  let queued = false
  addEventListener("resize", () => {
    if (queued || innerWidth === w) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      w = innerWidth
      draw()
    })
  })
  draw()
  document.fonts?.ready.then(draw)
}
