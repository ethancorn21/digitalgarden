import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/nowplaying.scss"

interface Options {
  trackId: string
  label?: string
}

export default ((opts?: Options) => {
  const NowPlaying: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    if (!opts?.trackId) return null

    const src = `https://open.spotify.com/embed/track/${opts.trackId}?utm_source=generator&theme=0`

    return (
      <div class={`now-playing ${displayClass ?? ""}`}>
        <p class="now-playing-label">{opts.label ?? "now playing"}</p>
        <iframe
          src={src}
          width="100%"
          height="80"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </div>
    )
  }

  NowPlaying.css = style
  return NowPlaying
}) satisfies QuartzComponentConstructor
