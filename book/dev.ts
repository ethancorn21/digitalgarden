// book/dev.ts: the tuning kit. Only `build.ts --dev` ships it; live builds never do. On with ?dev=1 or on localhost.
// One colour input per token, text size, the four face settings from the canvas, on the index the room kept under the
// hero on the first screen and the hero pin, and the footer strip's pin. "Copy CSS" puts the current tokens on the
// clipboard as a :root block to paste back.

const root = document.documentElement
const qs = new URLSearchParams(location.search)
const on = qs.get("dev") === "1" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)

const COLOURS = ["--bg", "--ink", "--muted", "--rule", "--line"]
const S = "var(--serif)",
  D = "var(--display)"
const LIT_LABELS = {
  "--label-font": S,
  "--label-size": ".95em",
  "--label-style": "normal",
  "--label-caps": "all-small-caps",
  "--label-spacing": ".07em",
  "--caption-size": ".8em",
}
const COR_LABELS = {
  "--label-font": D,
  "--label-size": "1.1em",
  "--label-style": "italic",
  "--label-caps": "normal",
  "--label-spacing": "0",
  "--caption-size": ".95em",
}
const COR_TITLES = {
  "--title-font": D,
  "--title-weight": "600",
  "--title-index": "clamp(2em, 8vw, 2.6em)",
  "--title-note": "clamp(2em, 8vw, 2.7em)",
}
const FACES: Record<string, Record<string, string>> = {
  "Literata only": {
    "--title-font": S,
    "--title-weight": "500",
    "--title-index": "clamp(1.6em, 6vw, 2em)",
    "--title-note": "clamp(1.6em, 6vw, 2.1em)",
    ...LIT_LABELS,
    "--body-font": S,
    "--body-scale": "1",
  },
  "Cormorant titles": { ...COR_TITLES, ...LIT_LABELS, "--body-font": S, "--body-scale": "1" },
  "Cormorant titles + labels": {
    ...COR_TITLES,
    ...COR_LABELS,
    "--body-font": S,
    "--body-scale": "1",
  },
  "Cormorant everywhere": {
    ...COR_TITLES,
    ...COR_LABELS,
    "--body-font": D,
    "--body-scale": "1.15",
  },
}
const HEROES = ["goya"]
const STRIPS = ["hollar", "visscher", "utrecht"]

type State = { tokens: Record<string, string>; face: string }
let state: State = { tokens: {}, face: "Cormorant titles + labels" }
try {
  state = { ...state, ...JSON.parse(localStorage.getItem("book-dev") || "{}") }
} catch {}
const save = () => {
  try {
    localStorage.setItem("book-dev", JSON.stringify(state))
  } catch {}
}
const apply = () => {
  for (const [k, v] of Object.entries({ ...FACES[state.face], ...state.tokens }))
    root.style.setProperty(k, v)
}

if (on) {
  apply()
  const cs = getComputedStyle(root)
  const val = (k: string) => state.tokens[k] ?? cs.getPropertyValue(k).trim()
  const style = document.createElement("style")
  style.textContent = `.devkit{position:fixed;right:12px;bottom:12px;z-index:9;width:280px;max-width:calc(100vw - 24px);padding:10px 12px;background:#fff;border:1px solid #ccc;font:12px/1.4 ui-monospace,Menlo,monospace;color:#222;display:grid;gap:6px}
.devkit label{display:flex;justify-content:space-between;align-items:center;gap:8px}.devkit input[type=color]{width:44px;height:20px;padding:0;border:0}
.devkit select,.devkit button{font:inherit}.devkit select{max-width:170px}.devkit input[type=range]{width:120px}.devkit .row{display:flex;flex-wrap:wrap;gap:4px 8px}.devkit textarea{font:inherit;height:90px}
.devkit.shut>:not(.hd){display:none}.devkit .hd{display:flex;justify-content:space-between;cursor:pointer}`
  document.head.appendChild(style)
  const kit = document.createElement("div")
  kit.className = "devkit"
  const knob = (k: string, min: number, max: number, step: number, unit: string) =>
    `<label>${k}<input type="range" data-k="${k}" data-u="${unit}" min="${min}" max="${max}" step="${step}" value="${parseFloat(val(k))}"></label>`
  kit.innerHTML =
    `<div class="hd"><b>dev</b><span>hide</span></div>` +
    COLOURS.map(
      (k) => `<label>${k}<input type="color" data-k="${k}" value="${val(k)}"></label>`,
    ).join("") +
    knob("--fs", 15, 24, 1, "px") +
    `<label>face<select data-face>${Object.keys(FACES)
      .map((f) => `<option${f === state.face ? " selected" : ""}>${f}</option>`)
      .join("")}</select></label>` +
    (document.querySelector(".index")
      ? knob("--hero-room", 0, 500, 10, "px") +
        `<div class="row">hero: ${["random", ...HEROES].map((h) => `<a href="?dev=1${h === "random" ? "" : "&hero=" + h}">${h}</a>`).join(" ")}</div>`
      : "") +
    (document.querySelector("[data-strips]")
      ? `<div class="row">strip: ${["random", ...STRIPS].map((k) => `<a href="?dev=1${k === "random" ? "" : "&strip=" + k}">${k}</a>`).join(" ")}</div>`
      : "") +
    `<div class="row"><button type="button" data-copy>Copy CSS</button><button type="button" data-reset>Reset</button></div>`
  document.body.appendChild(kit)
  kit.querySelector(".hd")!.addEventListener("click", () => kit.classList.toggle("shut"))
  kit.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement
    if (t.dataset.k) state.tokens[t.dataset.k] = t.value + (t.dataset.u ?? "")
    if (t.matches("[data-face]")) state.face = t.value
    apply()
    save()
  })
  kit.querySelector("[data-reset]")!.addEventListener("click", () => {
    state = { tokens: {}, face: "Cormorant titles + labels" }
    save()
    location.reload()
  })
  kit.querySelector("[data-copy]")!.addEventListener("click", () => {
    const all = {
      ...FACES[state.face],
      ...Object.fromEntries(COLOURS.map((k) => [k, val(k)])),
      "--fs": val("--fs"),
      "--hero-room": val("--hero-room"),
      ...state.tokens,
    }
    const css = `/* face: ${state.face} */\n:root {\n${Object.entries(all)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n")}\n}\n`
    navigator.clipboard?.writeText(css).catch(() => {})
    let ta = kit.querySelector("textarea")
    if (!ta) kit.appendChild((ta = document.createElement("textarea")))
    ta.value = css
    ta.select()
  })
}
