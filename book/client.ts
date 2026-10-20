// book/client.ts: the page's one script (bundled and minified by build.ts). The markdown toggle on note pages and
// the pixel parade in the footer. The hero is picked by a small inline script in the index itself, so it never flashes.

import { createParade } from "./parade/parade.js"

const root = document.documentElement

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

for (const host of document.querySelectorAll<HTMLElement>("[data-parade]"))
  createParade(host, { script: host.dataset.parade })
